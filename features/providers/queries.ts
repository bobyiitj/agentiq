import { prisma } from "@/lib/db/prisma";

export interface WorkspaceModelView {
  accountId: string;
  label: string;
  provider: string;
  providerDisplayName: string;
  baseUrlOverride: string | null;
  models: {
    id: string;
    modelId: string;
    displayName: string;
    contextWindow: number;
    inputCostPer1k: number;
    outputCostPer1k: number;
    supportsVision: boolean;
    supportsTools: boolean;
  }[];
}

export async function getWorkspaceModels(workspaceId: string): Promise<WorkspaceModelView[]> {
  const accounts = await prisma.workspaceProviderAccount.findMany({
    where: { workspaceId, isActive: true },
    include: { provider: true },
  });

  const result: WorkspaceModelView[] = [];
  for (const acc of accounts) {
    const models = await prisma.model.findMany({
      where: {
        providerId: acc.providerId,
        isActive: true,
        ...(acc.modelAllowlist && acc.modelAllowlist.length > 0
          ? { id: { in: acc.modelAllowlist } }
          : {}),
      },
      orderBy: { modelId: "asc" },
    });

    result.push({
      accountId: acc.id,
      label: acc.label,
      provider: acc.provider.name,
      providerDisplayName: acc.provider.displayName,
      baseUrlOverride: acc.baseUrlOverride,
      models: models.map((m) => ({
        id: m.id,
        modelId: m.modelId,
        displayName: m.displayName,
        contextWindow: m.contextWindow,
        inputCostPer1k: m.inputCostPer1kTokens,
        outputCostPer1k: m.outputCostPer1kTokens,
        supportsVision: m.supportsVision,
        supportsTools: m.supportsTools,
      })),
    });
  }
  return result;
}
