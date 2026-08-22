export const liveStudioLayout = {
  container: "flex flex-col gap-3 min-h-[calc(100vh-2rem)] h-auto pb-6",
  workspace: "grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-[380px] lg:h-[clamp(380px,52vh,620px)]",
  workspaceCard: "flex flex-col min-h-[380px] overflow-hidden",
  ordersCard: "flex flex-col min-h-[240px] h-[clamp(240px,30vh,360px)]",
} as const;
