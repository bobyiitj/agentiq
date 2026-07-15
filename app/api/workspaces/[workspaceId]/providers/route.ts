import { NextResponse } from "next/server";
import { auth } from "@/features/auth/auth-config";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/rbac";
import { encryptJSON } from "@/lib/providers/encryption";
import { logActivity, getClientMeta } from "@/features/audit/logger";
import { z } from "zod";

export async function GET(req: Request, { params }: { params: { workspaceId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: params.workspaceId, userId: session.user.id } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Providers catalog is always visible; accounts are workspace-scoped.
  const [catalog, accounts] = await Promise.all([
    prisma.provider.findMany({ where: { isActive: true }, orderBy: { displayName: "asc" } }),
    prisma.workspaceProviderAccount.findMany({
      where: { workspaceId: params.workspaceId },
      include: { provider: true },
    }),
  ]);

  return NextResponse.json({
    catalog: catalog.map((p) => ({ id: p.id, name: p.name, displayName: p.displayName, description: p.description })),
    accounts: accounts.map((a) => ({
      id: a.id,
      label: a.label,
      provider: a.provider.name,
      providerDisplayName: a.provider.displayName,
      isActive: a.isActive,
      isDefault: a.isDefault,
      modelAllowlist: a.modelAllowlist,
      lastValidatedAt: a.lastValidatedAt,
      validationError: a.validationError,
    })),
  });
}

const connectSchema = z.object({
  providerId: z.string().min(1),
  label: z.string().min(1),
  apiKey: z.string().min(1),
  baseUrlOverride: z.string().optional().nullable(),
  modelAllowlist: z.array(z.string()).optional().default([]),
});

export async function POST(req: Request, { params }: { params: { workspaceId: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: params.workspaceId, userId: session.user.id } },
    });
    if (!member || !can(member.role, "providers", "create"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = connectSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      const first = Object.values(errors)[0]?.[0] ?? "Invalid input";
      return NextResponse.json({ error: first }, { status: 400 });
    }

    const provider = await prisma.provider.findUnique({ where: { id: parsed.data.providerId } });
    if (!provider) return NextResponse.json({ error: "Unknown provider" }, { status: 404 });

    const { createAdapter } = await import("@/lib/providers/registry");
    let adapter;
    try {
      adapter = createAdapter(provider.name, { apiKey: parsed.data.apiKey, baseUrl: parsed.data.baseUrlOverride ?? undefined });
    } catch {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    // Validate the API key before persisting.
    let validationError: string | null = null;
    try {
      const valid = await adapter.validate();
      if (!valid) {
        validationError = "API key validation failed — check your key and try again.";
      }
    } catch (e: any) {
      console.error("[provider-validate]", e);
      validationError = "API key validation failed — check your key and try again.";
    }
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 422 });
    }

    // Encrypt credentials before persisting.
    const encrypted = encryptJSON({ apiKey: parsed.data.apiKey });

    // Seed models from the adapter catalog if this provider has none.
    let modelCount = await prisma.model.count({ where: { providerId: provider.id } });
    if (modelCount === 0) {
      try {
        const models = await adapter.listModels();
        await prisma.model.createMany({
          data: models.map((m) => ({
            providerId: provider.id,
            modelId: m.id,
            displayName: m.name,
            contextWindow: m.contextWindow,
            maxOutputTokens: m.maxOutputTokens,
            inputCostPer1kTokens: m.inputCostPer1k,
            outputCostPer1kTokens: m.outputCostPer1k,
            supportsStreaming: m.capabilities.streaming,
            supportsTools: m.capabilities.tools,
            supportsVision: m.capabilities.vision,
            supportsJsonMode: m.capabilities.jsonMode,
          })),
        });
      } catch {
        // Model seeding failed — account still works, models can be added later.
      }
    }

    const account = await prisma.workspaceProviderAccount.create({
      data: {
        workspaceId: params.workspaceId,
        providerId: provider.id,
        label: parsed.data.label,
        encryptedCredentials: encrypted,
        baseUrlOverride: parsed.data.baseUrlOverride || null,
        modelAllowlist: parsed.data.modelAllowlist,
        lastValidatedAt: new Date(),
      },
    });

    const meta = getClientMeta(req);
    await logActivity({
      workspaceId: params.workspaceId,
      userId: session.user.id,
      action: "provider.connected",
      resource: "provider",
      resourceId: account.id,
      metadata: { label: account.label, provider: provider.name },
      ...meta,
    });

    return NextResponse.json(account, { status: 201 });
  } catch (err) {
    console.error("[providers-post]", err);
    return NextResponse.json({ error: "Connection failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { workspaceId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: params.workspaceId, userId: session.user.id } },
  });
  if (!member || !can(member.role, "providers", "delete"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { accountId } = await req.json();
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

  const account = await prisma.workspaceProviderAccount.findUnique({
    where: { id: accountId },
    include: { provider: true },
  });
  if (!account || account.workspaceId !== params.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Check for active agents using this provider
  const linkedAgents = await prisma.agent.count({
    where: { workspaceId: params.workspaceId, defaultProviderAccountId: accountId, status: { not: "ARCHIVED" } },
  });

  await prisma.workspaceProviderAccount.delete({ where: { id: accountId } });

  await logActivity({
    workspaceId: params.workspaceId,
    userId: session.user.id,
    action: "provider.removed",
    resource: "provider",
    resourceId: accountId,
    metadata: { label: account.label, provider: account.provider.name },
  });

  return NextResponse.json({ ok: true, linkedAgents });
}
