export type CareProfileType = "plant" | "fertilizer" | "pesticide" | "medium" | "tool" | "other";

export type CareProfileSource = {
  profileType: CareProfileType;
  purpose?: string | null;
  usageMethod?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  suitableFor?: string | null;
  safetyNotes?: string | null;
  additionalNotes?: string | null;
  isEnabled?: boolean | null;
};

export type PlantCareSource = {
  careZh?: string | null;
  lightDesc?: string | null;
  waterDesc?: string | null;
  fertilizerDesc?: string | null;
  pruningDesc?: string | null;
};

export type CarePackItemInput = {
  orderItemId: number;
  productId: number;
  variationId?: number | null;
  productName: string;
  variationName?: string | null;
  quantity: number;
  isCancelled?: boolean;
};

export type CarePackItemGroup = {
  productId: number;
  variationId: number;
  productName: string;
  variationName: string | null;
  quantity: number;
  orderItemIds: number[];
};

export type CareContentMissing = {
  key: string;
  label: string;
};

export type CareContent = {
  profileType: CareProfileType;
  plant?: {
    light: string | null;
    water: string | null;
    fertilizer: string | null;
    pruning: string | null;
    notes: string | null;
  };
  use?: {
    purpose: string | null;
    usageMethod: string | null;
    dosage: string | null;
    frequency: string | null;
    suitableFor: string | null;
    safetyNotes: string | null;
    additionalNotes: string | null;
  };
  missing: CareContentMissing[];
};

export type CarePackProductDocument = {
  productName: string;
  variationName: string | null;
  images: string[];
  content: Omit<CareContent, "missing">;
  missing: CareContentMissing[];
};

export type CarePackPublicDocument = {
  title: string;
  intro: string | null;
  products: CarePackProductDocument[];
  generatedAt: string;
};

const hasText = (value: string | null | undefined) => typeof value === "string" && value.trim().length > 0;
const textOrNull = (value: string | null | undefined) => hasText(value) ? value!.trim() : null;

export function normalizeCarePackVariationId(variationId: number | null | undefined): number {
  return Number.isInteger(variationId) && Number(variationId) > 0 ? Number(variationId) : 0;
}

