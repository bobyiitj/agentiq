import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { slugify } from "@/lib/utils";
import { logActivity } from "@/features/audit/logger";
import { rateLimitOrReject, RATE_LIMIT_AUTH } from "@/lib/security/rate-limit";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  email: z.string().email("Invalid email address").max(255),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export async function POST(req: Request) {
  // Rate limit: 5 registrations per 15 min per IP
  const rl = rateLimitOrReject(req, RATE_LIMIT_AUTH, "register");
  if (rl) return rl;

  try {
    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      const first = Object.values(errors)[0]?.[0] ?? "Invalid input";
      return NextResponse.json({ error: first }, { status: 400 });
    }

    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
    });

    // Auto-create a default workspace so the user lands somewhere useful.
    const slug = slugify(`${name || email.split("@")[0]}-workspace`);
    const base = slug || "my-workspace";
    let uniqueSlug = base;
    let n = 1;
    while (await prisma.workspace.findUnique({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${base}-${n++}`;
    }
    const workspace = await prisma.workspace.create({
      data: {
        name: `${name || email.split("@")[0]}'s Workspace`,
        slug: uniqueSlug,
        ownerId: user.id,
        members: { create: { userId: user.id, role: "OWNER" } },
      },
    });

    await logActivity({
      workspaceId: workspace.id,
      userId: user.id,
      action: "workspace.created",
      resource: "workspace",
      resourceId: workspace.id,
      metadata: { name: workspace.name },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