/** Groups effective order items by product plus specification; removed/cancelled rows never enter the pack. */
export function groupEffectiveCarePackItems(items: CarePackItemInput[]): CarePackItemGroup[] {
  const grouped = new Map<string, CarePackItemGroup>();
  for (const item of items) {
    if (item.isCancelled || !Number.isFinite(item.quantity) || item.quantity <= 0) continue;
    const variationId = normalizeCarePackVariationId(item.variationId);
    const key = `${item.productId}:${variationId}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += Number(item.quantity);
      existing.orderItemIds.push(Number(item.orderItemId));
      continue;
    }
    grouped.set(key, {
      productId: Number(item.productId),
      variationId,
      productName: item.productName,
      variationName: variationId === 0 ? null : (item.variationName?.trim() || null),
      quantity: Number(item.quantity),
      orderItemIds: [Number(item.orderItemId)],
    });
  }
  return Array.from(grouped.values()).sort((a, b) => (
    a.productName.localeCompare(b.productName, "zh-Hans-CN")
    || a.variationName?.localeCompare(b.variationName ?? "", "zh-Hans-CN") || 0
  ));
}

/**
 * Returns only existing staff-entered text and a field-level missing list.
 * It intentionally never creates default care wording or calls an AI service.
 */
export function mapRealCareContent(
  profile: CareProfileSource | null | undefined,
  plant: PlantCareSource,
): CareContent {
  const inferredPlantProfile: CareProfileSource | null = !profile && [
    plant.lightDesc, plant.waterDesc, plant.fertilizerDesc, plant.pruningDesc, plant.careZh,
  ].some(hasText) ? { profileType: "plant", isEnabled: true } : null;
  const effectiveProfile = profile || inferredPlantProfile;

  if (!effectiveProfile || effectiveProfile.isEnabled === false) {
    return {
      profileType: "other",
      use: {
        purpose: null, usageMethod: null, dosage: null, frequency: null,
        suitableFor: null, safetyNotes: null, additionalNotes: null,
      },
      missing: [{ key: "profile", label: "尚未填写商品使用资料" }],
    };
  }

  if (effectiveProfile.profileType === "plant") {
    const fields = [
      ["light", "光线", plant.lightDesc],
      ["water", "水分／浇水", plant.waterDesc],
      ["fertilizer", "施肥", plant.fertilizerDesc],
      ["pruning", "修剪", plant.pruningDesc],
      ["notes", "注意事项", plant.careZh],
    ] as const;
    return {
      profileType: "plant",
      plant: {
        light: textOrNull(plant.lightDesc),
        water: textOrNull(plant.waterDesc),
        fertilizer: textOrNull(plant.fertilizerDesc),
        pruning: textOrNull(plant.pruningDesc),
        notes: textOrNull(plant.careZh),
      },
      missing: fields.filter(([, , value]) => !hasText(value)).map(([key, label]) => ({ key, label })),
    };
  }

  return {
    profileType: effectiveProfile.profileType,
    use: {
      purpose: textOrNull(effectiveProfile.purpose),
      usageMethod: textOrNull(effectiveProfile.usageMethod),
      dosage: textOrNull(effectiveProfile.dosage),
      frequency: textOrNull(effectiveProfile.frequency),
      suitableFor: textOrNull(effectiveProfile.suitableFor),
      safetyNotes: textOrNull(effectiveProfile.safetyNotes),
      additionalNotes: textOrNull(effectiveProfile.additionalNotes),
    },
    missing: ([
      ["purpose", "用途", effectiveProfile.purpose],
      ["usageMethod", "使用方法", effectiveProfile.usageMethod],
      ["dosage", "剂量", effectiveProfile.dosage],
      ["frequency", "频率", effectiveProfile.frequency],
      ["suitableFor", "适用对象", effectiveProfile.suitableFor],
      ["safetyNotes", "安全注意事项", effectiveProfile.safetyNotes],
    ] as const).filter(([, , value]) => !hasText(value)).map(([key, label]) => ({ key, label })),
  };
}

/** Creates the customer-facing allow-list. It has no order/customer/payment/address fields by type or runtime. */
export function createCarePackPublicDocument(input: {
  title: string;
  intro?: string | null;
  generatedAt: string;
  products: Array<{
    productName: string;
    variationName?: string | null;
    images?: Array<string | null | undefined>;
    content: CareContent;
  }>;
}): CarePackPublicDocument {
  return {
    title: input.title,
    intro: textOrNull(input.intro),
    generatedAt: input.generatedAt,
    products: input.products.map((product) => ({
      productName: product.productName,
      variationName: textOrNull(product.variationName),
      images: Array.from(new Set((product.images ?? []).filter((image): image is string => hasText(image)).map((image) => image.trim()))),
      content: product.content.plant
        ? { profileType: product.content.profileType, plant: product.content.plant }
        : { profileType: product.content.profileType, use: product.content.use! },
      missing: product.content.missing,
    })),
  };
}

/** A finalized pack must use its immutable snapshot; active packs use current live content. */
export function resolveCarePackDocument<T>(input: { status: "active" | "finalized" | "revoked"; finalSnapshot?: T | null; liveDocument: T }): T | null {
  if (input.status === "revoked") return null;
  if (input.status === "finalized") return input.finalSnapshot ?? null;
  return input.liveDocument;
}

/** Stable JSON used only for change detection; it does not expose any sensitive order data. */
export function stringifyCarePackDocument(document: CarePackPublicDocument): string {
  return JSON.stringify({
    ...document,
    products: [...document.products].sort((a, b) => (
      a.productName.localeCompare(b.productName, "zh-Hans-CN")
      || (a.variationName ?? "").localeCompare(b.variationName ?? "", "zh-Hans-CN")
    )),
  });
}
