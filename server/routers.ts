import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, adminProcedure, protectedProcedure, shippingProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { eq } from "drizzle-orm";
import { variants } from "../drizzle/schema";
import { sendTelegramJoinFlow, sendMembershipFlow, getUserProfile, sendTextMessage } from "./messenger";
import { retryFailedAiLogDelivery } from "./aiLogRetry";
import * as parceldaily from "./parceldaily";
import * as parcelking from "./parcelking";
import { ParcelKingError } from "./parcelking";
import * as shippingProvider from "./shippingProvider";

const PACKING_SHIPPING_ERROR_MESSAGES: Record<string, string> = {
  PACKING_ORDER_NOT_FOUND: "订单不存在或已被删除",
  PACKING_ORDER_NOT_READY_FOR_FULL_SHIPMENT: "订单当前状态不可完整发货",
  PACKING_ORDER_NOT_READY_FOR_PARTIAL_SHIPMENT: "订单当前状态不可部分发货",
  PACKING_PACKAGE_REQUIRED: "请至少添加一个包裹",
  PACKING_ITEM_REQUIRED: "请至少选择一个待发商品",
  PACKING_ITEM_NOT_IN_ORDER: "所选商品不属于此订单",
  PACKING_ITEM_ALREADY_SHIPPED: "所选商品已在其他包裹中发出",
};

function rethrowPackingShippingError(error: unknown): never {
  const message = error instanceof Error ? PACKING_SHIPPING_ERROR_MESSAGES[error.message] : undefined;
  if (message) {
    throw new TRPCError({ code: "BAD_REQUEST", message });
  }
  throw error;
}

/**
 * Auto-notify customer of order status change.
 * Priority: Facebook Messenger → WhatsApp (fallback).
 * Records the notification status in the order.
 */
async function autoNotifyCustomer(orderId: number, message: string, psid?: string, whatsapp?: string): Promise<{ platform: string; status: string; error?: string }> {
  // Try Facebook Messenger first
  if (psid) {
    try {
      await sendTextMessage(psid, message);
      return { platform: "facebook", status: "sent" };
    } catch (fbErr) {
      // Fall through to WhatsApp
    }
  }
  // Try WhatsApp as fallback (placeholder — actual WhatsApp API integration needed)
  if (whatsapp) {
    // WhatsApp sending would go here
    return { platform: "whatsapp", status: "pending", error: "WhatsApp API not yet configured" };
  }
  return { platform: "none", status: "failed", error: "No contact method available" };
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    updateLanguage: protectedProcedure
      .input(z.object({ language: z.enum(["zh", "en"]) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        await db.updateUserLanguage(ctx.user.openId, input.language);
        return { success: true } as const;
      }),
  }),

  // ===========================================================================
  // Products
  // ===========================================================================
  products: router({
    list: adminProcedure
      .input(z.object({
        type: z.enum(["physical", "membership", "gift"]).optional(),
        search: z.string().optional(),
        isListed: z.boolean().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getProducts(input || {});
      }),

    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const product = await db.getProductById(input.id);
        if (!product) throw new Error("Product not found");
        return product;
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        type: z.enum(["physical", "membership", "gift"]),
        categoryId: z.number().optional(),
        description: z.string().optional(),
        coverImageUrl: z.string().optional(),
        cost: z.string().optional(),
        regularPrice: z.string().optional(),
        memberPrice: z.string().optional(),
        originalPrice: z.string().optional(),
        specialPrice: z.string().optional(),
        weightKg: z.string().optional(),
        stockQuantity: z.number().optional(),
        isPreOrder: z.boolean().optional(),
        isListed: z.boolean().optional(),
        isSpecialItem: z.boolean().optional(),
        allowFreeShipping: z.boolean().optional(),
        categories: z.string().optional(),
        keywords: z.string().optional(),
        videoUrl: z.string().optional(),
        membershipIntro: z.string().optional(),
        telegramFlowLink: z.string().optional(),
        facebookFlowId: z.string().optional(),
        allowStandalonePurchase: z.boolean().optional(),
        allowMixedCheckout: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createProduct(input as any);
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        type: z.enum(["physical", "membership", "gift"]).optional(),
        categoryId: z.number().optional(),
        description: z.string().optional(),
        coverImageUrl: z.string().optional(),
        cost: z.string().optional(),
        regularPrice: z.string().optional(),
        memberPrice: z.string().optional(),
        originalPrice: z.string().optional(),
        specialPrice: z.string().optional(),
        weightKg: z.string().optional(),
        stockQuantity: z.number().optional(),
        isPreOrder: z.boolean().optional(),
        isListed: z.boolean().optional(),
        isSpecialItem: z.boolean().optional(),
        allowFreeShipping: z.boolean().optional(),
        categories: z.string().optional(),
        keywords: z.string().optional(),
        videoUrl: z.string().optional(),
        membershipIntro: z.string().optional(),
        telegramFlowLink: z.string().optional(),
        facebookFlowId: z.string().optional(),
        allowStandalonePurchase: z.boolean().optional(),
        allowMixedCheckout: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateProduct(id, data as any);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProduct(input.id);
        return { success: true };
      }),
  }),

  // ===========================================================================
  // Product Categories (Legacy - kept for backward compatibility)
  // ===========================================================================
  productCategoriesLegacy: router({
    list: adminProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getProductCategories(input?.activeOnly);
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        parentId: z.number().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createProductCategory(input as any);
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        parentId: z.number().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateProductCategory(id, data as any);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProductCategory(input.id);
        return { success: true };
      }),
  }),

  // ===========================================================================
  // Phase 1: Categories (商品分类 - 新版)
  // ===========================================================================
  categories: router({
    list: adminProcedure
      .input(z.object({ activeOnly: z.boolean().optional(), storeOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        if (input?.storeOnly) {
          return await db.getStoreCategories();
        }
        if (input?.activeOnly) {
          return await db.getActiveCategories();
        }
        return await db.getAllCategories();
      }),

    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const category = await db.getCategoryById(input.id);
        if (!category) throw new Error('分类不存在');
        const productCount = await db.countProductsInCategory(input.id);
        return { ...category, productCount };
      }),

    create: adminProcedure
      .input(z.object({
        nameZh: z.string().min(1),
        nameEn: z.string().min(1),
        descZh: z.string().optional(),
        descEn: z.string().optional(),
        showInStore: z.boolean().optional(),
        sortOrder: z.number().optional(),
        imageUrl: z.string().optional(),
        iconUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createCategory(input);
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        nameZh: z.string().optional(),
        nameEn: z.string().optional(),
        descZh: z.string().optional(),
        descEn: z.string().optional(),
        status: z.enum(['active', 'inactive']).optional(),
        showInStore: z.boolean().optional(),
        sortOrder: z.number().optional(),
        imageUrl: z.string().optional(),
        iconUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCategory(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteCategory(input.id);
      }),

    reorder: adminProcedure
      .input(z.object({ items: z.array(z.object({ id: z.number(), sortOrder: z.number() })) }))
      .mutation(async ({ input }) => {
        await db.reorderCategories(input.items);
        return { success: true };
      }),
  }),

  // ===========================================================================
  // Phase 1: Units (销售单位)
  // ===========================================================================
  units: router({
    list: adminProcedure.query(async () => {
      return await db.getAllUnits();
    }),

    create: adminProcedure
      .input(z.object({
        nameZh: z.string().min(1),
        nameEn: z.string().min(1),
        isDefault: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createUnit(input);
      }),
  }),

  // ===========================================================================
  // Phase 1: Products V2 (Admin - 三层 API: Admin / Public / Member Link)
  // ===========================================================================
  productsV2: router({
    // --- Admin API ---
    list: adminProcedure
      .input(z.object({
        search: z.string().optional(),
        categoryId: z.number().optional(),
        status: z.enum(['draft', 'active', 'inactive', 'out_of_stock']).optional(),
        productMode: z.enum(['simple', 'variant']).optional(),
        visibility: z.enum(['public', 'link_only', 'hidden']).optional(),
        type: z.enum(['physical', 'membership', 'gift']).optional(),
        isFeatured: z.boolean().optional(),
        stockFilter: z.enum(['low', 'out']).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getProductsEnhanced(input || {});
      }),

    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const product = await db.getProductByIdEnhanced(input.id);
        if (!product) throw new Error('商品不存在');
        return product;
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        type: z.enum(['physical', 'membership', 'gift']),
        productMode: z.enum(['simple', 'variant']),
        categoryId: z.number().optional(),
        unitId: z.number().optional(),
        keyword: z.string().min(1),
        sku: z.string().optional(),
        status: z.enum(['draft', 'active', 'inactive', 'out_of_stock']).optional(),
        visibility: z.enum(['public', 'link_only', 'hidden']).optional(),
        priceVisibility: z.enum(['show', 'hide', 'member_link']).optional(),
        shortDescZh: z.string().optional(),
        shortDescEn: z.string().optional(),
        fullDescZh: z.string().optional(),
        fullDescEn: z.string().optional(),
        careZh: z.string().optional(),
        careEn: z.string().optional(),
        sellingPrice: z.string().optional(),
        compareAtPrice: z.string().optional(),
        memberPrice: z.string().optional(),
        currentCost: z.string().optional(),
        specialPrice: z.string().optional(),
        dimensions: z.any().optional(),
        weightKg: z.string().optional(),
        stockQuantity: z.number().optional(),
        isFeatured: z.boolean().optional(),
        featuredSortOrder: z.number().optional(),
        membershipIntro: z.string().optional(),
        telegramFlowLink: z.string().optional(),
        allowStandalonePurchase: z.boolean().optional(),
        allowMixedCheckout: z.boolean().optional(),
        notes: z.string().optional(),
        coverImageUrl: z.string().optional(),
        images: z.string().optional(),
        videoUrl: z.string().optional(),
        description: z.string().optional(),
        isSpecial: z.boolean().optional(),
        allowPresale: z.boolean().optional(),
        allowStandaloneShipping: z.boolean().optional(),
        standaloneShippingMethod: z.enum(['fixed_fee', 'free_shipping']).optional(),
        standaloneShippingFee: z.string().optional(),
        lightDesc: z.string().optional(),
        waterDesc: z.string().optional(),
        fertilizerDesc: z.string().optional(),
        pruningDesc: z.string().optional(),
        syncToMall: z.boolean().optional(),
        mallSortOrder: z.number().optional(),
        isPot: z.boolean().optional(),
        potCapacity: z.string().optional(),
        productImages: z.array(z.string()).optional(),
        // V4: Wholesale & Agent
        wholesalePrice: z.number().optional(),
        agentPrice: z.number().optional(),
        moq: z.number().optional(),
        visibleTo: z.string().optional(),
        specialPriceStartDate: z.string().optional(),
        specialPriceEndDate: z.string().optional(),
        keywordChannels: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Check keyword conflict
        const conflict = await db.checkKeywordConflict(input.keyword);
        if (!conflict.available) {
          throw new Error(`关键词「${input.keyword}」已被商品「${conflict.conflictWith?.name}」使用`);
        }
        return await db.createProductEnhanced(input);
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        type: z.enum(['physical', 'membership', 'gift']).optional(),
        productMode: z.enum(['simple', 'variant']).optional(),
        categoryId: z.number().optional(),
        unitId: z.number().optional(),
        keyword: z.string().optional(),
        status: z.enum(['draft', 'active', 'inactive', 'out_of_stock']).optional(),
        visibility: z.enum(['public', 'link_only', 'hidden']).optional(),
        priceVisibility: z.enum(['show', 'hide', 'member_link']).optional(),
        shortDescZh: z.string().optional(),
        shortDescEn: z.string().optional(),
        fullDescZh: z.string().optional(),
        fullDescEn: z.string().optional(),
        careZh: z.string().optional(),
        careEn: z.string().optional(),
        sellingPrice: z.string().optional(),
        compareAtPrice: z.string().optional(),
        memberPrice: z.string().optional(),
        currentCost: z.string().optional(),
        specialPrice: z.string().optional(),
        dimensions: z.any().optional(),
        weightKg: z.string().optional(),
        stockQuantity: z.number().optional(),
        isFeatured: z.boolean().optional(),
        featuredSortOrder: z.number().optional(),
        membershipIntro: z.string().optional(),
        telegramFlowLink: z.string().optional(),
        allowStandalonePurchase: z.boolean().optional(),
        allowMixedCheckout: z.boolean().optional(),
        notes: z.string().optional(),
        coverImageUrl: z.string().optional(),
        images: z.string().optional(),
        videoUrl: z.string().optional(),
        description: z.string().optional(),
        isSpecial: z.boolean().optional(),
        allowPresale: z.boolean().optional(),
        allowStandaloneShipping: z.boolean().optional(),
        standaloneShippingMethod: z.enum(['fixed_fee', 'free_shipping']).optional(),
        standaloneShippingFee: z.string().optional(),
        lightDesc: z.string().optional(),
        waterDesc: z.string().optional(),
        fertilizerDesc: z.string().optional(),
        pruningDesc: z.string().optional(),
        syncToMall: z.boolean().optional(),
        mallSortOrder: z.number().optional(),
        isPot: z.boolean().optional(),
        potCapacity: z.string().optional(),
        productImages: z.array(z.string()).optional(),
        // V4: Wholesale & Agent
        wholesalePrice: z.number().optional(),
        agentPrice: z.number().optional(),
        moq: z.number().optional(),
        visibleTo: z.string().optional(),
        specialPriceStartDate: z.string().optional(),
        specialPriceEndDate: z.string().optional(),
        keywordChannels: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        // Check keyword conflict if keyword is being updated
        if (data.keyword) {
          const conflict = await db.checkKeywordConflict(data.keyword, id);
          if (!conflict.available) {
            throw new Error(`关键词「${data.keyword}」已被商品「${conflict.conflictWith?.name}」使用`);
          }
        }
        await db.updateProductEnhanced(id, data);
        return { success: true };
      }),

    setStatus: adminProcedure
      .input(z.object({ id: z.number(), status: z.enum(['draft', 'active', 'inactive', 'out_of_stock']) }))
      .mutation(async ({ input }) => {
        await db.updateProductEnhanced(input.id, { status: input.status });
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteProductEnhanced(input.id);
      }),

    duplicate: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const product = await db.getProductByIdEnhanced(input.id);
        if (!product) throw new Error('商品不存在');
        // Generate new keyword and SKU
        const newKeyword = `${product.keyword}_COPY`;
        const conflict = await db.checkKeywordConflict(newKeyword);
        if (!conflict.available) {
          throw new Error(`复制关键词「${newKeyword}」冲突，请手动修改`);
        }
        const result = await db.createProductEnhanced({
          name: `${product.name} (副本)`,
          type: product.type as any,
          productMode: product.productMode as any,
          categoryId: product.categoryId ?? undefined,
          unitId: product.unitId ?? undefined,
          keyword: newKeyword,
          status: 'draft',
          visibility: product.visibility as any,
          priceVisibility: product.priceVisibility as any,
          shortDescZh: product.shortDescZh ?? undefined,
          shortDescEn: product.shortDescEn ?? undefined,
          fullDescZh: product.fullDescZh ?? undefined,
          fullDescEn: product.fullDescEn ?? undefined,
          careZh: product.careZh ?? undefined,
          careEn: product.careEn ?? undefined,
          sellingPrice: product.sellingPrice ?? undefined,
          compareAtPrice: product.compareAtPrice ?? undefined,
          memberPrice: product.memberPrice ?? undefined,
          currentCost: product.currentCost ?? undefined,
          specialPrice: product.specialPrice ?? undefined,
          dimensions: product.dimensions,
          weightKg: product.weightKg ?? undefined,
          stockQuantity: 0,
          isFeatured: false,
          notes: product.notes ?? undefined,
          coverImageUrl: product.coverImageUrl ?? undefined,
          description: product.description ?? undefined,
        });
        return { id: result.id, sku: result.sku };
      }),

    checkKeyword: adminProcedure
      .input(z.object({ keyword: z.string().min(1), excludeProductId: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.checkKeywordConflict(input.keyword, input.excludeProductId);
      }),

    checkVariantKeyword: adminProcedure
      .input(z.object({ productId: z.number(), keyword: z.string().min(1), excludeVariantId: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.checkVariantKeywordConflict(input.productId, input.keyword, input.excludeVariantId);
      }),

    // --- Public API (价格隔离: 不返回 memberPrice / estimatedCost / currentCost / sku / notes) ---
    publicList: publicProcedure
      .input(z.object({
        categoryId: z.number().optional(),
        search: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getPublicProducts(input || {});
      }),

    publicGetById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const product = await db.getPublicProductById(input.id);
        if (!product) throw new Error('商品不存在或未上架');
        return product;
      }),

    publicGetByKeyword: publicProcedure
      .input(z.object({ keyword: z.string().min(1) }))
      .query(async ({ input }) => {
        const product = await db.getPublicProductByKeyword(input.keyword);
        if (!product) throw new Error('关键词未匹配到商品');
        return product;
      }),

    // --- Member Link API (Token 验证后返回含 memberPrice) ---
    memberGetByToken: publicProcedure
      .input(z.object({ token: z.string().min(1) }))
      .query(async ({ input }) => {
        const product = await db.getMemberLinkByToken(input.token);
        if (!product) throw new Error('链接无效或已过期');
        return product;
      }),
  }),

  // ===========================================================================
  // Phase 1: Variants (商品规格)
  // ===========================================================================
  variants: router({
    create: adminProcedure
      .input(z.object({
        productId: z.number(),
        name: z.string().min(1),
        keyword: z.string().min(1),
        sku: z.string().optional(),
        sellingPrice: z.string().optional(),
        compareAtPrice: z.string().optional(),
        memberPrice: z.string().optional(),
        estimatedCost: z.string().optional(),
        currentCost: z.string().optional(),
        weight: z.string().optional(),
        dimensions: z.any().optional(),
        status: z.enum(['active', 'inactive', 'hidden']).optional(),
        visibility: z.enum(['public', 'link_only', 'hidden']).optional(),
        sortOrder: z.number().optional(),
        imageUrl: z.string().optional(),
        stockQuantity: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        // Check variant keyword conflict within the same product
        const conflict = await db.checkVariantKeywordConflict(input.productId, input.keyword);
        if (!conflict.available) {
          throw new Error(`规格关键词「${input.keyword}」已被规格「${conflict.conflictWith?.name}」使用`);
        }
        return await db.createVariant(input);
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        keyword: z.string().optional(),
        sellingPrice: z.string().optional(),
        compareAtPrice: z.string().optional(),
        memberPrice: z.string().optional(),
        estimatedCost: z.string().optional(),
        currentCost: z.string().optional(),
        weight: z.string().optional(),
        dimensions: z.any().optional(),
        status: z.enum(['active', 'inactive', 'hidden']).optional(),
        visibility: z.enum(['public', 'link_only', 'hidden']).optional(),
        sortOrder: z.number().optional(),
        imageUrl: z.string().optional(),
        stockQuantity: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        // Check keyword conflict if keyword is being updated
        if (data.keyword) {
          // Need productId for conflict check - get the variant first
          const db2 = await db.getDb();
          if (db2) {
            const variantRow = await db2.select().from(variants).where(eq(variants.id, id)).limit(1);
            if (variantRow.length > 0) {
              const conflict = await db.checkVariantKeywordConflict(variantRow[0].productId, data.keyword, id);
              if (!conflict.available) {
                throw new Error(`规格关键词「${data.keyword}」已被规格「${conflict.conflictWith?.name}」使用`);
              }
            }
          }
        }
        await db.updateVariant(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteVariant(input.id);
        return { success: true };
      }),
  }),

  // ===========================================================================
  // Phase 1: Member Links (安全会员购买链接)
  // ===========================================================================
  memberLinks: router({
    generate: adminProcedure
      .input(z.object({ productId: z.number() }))
      .mutation(async ({ input }) => {
        return await db.generateMemberLink(input.productId);
      }),

    list: adminProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        return await db.getMemberLinksByProductId(input.productId);
      }),

    deactivate: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deactivateMemberLink(input.id);
        return { success: true };
      }),
  }),

  // ===========================================================================
  // Phase 1: Product Images (商品图片管理)
  // ===========================================================================
  productImages: router({
    add: adminProcedure
      .input(z.object({
        productId: z.number(),
        url: z.string().min(1),
        fileKey: z.string().min(1),
        sortOrder: z.number().optional(),
        isMain: z.boolean().optional(),
        altText: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.addProductImage(input);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProductImage(input.id);
        return { success: true };
      }),

    updateOrder: adminProcedure
      .input(z.object({ id: z.number(), sortOrder: z.number(), isMain: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        await db.updateProductImageOrder(input.id, input.sortOrder, input.isMain);
        return { success: true };
      }),
  }),

  // ===========================================================================
  // Phase 1: Product Videos (商品影片管理)
  // ===========================================================================
  productVideos: router({
    add: adminProcedure
      .input(z.object({
        productId: z.number(),
        url: z.string().min(1),
        fileKey: z.string().min(1),
        sortOrder: z.number().optional(),
        isMain: z.boolean().optional(),
        thumbnailUrl: z.string().optional(),
        duration: z.number().optional(),
        altText: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.addProductVideo(input);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProductVideo(input.id);
        return { success: true };
      }),
  }),

  // ===========================================================================
  // Phase 1: Product Attributes (商品属性管理)
  // ===========================================================================
  productAttributes: router({
    add: adminProcedure
      .input(z.object({
        productId: z.number(),
        attributeName: z.string().min(1),
        attributeValue: z.string().min(1),
        sortOrder: z.number().optional(),
        isFilterable: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.addProductAttribute(input);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProductAttribute(input.id);
        return { success: true };
      }),
  }),

  // ===========================================================================
  // Suppliers (进货供应商)
  // ===========================================================================
  suppliers: router({
    list: adminProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getSuppliers(input?.activeOnly);
      }),

    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const supplier = await db.getSupplierById(input.id);
        if (!supplier) throw new Error("Supplier not found");
        return supplier;
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        contactPerson: z.string().optional(),
        phoneNumber: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        bankAccount: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createSupplier(input as any);
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        contactPerson: z.string().optional(),
        phoneNumber: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        bankAccount: z.string().optional(),
        notes: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateSupplier(id, data as any);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteSupplier(input.id);
        return { success: true };
      }),
  }),

  // ===========================================================================
  // Purchase Orders (进货单)
  // ===========================================================================
  purchaseOrders: router({
    list: adminProcedure
      .input(z.object({
        supplierId: z.number().optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getPurchaseOrders(input || {});
      }),

    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const po = await db.getPurchaseOrderById(input.id);
        if (!po) throw new Error("Purchase order not found");
        const items = await db.getPurchaseOrderItems(input.id);
        return { ...po, items };
      }),

    create: adminProcedure
      .input(z.object({
        supplierId: z.number(),
        notes: z.string().optional(),
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.number().min(1),
          unitCost: z.string(),
          subtotal: z.string(),
          // V2.1: Variant-level purchase support
          variantName: z.string().optional(),
          variantKeyword: z.string().optional(),
          sellingPrice: z.string().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        return await db.createPurchaseOrder(input);
      }),

    receive: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.receivePurchaseOrder(input.id);
        return { success: true };
      }),
  }),

  // ===========================================================================
  // Business Reports (经营报告)
  // ===========================================================================
  reports: router({
    // Legacy: monthly profit report
    monthlyProfit: adminProcedure
      .input(z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
      }))
      .query(async ({ input }) => {
        return await db.getMonthlyProfitReport(input.year, input.month);
      }),
    // Business overview: 12 data cards
    overview: adminProcedure
      .input(z.object({
        preset: z.string(),
        customStart: z.string().optional(),
        customEnd: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const dateRange = db.getDateRange(input.preset, input.customStart, input.customEnd);
        return await db.getBusinessOverview(dateRange);
      }),
    // TOP10: Best selling by quantity
    topByQuantity: adminProcedure
      .input(z.object({
        preset: z.string(),
        customStart: z.string().optional(),
        customEnd: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const dateRange = db.getDateRange(input.preset, input.customStart, input.customEnd);
        return await db.getTopProductsByQuantity(dateRange);
      }),
    // TOP10: Best selling by revenue
    topByRevenue: adminProcedure
      .input(z.object({
        preset: z.string(),
        customStart: z.string().optional(),
        customEnd: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const dateRange = db.getDateRange(input.preset, input.customStart, input.customEnd);
        return await db.getTopProductsByRevenue(dateRange);
      }),
    // TOP10: Most profitable products
    topByProfit: adminProcedure
      .input(z.object({
        preset: z.string(),
        customStart: z.string().optional(),
        customEnd: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const dateRange = db.getDateRange(input.preset, input.customStart, input.customEnd);
        return await db.getTopProductsByProfit(dateRange);
      }),
    // TOP10: Top customers by paid amount
    topCustomers: adminProcedure
      .input(z.object({
        preset: z.string(),
        customStart: z.string().optional(),
        customEnd: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const dateRange = db.getDateRange(input.preset, input.customStart, input.customEnd);
        return await db.getTopCustomersBySpending(dateRange);
      }),
    // Sales & Payment sub-report
    salesPayment: adminProcedure
      .input(z.object({
        preset: z.string(),
        customStart: z.string().optional(),
        customEnd: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const dateRange = db.getDateRange(input.preset, input.customStart, input.customEnd);
        return await db.getSalesPaymentReport(dateRange);
      }),
    // Product Sales sub-report
    productSales: adminProcedure
      .input(z.object({
        preset: z.string(),
        customStart: z.string().optional(),
        customEnd: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const dateRange = db.getDateRange(input.preset, input.customStart, input.customEnd);
        return await db.getProductSalesReport(dateRange);
      }),
    // Customer Spending sub-report
    customerSpending: adminProcedure
      .input(z.object({
        preset: z.string(),
        customStart: z.string().optional(),
        customEnd: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const dateRange = db.getDateRange(input.preset, input.customStart, input.customEnd);
        return await db.getCustomerSpendingReport(dateRange);
      }),
    // Purchase & Inventory sub-report
    purchaseInventory: adminProcedure
      .input(z.object({
        preset: z.string(),
        customStart: z.string().optional(),
        customEnd: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const dateRange = db.getDateRange(input.preset, input.customStart, input.customEnd);
        return await db.getPurchaseInventoryReport(dateRange);
      }),
    // Refund records
    refunds: adminProcedure
      .input(z.object({
        preset: z.string(),
        customStart: z.string().optional(),
        customEnd: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const dateRange = db.getDateRange(input.preset, input.customStart, input.customEnd);
        return await db.getRefundRecords(dateRange);
      }),
    // V2.1: Special price product profit analysis
    specialPriceProfit: adminProcedure
      .input(z.object({
        preset: z.string(),
        customStart: z.string().optional(),
        customEnd: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const dateRange = db.getDateRange(input.preset, input.customStart, input.customEnd);
        return await db.getSpecialPriceProductProfit(dateRange);
      }),
    // V4: Wholesale & Agent report
    wholesaleAgent: adminProcedure
      .input(z.object({
        preset: z.string(),
        customStart: z.string().optional(),
        customEnd: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const dateRange = db.getDateRange(input.preset, input.customStart, input.customEnd);
        return await db.getWholesaleAgentReport(dateRange);
      }),
    // V4: Customer type statistics
    customerTypeStats: adminProcedure
      .query(async () => {
        return await db.getCustomerTypeStats();
      }),
  }),

  // ===========================================================================
  // Orders
  // ===========================================================================
  orders: router({
    list: adminProcedure
      .input(z.object({
        physicalStatus: z.string().optional(),
        membershipStatus: z.string().optional(),
        orderType: z.string().optional(),
        search: z.string().optional(),
        todayOnly: z.boolean().optional(),
        orderNature: z.string().optional(),
        orderCategory: z.string().optional(),
        isSpecialOrder: z.boolean().optional(),
        specialOrderStatus: z.string().optional(),
        specialOrderType: z.string().optional(),
        salesChannel: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getOrders(input || {});
      }),

    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const order = await db.getOrderById(input.id);
        if (!order) throw new Error("Order not found");
        const items = await db.getOrderItems(input.id);
        return { ...order, items };
      }),

    create: adminProcedure
      .input(z.object({
        customerId: z.number(),
        facebookName: z.string().optional(),
        facebookId: z.string().optional(),
        messengerId: z.string().optional(),
        items: z.array(z.object({
          productId: z.number(),
          productName: z.string(),
          productType: z.enum(["physical", "membership", "gift"]),
          quantity: z.number().min(1),
          unitPrice: z.string(),
          subtotal: z.string(),
          variationId: z.number().optional(),
          variationName: z.string().optional(),
          priceType: z.string().optional(),
          unitCost: z.string().optional(),
          originalUnitPrice: z.string().optional(),
        })),
        shippingAddress: z.string().optional(),
        shippingMethod: z.string().optional(),
        paymentMethodId: z.number().optional(),
        paymentMethodName: z.string().optional(),
        salesChannel: z.string().optional(),
        orderNature: z.string().optional(),
        orderSource: z.string().optional(),
        orderCategory: z.string().optional(),
        sourceName: z.string().optional(),
        liveRoomId: z.number().optional(),
        // V2.2: Promotion / discount / extra charge / credit
        promotionId: z.number().optional(),
        promotionName: z.string().optional(),
        promotionDiscount: z.string().optional(),
        discountAmount: z.string().optional(),
        discountReason: z.string().optional(),
        extraCharge: z.string().optional(),
        extraChargeDescription: z.string().optional(),
        creditUsed: z.string().optional(),
        // V2.2: Recipient info
        recipientName: z.string().optional(),
        recipientPhone: z.string().optional(),
        addressLine1: z.string().optional(),
        addressLine2: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        postcode: z.string().optional(),
        country: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createOrderWithSplit(input);
        if (result.orderId) {
          await db.logOrderOperation(result.orderId, "create", `Order created by ${ctx.user?.name || "admin"}`, null, ctx.user?.name || "admin");
        }
        return result;
      }),

    updateStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        physicalStatus: z.string().optional(),
        membershipStatus: z.string().optional(),
        courierCompany: z.string().optional(),
        trackingNumber: z.string().optional(),
        receiptUrl: z.string().optional(),
        paymentMethodId: z.number().optional(),
        paymentMethodName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
                const { id, ...data } = input;
        await db.updateOrderStatus(id, data);
        return { success: true };
      }),

    // V2.2: Update order details (for OrderEditPage)
    updateDetails: adminProcedure
      .input(z.object({
        id: z.number(),
        shippingAddress: z.string().optional(),
        shippingMethod: z.string().optional(),
        orderNature: z.string().optional(),
        orderSource: z.string().optional(),
        orderCategory: z.string().optional(),
        recipientName: z.string().optional(),
        recipientPhone: z.string().optional(),
        discountAmount: z.string().optional(),
        discountReason: z.string().optional(),
        extraCharge: z.string().optional(),
        extraChargeDescription: z.string().optional(),
        creditUsed: z.string().optional(),
        promotionId: z.number().optional(),
        promotionName: z.string().optional(),
        promotionDiscount: z.string().optional(),
        shippingFee: z.string().optional(),
        totalAmount: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateOrderDetails(id, data);
        await db.logOrderOperation(id, "edit", `Order details updated by ${ctx.user?.name || "admin"}`, null, ctx.user?.name || "admin");
        return { success: true };
      }),
    // V2.2: Special order follow-up stats
    followUpStats: adminProcedure.query(async () => {
      return await db.getSpecialOrderFollowUpStats();
    }),
    // V2.2: Special order follow-up list
    followUpList: adminProcedure.input(z.object({
      limit: z.number().optional(),
    })).query(async ({ input }) => {
      return await db.getSpecialOrderFollowUpList(input.limit);
    }),

    // V2.1: Order payments (多次汇款)
    getPayments: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        return await db.getOrderPayments(input.orderId);
      }),

    addPayment: adminProcedure
      .input(z.object({
        orderId: z.number(),
        amount: z.string(),
        paymentMethodId: z.number().optional(),
        paymentMethodName: z.string().optional(),
        receiptUrl: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.addOrderPayment({
          orderId: input.orderId,
          amount: input.amount,
          paymentMethodId: input.paymentMethodId,
          paymentMethodName: input.paymentMethodName,
          receiptUrl: input.receiptUrl,
          recordedBy: ctx.user?.name || "admin",
          notes: input.notes,
        });
        return { success: true };
      }),

    // V2.1: Cancel order with reason
    cancelOrder: adminProcedure
      .input(z.object({
        id: z.number(),
        reason: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.cancelOrderWithReason(input.id, input.reason, ctx.user?.name || "admin");
        return { success: true };
      }),

    // V3.2: Update special status (set / remove)
    updateSpecialStatus: adminProcedure
      .input(z.object({
        orderId: z.number(),
        action: z.enum(["set", "remove"]),
        specialOrderType: z.string().optional(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const adminName = ctx.user?.name || "admin";
        const { sql } = await import("drizzle-orm");
        if (input.action === "remove") {
          await db.executeRaw(sql`UPDATE orders SET isSpecialOrder = 0, specialOrderStatus = 'resolved', specialOrderReason = ${input.reason || ''}, specialOrderBy = ${adminName}, specialOrderUpdatedAt = NOW() WHERE id = ${input.orderId}`);
        } else {
          if (!input.specialOrderType) throw new Error("specialOrderType is required for set action");
          await db.executeRaw(sql`UPDATE orders SET isSpecialOrder = 1, specialOrderType = ${input.specialOrderType}, specialOrderStatus = 'pending', specialOrderSource = 'manual', specialOrderReason = ${input.reason || ''}, specialOrderBy = ${adminName}, specialOrderUpdatedAt = NOW() WHERE id = ${input.orderId}`);
        }
        await db.logOrderOperation(input.orderId, "special_status", `Special status ${input.action === "set" ? "set to " + input.specialOrderType : "removed"} by ${adminName}${input.reason ? ": " + input.reason : ""}`, null, adminName);
        return { success: true };
      }),

    // V2.1: Order operation logs
    getOperationLogs: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        return await db.getOrderOperationLogs(input.orderId);
      }),

    // V2.1: Search products for order creation (名称/编号/关键词/SKU)
    searchProductsForOrder: adminProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ input }) => {
        return await db.getProducts({ search: input.query });
      }),

    // V2.1: Get order detail with items, payments, and logs
    getDetail: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const order = await db.getOrderById(input.id);
        if (!order) throw new Error("Order not found");
        const items = await db.getOrderItems(input.id);
        const payments = await db.getOrderPayments(input.id);
        const logs = await db.getOrderOperationLogs(input.id);
        return { ...order, items, payments, logs };
      }),

    // V2.1: Compare shipping quotes from multiple providers
    compareShippingQuotes: adminProcedure
      .input(z.object({
        fromPostcode: z.string(),
        toPostcode: z.string(),
        weightKg: z.number(),
      }))
      .query(async ({ input }) => {
        const results: any[] = [];

        // Try ParcelDaily
        try {
          const quote = await parceldaily.getQuote({
            fromPostcode: input.fromPostcode,
            toPostcode: input.toPostcode,
            kg: input.weightKg,
          });
          const couriers = parceldaily.extractCourierPrices(quote);
          for (const c of couriers) {
            results.push({ provider: "ParcelDaily", ...c });
          }
        } catch (e: any) {
          // Skip if ParcelDaily fails
        }

        // Try ParcelKing
        if (parcelking.isParcelKingConfigured()) {
          try {
            const pkResult = await parcelking.priceQuery({
              from_postcode: input.fromPostcode,
              to_postcode: input.toPostcode,
              parcel_weight_kg: input.weightKg,
            });
            if (pkResult && pkResult.services) {
              for (const s of pkResult.services) {
                results.push({
                  provider: "ParcelKing",
                  courier: s.service_name,
                  price: s.total_price,
                  estDelivery: s.estimated_days || null,
                });
              }
            }
          } catch (e: any) {
            // Skip ParcelKing if it fails entirely
          }
        }

        return { success: true, quotes: results };
      }),

    // V2.2: AI Smart Parse customer address
    aiSmartParse: adminProcedure
      .input(z.object({ text: z.string() }))
      .query(async ({ input }) => {
        return await db.aiSmartParse(input.text);
      }),

    // V2.2: Use customer credit
    useCredit: adminProcedure
      .input(z.object({
        customerId: z.number(),
        amount: z.number(),
        orderId: z.number(),
      }))
      .mutation(async ({ input }) => {
        return await db.useCustomerCredit(input.customerId, input.amount, input.orderId);
      }),

    // V2.2: Refund customer credit
    refundCredit: adminProcedure
      .input(z.object({
        customerId: z.number(),
        amount: z.number(),
        orderId: z.number(),
      }))
      .mutation(async ({ input }) => {
        return await db.refundCustomerCredit(input.customerId, input.amount, input.orderId);
      }),

    // V2.2: Calculate West Malaysia shipping
    calculateShipping: adminProcedure
      .input(z.object({
        totalWeight: z.number(),
        orderTotal: z.number(),
      }))
      .query(async ({ input }) => {
        const result = db.calculateWestMalaysiaShipping(input.totalWeight, input.orderTotal);
        return { ...result, threshold: 150 };
      }),
  }),
  // ===========================================================================
  // Membership Fee Reviews
  // ===========================================================================
  membership: router({
    listReviews: adminProcedure
      .input(z.object({
        status: z.string().optional(),
        flowStatus: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getMembershipReviews(input || {});
      }),

    getReviewById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const review = await db.getMembershipReviewById(input.id);
        if (!review) throw new Error("Review not found");
        return review;
      }),

    getReviewByOrderId: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        return await db.getMembershipReviewByOrderId(input.orderId);
      }),

    createReview: adminProcedure
      .input(z.object({
        orderId: z.number(),
        receiptFileUrl: z.string(),
        flowTemplateId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createMembershipReview(input);
        // Also update order membership status to receipt_uploaded
        await db.updateOrderStatus(input.orderId, {
          membershipStatus: "receipt_uploaded",
          receiptUrl: input.receiptFileUrl,
        });
        return { success: true };
      }),

    approveFee: adminProcedure
      .input(z.object({
        reviewId: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const review = await db.getMembershipReviewById(input.reviewId);
        if (!review) throw new Error("Review not found");

        // Step 1: Mark review as approved
        await db.approveMembershipFee(input.reviewId, ctx.user.id, input.notes);

        // Step 2: Update order membership status to fee_confirmed
        await db.updateOrderStatus(review.orderId, {
          membershipStatus: "fee_confirmed",
        });

        // Step 3: Attempt to send Flow via Messenger
        try {
          // Get the flow template
          const templateId = review.flowTemplateId;
          let template = templateId ? await db.getFlowTemplateById(templateId) : null;

          // Fall back to first active template
          if (!template) {
            const templates = await db.getFlowTemplates(true);
            template = templates[0] || null;
          }

          if (template) {
            const messageContent = template.messageContent;
            const buttonName = template.buttonName || "进入心田会员系统";
            const buttonLink = template.buttonLink || "";

            // Get the order to find customer's Messenger PSID
            const order = await db.getOrderById(review.orderId);
            const customer = order?.customerId ? await db.getCustomerById(order.customerId) : null;
            const psid = customer?.messengerId || order?.messengerId || "";

            let flowResult: { success: boolean; messageId?: string; error?: string } = { success: false, error: "No PSID available" };

            if (psid) {
              // Send via real Messenger API
              flowResult = await sendTelegramJoinFlow(
                psid,
                buttonLink || "",
                messageContent,
                buttonName
              );
            } else {
              console.warn("[Membership] No Messenger PSID found for customer, cannot send Flow automatically");
            }

            // Log the send attempt
            await db.createFlowSendLog({
              reviewId: input.reviewId,
              flowTemplateId: template.id,
              stepOrder: 1,
              status: flowResult.success ? "sent" : "failed",
              messageContent,
              sentAt: new Date(),
              errorMessage: flowResult.error,
            } as any);

            if (flowResult.success) {
              // Update review flow status
              await db.updateFlowStatus(input.reviewId, {
                flowStatus: "sent",
                flowSentAt: new Date(),
              });

              // Update order status to flow_sent
              await db.updateOrderStatus(review.orderId, {
                membershipStatus: "flow_sent",
              });

              return {
                success: true,
                flowSent: true,
                message: "会员费已确认，Messenger Flow 已自动发送",
                messageContent,
                buttonName,
                buttonLink,
              };
            } else {
              await db.updateFlowStatus(input.reviewId, {
                flowStatus: "failed",
                flowErrorMessage: flowResult.error || "Messenger API send failed",
              });

              await db.updateOrderStatus(review.orderId, {
                membershipStatus: "flow_failed",
              });

              return {
                success: true,
                flowSent: false,
                message: `会员费已确认，但 Flow 发送失败: ${flowResult.error}`,
              };
            }
          } else {
            // No template configured
            await db.updateFlowStatus(input.reviewId, {
              flowStatus: "failed",
              flowErrorMessage: "No active flow template configured",
            });

            await db.updateOrderStatus(review.orderId, {
              membershipStatus: "flow_failed",
            });

            return {
              success: true,
              flowSent: false,
              message: "会员费已确认，但未配置 Flow 模板，请手动发送",
            };
          }
        } catch (error: any) {
          await db.updateFlowStatus(input.reviewId, {
            flowStatus: "failed",
            flowErrorMessage: error.message,
          });

          await db.updateOrderStatus(review.orderId, {
            membershipStatus: "flow_failed",
          });

          return {
            success: true,
            flowSent: false,
            message: `会员费已确认，但 Flow 发送失败: ${error.message}`,
          };
        }
      }),

    rejectFee: adminProcedure
      .input(z.object({
        reviewId: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const review = await db.getMembershipReviewById(input.reviewId);
        if (!review) throw new Error("Review not found");

        await db.rejectMembershipFee(input.reviewId, ctx.user.id, input.notes);

        // Reset order membership status back to pending
        await db.updateOrderStatus(review.orderId, {
          membershipStatus: "pending",
        });

        return { success: true };
      }),

    resendFlow: adminProcedure
      .input(z.object({
        reviewId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const review = await db.getMembershipReviewById(input.reviewId);
        if (!review) throw new Error("Review not found");

        let template = review.flowTemplateId ? await db.getFlowTemplateById(review.flowTemplateId) : null;
        if (!template) {
          const templates = await db.getFlowTemplates(true);
          template = templates[0] || null;
        }

        if (!template) throw new Error("No active flow template configured");

        // Get customer PSID
        const order = await db.getOrderById(review.orderId);
        const customer = order?.customerId ? await db.getCustomerById(order.customerId) : null;
        const psid = customer?.messengerId || order?.messengerId || "";

        let flowResult: { success: boolean; messageId?: string; error?: string } = { success: false, error: "No PSID available" };

        if (psid) {
          flowResult = await sendTelegramJoinFlow(
            psid,
            template.buttonLink || "",
            template.messageContent,
            template.buttonName || "进入心田会员系统"
          );
        }

        await db.createFlowSendLog({
          reviewId: input.reviewId,
          flowTemplateId: template.id,
          stepOrder: 1,
          status: flowResult.success ? "sent" : "failed",
          messageContent: template.messageContent,
          sentAt: new Date(),
          errorMessage: flowResult.error,
        } as any);

        if (flowResult.success) {
          await db.updateFlowStatus(input.reviewId, {
            flowStatus: "sent",
            flowSentAt: new Date(),
            flowErrorMessage: undefined,
          });

          await db.updateOrderStatus(review.orderId, {
            membershipStatus: "flow_sent",
          });

          return {
            success: true,
            message: "Flow 已重新发送",
            messageContent: template.messageContent,
          };
        } else {
          await db.updateFlowStatus(input.reviewId, {
            flowStatus: "failed",
            flowErrorMessage: flowResult.error,
          });

          return {
            success: false,
            message: `Flow 重发失败: ${flowResult.error}`,
          };
        }
      }),

    markLinkClicked: adminProcedure
      .input(z.object({ reviewId: z.number() }))
      .mutation(async ({ input }) => {
        await db.markTelegramLinkClicked(input.reviewId);
        // Also update order to completed
        const review = await db.getMembershipReviewById(input.reviewId);
        if (review) {
          await db.updateOrderStatus(review.orderId, {
            membershipStatus: "completed",
          });
        }
        return { success: true };
      }),

    markNeedsFollowUp: adminProcedure
      .input(z.object({
        reviewId: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const review = await db.getMembershipReviewById(input.reviewId);
        if (!review) throw new Error("Review not found");

        await db.markNeedsManualFollowUp(input.reviewId, input.notes);
        await db.updateOrderStatus(review.orderId, {
          membershipStatus: "manual_follow_up",
        });
        return { success: true };
      }),

    cancelMembershipOrder: adminProcedure
      .input(z.object({
        reviewId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const review = await db.getMembershipReviewById(input.reviewId);
        if (!review) throw new Error("Review not found");

        await db.updateOrderStatus(review.orderId, {
          membershipStatus: "cancelled",
        });
        return { success: true };
      }),

    getFlowLogs: adminProcedure
      .input(z.object({ reviewId: z.number() }))
      .query(async ({ input }) => {
        return await db.getFlowSendLogsByReviewId(input.reviewId);
      }),
  }),

  // ===========================================================================
  // Flow Templates
  // ===========================================================================
  flows: router({
    list: adminProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getFlowTemplates(input?.activeOnly);
      }),

    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const template = await db.getFlowTemplateById(input.id);
        if (!template) throw new Error("Flow template not found");
        const steps = await db.getFlowStepsByTemplateId(input.id);
        return { ...template, steps };
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        messageContent: z.string().min(1),
        imageUrl: z.string().optional(),
        videoUrl: z.string().optional(),
        buttonName: z.string().optional(),
        buttonLink: z.string().optional(),
        reminderEnabled: z.boolean().optional(),
        reminderDelayHours: z.number().optional(),
        reminderMessage: z.string().optional(),
        reminderMaxCount: z.number().optional(),
        followUpEnabled: z.boolean().optional(),
        followUpDelayHours: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createFlowTemplate(input as any);
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        messageContent: z.string().optional(),
        imageUrl: z.string().optional(),
        videoUrl: z.string().optional(),
        buttonName: z.string().optional(),
        buttonLink: z.string().optional(),
        reminderEnabled: z.boolean().optional(),
        reminderDelayHours: z.number().optional(),
        reminderMessage: z.string().optional(),
        reminderMaxCount: z.number().optional(),
        followUpEnabled: z.boolean().optional(),
        followUpDelayHours: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateFlowTemplate(id, data as any);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteFlowTemplate(input.id);
        return { success: true };
      }),

    // Flow Steps
    listSteps: adminProcedure
      .input(z.object({ templateId: z.number() }))
      .query(async ({ input }) => {
        return await db.getFlowStepsByTemplateId(input.templateId);
      }),

    createStep: adminProcedure
      .input(z.object({
        flowTemplateId: z.number(),
        stepOrder: z.number(),
        stepName: z.string().min(1),
        messageType: z.enum(["text", "image", "video", "button", "contact_support"]),
        messageContent: z.string().optional(),
        mediaUrl: z.string().optional(),
        buttonName: z.string().optional(),
        buttonLink: z.string().optional(),
        delaySeconds: z.number().optional(),
        conditionType: z.enum(["always", "if_not_clicked", "if_clicked"]).optional(),
        conditionValue: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createFlowStep(input as any);
      }),

    updateStep: adminProcedure
      .input(z.object({
        id: z.number(),
        stepOrder: z.number().optional(),
        stepName: z.string().optional(),
        messageType: z.enum(["text", "image", "video", "button", "contact_support"]).optional(),
        messageContent: z.string().optional(),
        mediaUrl: z.string().optional(),
        buttonName: z.string().optional(),
        buttonLink: z.string().optional(),
        delaySeconds: z.number().optional(),
        conditionType: z.enum(["always", "if_not_clicked", "if_clicked"]).optional(),
        conditionValue: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateFlowStep(id, data as any);
        return { success: true };
      }),

    deleteStep: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteFlowStep(input.id);
        return { success: true };
      }),
  }),

  // ===========================================================================
  // Customers
  // ===========================================================================
  customers: router({
    list: adminProcedure
      .input(z.object({ search: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getCustomers(input?.search);
      }),

    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const customer = await db.getCustomerById(input.id);
        if (!customer) throw new Error("Customer not found");
        return customer;
      }),

    findOrCreate: adminProcedure
      .input(z.object({
        facebookId: z.string().optional(),
        facebookName: z.string().optional(),
        messengerId: z.string().optional(),
        name: z.string().optional(),
        phoneNumber: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        shopLinkIdentifier: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.findOrCreateCustomer(input);
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        phoneNumber: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
        isBlacklisted: z.boolean().optional(),
        blacklistReason: z.string().optional(),
        notes: z.string().optional(),
        membershipLevel: z.enum(["regular", "member", "vip"]).optional(),
        pointsBalance: z.number().optional(),
        customerType: z.enum(["retail", "wholesale", "agent"]).optional(),
        accountEmail: z.string().optional(),
        canLogin: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCustomer(id, data as any);
        return { success: true };
      }),

    getOrders: adminProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return await db.getCustomerOrders(input.customerId);
      }),

    findDuplicates: adminProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return await db.findPotentialDuplicateCustomers(input.customerId);
      }),

    merge: adminProcedure
      .input(z.object({
        sourceId: z.number(),
        targetId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.mergeCustomers(input.sourceId, input.targetId, ctx.user.id);
        return { success: true };
      }),

    getMergeSuggestions: adminProcedure
      .input(z.object({ status: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getMergeSuggestions(input?.status);
      }),
  }),

  // ===========================================================================
  // Messenger (Facebook integration)
  // ===========================================================================
  messenger: router({
    // Test sending a message to a PSID
    testSend: adminProcedure
      .input(z.object({
        psid: z.string(),
        message: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const result = await sendTextMessage(
            input.psid,
            input.message || "测试消息：心田系统 Messenger 集成测试成功！"
          );
          return { success: true, result };
        } catch (error: any) {
          return { success: false, error: error?.response?.data?.error?.message || error?.message };
        }
      }),

    // Get user profile by PSID
    getProfile: adminProcedure
      .input(z.object({ psid: z.string() }))
      .query(async ({ input }) => {
        return await getUserProfile(input.psid);
      }),

    // Send custom message to a customer
    sendCustomMessage: adminProcedure
      .input(z.object({
        customerId: z.number(),
        message: z.string(),
        imageUrl: z.string().optional(),
        buttonText: z.string().optional(),
        buttonUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const customer = await db.getCustomerById(input.customerId);
        if (!customer) throw new Error("Customer not found");
        const psid = customer.messengerId;
        if (!psid) throw new Error("Customer has no Messenger ID");

        try {
          if (input.imageUrl) {
            // Send image with caption
            const { sendMediaMessage } = await import("./messenger");
            await sendMediaMessage(psid, "image", input.imageUrl, input.message);
          } else {
            await sendTextMessage(psid, input.message);
          }

          if (input.buttonText && input.buttonUrl) {
            const { sendButtonMessage } = await import("./messenger");
            await sendButtonMessage(psid, "请点击以下按钮", [
              { title: input.buttonText, url: input.buttonUrl },
            ]);
          }

          return { success: true };
        } catch (error: any) {
          return { success: false, error: error?.response?.data?.error?.message || error?.message };
        }
      }),

    // Get Facebook connection status
    status: adminProcedure.query(async () => {
      return {
        pageId: process.env.FB_PAGE_ID || "",
        appId: process.env.FB_APP_ID || "",
        hasPageAccessToken: !!process.env.FB_PAGE_ACCESS_TOKEN,
        hasAppSecret: !!process.env.FB_APP_SECRET,
        hasCatalogToken: !!process.env.FB_CATALOG_ACCESS_TOKEN,
        webhookUrl: "/api/facebook/webhook",
        verifyToken: process.env.FB_VERIFY_TOKEN || "",
      };
    }),
  }),

  // ===========================================================================
  // System Settings (系统设置)
  // ===========================================================================
  settings: router({
    // Company profile & system settings
    get: adminProcedure.query(async () => {
      return await db.getSystemSettings();
    }),
    update: adminProcedure.input(z.object({
      companyName: z.string().optional(),
      companyLogoUrl: z.string().optional(),
      companyAddress: z.string().optional(),
      companyPhone: z.string().optional(),
      companyEmail: z.string().optional(),
      companyWebsite: z.string().optional(),
      businessRegNo: z.string().optional(),
      defaultShipFromAddress: z.string().optional(),
      defaultShipFromPhone: z.string().optional(),
      defaultShipFromName: z.string().optional(),
      defaultShipFromPostcode: z.string().optional(),
      defaultShipFromState: z.string().optional(),
      defaultShipFromCity: z.string().optional(),
      currency: z.string().optional(),
      timezone: z.string().optional(),
      orderPrefix: z.string().optional(),
      orderNumberPadding: z.number().optional(),
      poPrefix: z.string().optional(),
      poNumberPadding: z.number().optional(),
      customerPrefix: z.string().optional(),
      customerNumberPadding: z.number().optional(),
      skuPrefix: z.string().optional(),
      skuNumberPadding: z.number().optional(),
      notifyOnNewOrder: z.boolean().optional(),
      notifyOnPayment: z.boolean().optional(),
      notifyOnShipment: z.boolean().optional(),
      notifyEmail: z.string().optional(),
      requireStaffLogin: z.boolean().optional(),
      autoCompleteDays: z.number().optional(),
    })).mutation(async ({ input }) => {
      return await db.updateSystemSettings(input);
    }),
  }),

  // ===========================================================================
  // Shipping Rules (运费规则)
  // ===========================================================================
  shippingRules: router({
    list: adminProcedure.query(async () => {
      return await db.getShippingRules();
    }),
    update: adminProcedure.input(z.object({
      id: z.number(),
      displayName: z.string().optional(),
      freeShippingThreshold: z.number().nullable().optional(),
      freeShippingMaxWeight: z.number().nullable().optional(),
      additionalKgPrice: z.number().nullable().optional(),
      defaultCourier: z.string().nullable().optional(),
      maxCalculateWeight: z.number().nullable().optional(),
      specialInstruction: z.string().nullable().optional(),
      isEnabled: z.boolean().optional(),
      sortOrder: z.number().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      return await db.updateShippingRule(id, data);
    }),
    create: adminProcedure.input(z.object({
      zone: z.enum(["west_malaysia", "east_malaysia", "self_pickup", "lalamove"]),
      displayName: z.string(),
      freeShippingThreshold: z.number().nullable().optional(),
      freeShippingMaxWeight: z.number().nullable().optional(),
      additionalKgPrice: z.number().nullable().optional(),
      defaultCourier: z.string().nullable().optional(),
      maxCalculateWeight: z.number().nullable().optional(),
      specialInstruction: z.string().nullable().optional(),
      isEnabled: z.boolean().optional(),
      sortOrder: z.number().optional(),
    })).mutation(async ({ input }) => {
      return await db.createShippingRule(input);
    }),
    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteShippingRule(input.id);
      return { success: true };
    }),
  }),

  // ===========================================================================
  // Shipping Providers (物流供应商)
  // ===========================================================================
  shippingProviders: router({
    list: adminProcedure.query(async () => {
      const providers = await db.getShippingProviders();
      // Don't expose credentials to frontend
      return providers.map(p => ({
        ...p,
        credentials: undefined,
      }));
    }),
    update: adminProcedure.input(z.object({
      providerKey: z.string(),
      isEnabled: z.boolean().optional(),
      environment: z.enum(["sandbox", "production"]).optional(),
      supportedCouriers: z.string().optional(),
    })).mutation(async ({ input }) => {
      const { providerKey, ...data } = input;
      return await db.updateShippingProvider(providerKey, data);
    }),
    // Test connection for a provider
    testConnection: adminProcedure.input(z.object({
      providerKey: z.string(),
    })).mutation(async ({ input }) => {
      if (input.providerKey === "parceldaily") {
        if (!parceldaily.isParcelDailyConfigured()) {
          return { success: false, error: "ParcelDaily credentials not configured" };
        }
        try {
          const info = await parceldaily.checkAccountInfo();
          if (info.data) {
            // Update balance in DB
            await db.updateShippingProvider("parceldaily", {
              accountBalance: info.data.credit.toString() as any,
              lastSyncAt: new Date() as any,
            });
            return {
              success: true,
              balance: info.data.credit,
              package: info.data.topupPackage,
              expiresIn: info.data.expiresIn,
            };
          }
          return { success: false, error: info.error?.message || "Unknown error" };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
      return { success: false, error: "Unknown provider" };
    }),
  }),

  // ===========================================================================
  // ParcelDaily Operations (ParcelDaily 物流操作)
  // ===========================================================================
  parceldaily: router({
    // Check account info / balance
    accountInfo: adminProcedure.query(async () => {
      if (!parceldaily.isParcelDailyConfigured()) {
        return { success: false, error: "Not configured" };
      }
      try {
        const info = await parceldaily.checkAccountInfo();
        return { success: true, data: info.data };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),
    // Check postcode
    checkPostcode: adminProcedure.input(z.object({
      postcode: z.string(),
    })).query(async ({ input }) => {
      try {
        const result = await parceldaily.checkPostcode(input.postcode);
        return { success: true, data: result.success };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),
    // Get shipping quote
    getQuote: adminProcedure.input(z.object({
      fromPostcode: z.string(),
      toPostcode: z.string(),
      weightKg: z.number(),
    })).query(async ({ input }) => {
      try {
        const quote = await parceldaily.getQuote({
          fromPostcode: input.fromPostcode,
          toPostcode: input.toPostcode,
          kg: input.weightKg,
        });
        const couriers = parceldaily.extractCourierPrices(quote);
        return { success: true, couriers, raw: quote.success };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),
    // Create shipment for an order
    createShipment: adminProcedure.input(z.object({
      orderId: z.number(),
      courier: z.string(),
      weightKg: z.number(),
      price: z.number().optional(),
    })).mutation(async ({ input, ctx }) => {
      try {
        // Get order details
        const order = await db.getOrderById(input.orderId);
        if (!order) throw new Error("Order not found");

        // Get customer details for delivery address
        const customer = await db.getCustomerById(order.customerId);
        if (!customer) throw new Error("Customer not found");

        // Get system settings for pickup address
        const settings = await db.getSystemSettings();
        if (!settings?.defaultShipFromPostcode) {
          throw new Error("Default shipping address not configured in system settings");
        }

        const pickupAddress = {
          fullName: settings.defaultShipFromName || settings.companyName || "Sender",
          phone: settings.defaultShipFromPhone || "",
          line1: settings.defaultShipFromAddress || "",
          city: settings.defaultShipFromCity || "",
          postcode: settings.defaultShipFromPostcode,
          state: settings.defaultShipFromState || "",
          country: "Malaysia",
        };

        const deliveryAddress = {
          fullName: customer.name || customer.facebookName || "Recipient",
          phone: customer.phoneNumber || "",
          line1: customer.address || order.shippingAddress || "",
          city: customer.city || "",
          postcode: customer.postalCode || "",
          state: customer.state || "",
          country: customer.country || "Malaysia",
        };

        const result = await shippingProvider.parcelDailyProvider.createShipment({
          courier: input.courier,
          pickupAddress,
          deliveryAddress,
          weightKg: input.weightKg,
          price: input.price || 0,
          content: "Goods",
          contentValue: parseFloat(order.totalAmount?.toString() || "0"),
          reference: order.orderNumber,
        });

        // Save shipment record
        const shipment = await db.createShipment({
          orderId: input.orderId,
          providerKey: "parceldaily",
          courier: input.courier,
          providerOrderId: result.providerOrderId,
          actualWeight: input.weightKg.toString() as any,
          status: "created",
          rawResponse: JSON.stringify(result.rawResponse),
        });

        return { success: true, shipment };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),
    // Checkout shipment (pay and get tracking number)
    checkoutShipment: adminProcedure.input(z.object({
      shipmentId: z.number(),
    })).mutation(async ({ input }) => {
      try {
        // Get shipment from DB by ID - use a direct query
        const dbAny = db as any;
        const shipment = await dbAny.getShipmentById?.(input.shipmentId);
        if (!shipment) {
          throw new Error("Shipment not found");
        }

        const result = await shippingProvider.parcelDailyProvider.checkoutShipment(shipment.providerOrderId);

        // Update shipment with tracking number
        const updated = await db.updateShipment(input.shipmentId, {
          trackingNumber: result.trackingNumber,
          consignmentNoteUrl: result.consignmentNoteUrl || null,
          shippingCost: result.shippingCost.toString() as any,
          status: "checked_out",
          checkedOutAt: new Date() as any,
        });

        // Update order status to shipped
        await db.updateOrderStatus(shipment.orderId, {
          physicalStatus: "shipped",
          trackingNumber: result.trackingNumber,
          courierCompany: shipment.courier,
        });

        return { success: true, shipment: updated, trackingNumber: result.trackingNumber };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),
    // Get consignment note URL
    getConsignmentNote: adminProcedure.input(z.object({
      shipmentId: z.number(),
    })).query(async ({ input }) => {
      try {
        const dbAny2 = db as any;
        const shipment = await dbAny2.getShipmentById?.(input.shipmentId);
        if (!shipment) throw new Error("Shipment not found");

        const result = await parceldaily.getConsignmentNote(shipment.providerOrderId);
        return { success: true, url: result.url };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),
  }),

  // ===========================================================================
  // ParcelKing Operations (Parcel King 物流操作)
  // ===========================================================================
  parcelking: router({
    // Check if ParcelKing is configured
    isConfigured: adminProcedure.query(async () => {
      return { configured: parcelking.isParcelKingConfigured(), testMode: parcelking.isTestMode() };
    }),

    // Get e-wallet balance
    getBalance: adminProcedure.query(async () => {
      if (!parcelking.isParcelKingConfigured()) {
        return { success: false, error: "Parcel King API key not configured" };
      }
      try {
        const balance = await parcelking.getBalance();
        return { success: true, balance: balance.result.balance, currency: balance.result.currency };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),

    // List available courier services
    getServices: adminProcedure.query(async () => {
      if (!parcelking.isParcelKingConfigured()) {
        return { success: false, error: "Parcel King API key not configured", services: [] };
      }
      try {
        const services = await parcelking.getServices();
        return { success: true, services };
      } catch (error: any) {
        return { success: false, error: error.message, services: [] };
      }
    }),

    // Query shipping prices
    priceQuery: adminProcedure.input(z.object({
      fromPostcode: z.string(),
      toPostcode: z.string(),
      weightKg: z.number(),
      parcelValue: z.number().optional(),
    })).query(async ({ input }) => {
      if (!parcelking.isParcelKingConfigured()) {
        return { success: false, error: "Parcel King API key not configured", services: [] };
      }
      try {
        const result = await parcelking.priceQuery({
          from_postcode: input.fromPostcode,
          to_postcode: input.toPostcode,
          parcel_weight_kg: input.weightKg,
          parcel_value: input.parcelValue,
        });
        return { success: true, services: result.services, weightUsedKg: result.weightUsedKg, totalParcels: result.totalParcels, isMps: result.isMps };
      } catch (error: any) {
        return { success: false, error: error.message, services: [] };
      }
    }),

    // Create a shipment for a specific package (auto tracking + label)
    createShipment: adminProcedure.input(z.object({
      orderId: z.number(),
      serviceId: z.number(),
      weightKg: z.number(),
      content: z.string().optional(),
      contentValue: z.number().optional(),
      handoverMethod: z.enum(["pickup", "dropoff"]).optional(),
      pickupTime: z.number().optional(),
      pickupTimeRangeId: z.number().optional(),
    })).mutation(async ({ input }) => {
      if (!parcelking.isParcelKingConfigured()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Parcel King API key not configured" });
      }
      try {
        // Get order + customer + system settings for addresses
        const order = await db.getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "订单不存在" });

        const settings = await db.getSystemSettings();
        if (!settings || !settings.defaultShipFromAddress) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "系统设置中缺少发货地址，请先在系统设置中填写默认发货地址" });
        }

        const customer = await db.getCustomerById(order.customerId);
        if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "客户不存在" });

        const senderPhone = parcelking.normalizePhone(settings.defaultShipFromPhone || settings.companyPhone || "");
        const recipientPhone = parcelking.normalizePhone(customer.phoneNumber || "");

        const response = await parcelking.createOrder({
          service_id: input.serviceId,
          sender: {
            name: settings.defaultShipFromName || settings.companyName || "Store",
            phone: settings.defaultShipFromPhone || settings.companyPhone || "",
            dial_code: senderPhone.dial_code,
            mobile: senderPhone.mobile,
            line1: settings.defaultShipFromAddress || settings.companyAddress || "",
            city: settings.defaultShipFromCity || "",
            postcode: settings.defaultShipFromPostcode || "",
            state: settings.defaultShipFromState || "",
            country: "Malaysia",
          },
          recipient: {
            name: customer.name || customer.displayName || "Customer",
            phone: customer.phoneNumber || "",
            dial_code: recipientPhone.dial_code,
            mobile: recipientPhone.mobile,
            line1: order.shippingAddress || customer.address || "",
            city: customer.city || "",
            postcode: customer.postalCode || "",
            state: customer.state || "",
            country: "Malaysia",
          },
          parcel: {
            weight_kg: input.weightKg,
            name: input.content || "Goods",
            declared_value: input.contentValue,
          },
          delivery_options: input.handoverMethod ? {
            handover_method: input.handoverMethod,
            pickup_time: input.pickupTime,
            pickup_time_range_id: input.pickupTimeRangeId,
          } : undefined,
          reference: order.orderNumber,
        });

        const trackingNo = response.result.tracking_no;
        const labelUrl = response.result.label_url || null;
        const shippingCost = response.result.final_amount || 0;

        return {
          success: true,
          trackingNumber: trackingNo,
          labelUrl,
          shippingCost,
          testMode: response.result.test_mode,
        };
      } catch (error: any) {
        if (error instanceof ParcelKingError) {
          throw new TRPCError({
            code: error.statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "BAD_REQUEST",
            message: error.message,
          });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }
    }),

    // Get order details / tracking from ParcelKing
    getOrderDetails: adminProcedure.input(z.object({
      trackingNo: z.string(),
    })).query(async ({ input }) => {
      if (!parcelking.isParcelKingConfigured()) {
        return { success: false, error: "Parcel King API key not configured" };
      }
      try {
        const details = await parcelking.getOrderDetails(input.trackingNo);
        return { success: true, details: details.result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),

    // Get live tracking timeline
    getTracking: adminProcedure.input(z.object({
      trackingNo: z.string(),
    })).query(async ({ input }) => {
      if (!parcelking.isParcelKingConfigured()) {
        return { success: false, error: "Parcel King API key not configured" };
      }
      try {
        const tracking = await parcelking.getTracking(input.trackingNo);
        return { success: true, tracking: tracking.result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),

    // Cancel an order
    cancelOrder: adminProcedure.input(z.object({
      trackingNo: z.string(),
    })).mutation(async ({ input }) => {
      if (!parcelking.isParcelKingConfigured()) {
        return { success: false, error: "Parcel King API key not configured" };
      }
      try {
        const result = await parcelking.cancelOrder(input.trackingNo);
        return { success: true, result: result.result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),

    // Re-download shipping label
    downloadLabel: adminProcedure.input(z.object({
      trackingNo: z.string(),
    })).query(async ({ input }) => {
      if (!parcelking.isParcelKingConfigured()) {
        return { success: false, error: "Parcel King API key not configured" };
      }
      try {
        const url = await parcelking.getShippingLabelUrl(input.trackingNo);
        return { success: true, url };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),

    // Re-sync tracking status from ParcelKing
    resyncTracking: adminProcedure.input(z.object({
      trackingNo: z.string(),
      packageId: z.number(),
    })).mutation(async ({ input }) => {
      if (!parcelking.isParcelKingConfigured()) {
        return { success: false, error: "Parcel King API key not configured" };
      }
      try {
        const tracking = await parcelking.getTracking(input.trackingNo);
        const timeline = tracking.result.timeline || [];
        const latest = timeline[timeline.length - 1];

        // Update package status based on tracking events
        let newStatus = "shipped";
        if (latest?.description?.toLowerCase().includes("deliver")) {
          newStatus = "delivered";
        }

        const dbAny = db as any;
        if (dbAny.updatePackageStatus) {
          await dbAny.updatePackageStatus(input.packageId, newStatus);
        }

        return { success: true, timeline, latestEvent: latest, newStatus };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),

    // Get SPX pickup slots
    getSpxPickupSlots: adminProcedure.query(async () => {
      if (!parcelking.isParcelKingConfigured()) {
        return { success: false, error: "Parcel King API key not configured", slots: [] };
      }
      try {
        const slots = await parcelking.getSpxPickupSlots();
        return { success: true, slots };
      } catch (error: any) {
        return { success: false, error: error.message, slots: [] };
      }
    }),
  }),

  // ===========================================================================
  // Payment Methods (付款方式设定)
  // ===========================================================================
  paymentMethods: router({
    list: adminProcedure.query(async () => {
      return await db.getPaymentMethods(true);
    }),
    
    listEnabled: publicProcedure.query(async () => {
      return await db.getPaymentMethods(false);
    }),
    
    getById: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return await db.getPaymentMethodById(input.id);
    }),
    
    create: adminProcedure.input(z.object({
      name: z.string(),
      type: z.enum(["qr_code", "bank_transfer", "cash", "other"]),
      qrImageUrl: z.string().optional(),
      bankName: z.string().optional(),
      accountHolder: z.string().optional(),
      accountNumber: z.string().optional(),
      paymentInstruction: z.string().optional(),
      remark: z.string().optional(),
      isEnabled: z.boolean().default(true),
      displayOrder: z.number().default(0),
    })).mutation(async ({ input }) => {
      return await db.createPaymentMethod(input);
    }),
    
    update: adminProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      type: z.enum(["qr_code", "bank_transfer", "cash", "other"]).optional(),
      qrImageUrl: z.string().nullable().optional(),
      bankName: z.string().nullable().optional(),
      accountHolder: z.string().nullable().optional(),
      accountNumber: z.string().nullable().optional(),
      paymentInstruction: z.string().nullable().optional(),
      remark: z.string().nullable().optional(),
      isEnabled: z.boolean().optional(),
      displayOrder: z.number().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      return await db.updatePaymentMethod(id, data);
    }),
    
    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deletePaymentMethod(input.id);
      return { success: true };
    }),
  }),

  // ===========================================================================
  // Order Status Workflow (订单状态流转)
  // ===========================================================================
  orderWorkflow: router({
    getStatusLogs: adminProcedure.input(z.object({ orderId: z.number() })).query(async ({ input }) => {
      return await db.getOrderStatusLogs(input.orderId);
    }),
    
    transition: adminProcedure.input(z.object({
      orderId: z.number(),
      toStatus: z.enum(["pending", "receipt_uploaded", "partial_payment", "hold_order", "packing", "shipped", "partial_shipped", "completed", "cancelled"]),
      notes: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const changedBy = ctx.user?.name || ctx.user?.openId || "admin";
      const result = await db.transitionOrderStatus(input.orderId, input.toStatus, changedBy, input.notes);
      return result;
    }),
    
    confirmPayment: adminProcedure.input(z.object({
      orderId: z.number(),
      hasHoldOrder: z.boolean(),
      notes: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const changedBy = ctx.user?.name || ctx.user?.openId || "admin";
      const toStatus = input.hasHoldOrder ? "hold_order" : "packing";
      const result = await db.transitionOrderStatus(input.orderId, toStatus, changedBy, input.notes || "Payment confirmed");
      return result;
    }),
  }),

  // ===========================================================================
  // Hold Orders (保留订单)
  // ===========================================================================
  holdOrders: router({
    getInfo: adminProcedure.input(z.object({ orderId: z.number() })).query(async ({ input }) => {
      return await db.getHoldOrderInfo(input.orderId);
    }),
    
    getActiveByCustomer: adminProcedure.input(z.object({ customerId: z.number() })).query(async ({ input }) => {
      return await db.getActiveHoldOrdersByCustomer(input.customerId);
    }),
    
    create: adminProcedure.input(z.object({
      orderId: z.number(),
      holdType: z.enum(["wait_next_live", "scheduled_shipping", "wait_stock", "other"]),
      scheduledShippingDate: z.number().optional(),
      allowAutoMerge: z.boolean().default(true),
      holdRemark: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const holdBy = ctx.user?.name || ctx.user?.openId || "admin";
      const holdOrder = await db.createHoldOrderInfo({
        orderId: input.orderId,
        holdType: input.holdType,
        scheduledShippingDate: input.scheduledShippingDate ? new Date(input.scheduledShippingDate) : null,
        allowAutoMerge: input.allowAutoMerge,
        holdRemark: input.holdRemark || null,
        holdBy,
      });
      await db.transitionOrderStatus(input.orderId, "hold_order", holdBy, "Hold order created");
      return holdOrder;
    }),
    
    release: adminProcedure.input(z.object({
      orderId: z.number(),
    })).mutation(async ({ input, ctx }) => {
      const releasedBy = ctx.user?.name || ctx.user?.openId || "admin";
      await db.releaseHoldOrder(input.orderId, releasedBy);
      // Transition to packing
      await db.transitionOrderStatus(input.orderId, "packing", releasedBy, "Hold released");
      return { success: true };
    }),
    
    findMergeable: adminProcedure.input(z.object({ customerId: z.number() })).query(async ({ input }) => {
      return await db.findMergeableHoldOrder(input.customerId);
    }),
  }),

  // ===========================================================================
  // Notification Logs (通知记录)
  // ===========================================================================
  notifications: router({
    list: adminProcedure.input(z.object({ orderId: z.number().optional() })).query(async ({ input }) => {
      return await db.getNotificationLogs(input.orderId);
    }),
    
    create: adminProcedure.input(z.object({
      orderId: z.number().optional(),
      customerId: z.number().optional(),
      type: z.string(),
      channel: z.enum(["messenger", "whatsapp", "email"]).default("messenger"),
      message: z.string().optional(),
    })).mutation(async ({ input }) => {
      return await db.createNotificationLog(input);
    }),
  }),

  // ===========================================================================
  // Mall Admin (商城管理 - Admin)
  // ===========================================================================
  mallAdmin: router({
    // Settings
    getSettings: adminProcedure.query(async () => {
      return await db.getMallSettings() || await db.createMallSettingsIfNotExists();
    }),
    updateSettings: adminProcedure.input(z.object({
      id: z.number(),
      shopName: z.string().optional(),
      domain: z.string().nullable().optional(),
      logoUrl: z.string().nullable().optional(),
      faviconUrl: z.string().nullable().optional(),
      slogan: z.string().nullable().optional(),
      seoTitle: z.string().nullable().optional(),
      seoDescription: z.string().nullable().optional(),
      facebookPixel: z.string().nullable().optional(),
      googleAnalytics: z.string().nullable().optional(),
      shippingPolicy: z.string().nullable().optional(),
      refundPolicy: z.string().nullable().optional(),
      serviceTerms: z.string().nullable().optional(),
      companyName: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      whatsapp: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      facebook: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      wazeLink: z.string().nullable().optional(),
      googleMapLink: z.string().nullable().optional(),
      activeTheme: z.string().optional(),
      customThemeColors: z.any().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      return await db.updateMallSettings(id, data);
    }),

    // Banners
    listBanners: adminProcedure.input(z.object({ type: z.string().optional() })).query(async ({ input }) => {
      return await db.getMallBanners(input.type);
    }),
    createBanner: adminProcedure.input(z.object({
      type: z.enum(["home_16x9", "home_9x16", "home_1x1", "marketing_16x9", "marketing_1x1", "marketing_9x16"]),
      imageUrl: z.string(),
      linkUrl: z.string().optional(),
      displayOrder: z.number().default(0),
      startDate: z.number().optional(),
      endDate: z.number().optional(),
      isEnabled: z.boolean().default(true),
    })).mutation(async ({ input }) => {
      return await db.createMallBanner({
        ...input,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
      });
    }),
    updateBanner: adminProcedure.input(z.object({
      id: z.number(),
      imageUrl: z.string().optional(),
      linkUrl: z.string().nullable().optional(),
      displayOrder: z.number().optional(),
      startDate: z.number().nullable().optional(),
      endDate: z.number().nullable().optional(),
      isEnabled: z.boolean().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      const cleanData: any = { ...data };
      if (data.startDate !== undefined) cleanData.startDate = data.startDate ? new Date(data.startDate) : null;
      if (data.endDate !== undefined) cleanData.endDate = data.endDate ? new Date(data.endDate) : null;
      await db.updateMallBanner(id, cleanData);
      return { success: true };
    }),
    deleteBanner: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteMallBanner(input.id);
      return { success: true };
    }),

    // Quick Contacts
    listQuickContacts: adminProcedure.query(async () => {
      return await db.getMallQuickContacts();
    }),
    createQuickContact: adminProcedure.input(z.object({
      type: z.enum(["whatsapp", "messenger", "facebook_page", "waze", "google_map"]),
      name: z.string(),
      imageUrl: z.string().optional(),
      linkUrl: z.string(),
      isEnabled: z.boolean().default(true),
      displayOrder: z.number().default(0),
    })).mutation(async ({ input }) => {
      return await db.createMallQuickContact(input);
    }),
    updateQuickContact: adminProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      imageUrl: z.string().nullable().optional(),
      linkUrl: z.string().optional(),
      isEnabled: z.boolean().optional(),
      displayOrder: z.number().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateMallQuickContact(id, data);
      return { success: true };
    }),
    deleteQuickContact: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteMallQuickContact(input.id);
      return { success: true };
    }),

    // Notices
    listNotices: adminProcedure.query(async () => {
      return await db.getMallNotices();
    }),
    createNotice: adminProcedure.input(z.object({
      announcement: z.string(),
      isEnabled: z.boolean().default(true),
      displayOrder: z.number().default(0),
    })).mutation(async ({ input }) => {
      return await db.createMallNotice(input);
    }),
    updateNotice: adminProcedure.input(z.object({
      id: z.number(),
      announcement: z.string().optional(),
      isEnabled: z.boolean().optional(),
      displayOrder: z.number().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateMallNotice(id, data);
      return { success: true };
    }),
    deleteNotice: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteMallNotice(input.id);
      return { success: true };
    }),

    // Theme Schedules
    listThemeSchedules: adminProcedure.query(async () => {
      return await db.getMallThemeSchedules();
    }),
    createThemeSchedule: adminProcedure.input(z.object({
      themeKey: z.string(),
      startDate: z.number(),
      endDate: z.number(),
      isEnabled: z.boolean().default(true),
    })).mutation(async ({ input }) => {
      return await db.createMallThemeSchedule({
        ...input,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
      });
    }),
    deleteThemeSchedule: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteMallThemeSchedule(input.id);
      return { success: true };
    }),

    // Product Detail Images
    listDetailImages: adminProcedure.input(z.object({ productId: z.number() })).query(async ({ input }) => {
      return await db.getMallProductDetailImages(input.productId);
    }),
    createDetailImage: adminProcedure.input(z.object({
      productId: z.number(),
      imageUrl: z.string(),
      displayOrder: z.number().default(0),
    })).mutation(async ({ input }) => {
      return await db.createMallProductDetailImage(input);
    }),
    deleteDetailImage: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteMallProductDetailImage(input.id);
      return { success: true };
    }),

    // Product Mall Sync
    updateProductSync: adminProcedure.input(z.object({
      productId: z.number(),
      syncToMall: z.boolean(),
    })).mutation(async ({ input }) => {
      await db.updateProductMallSync(input.productId, input.syncToMall);
      return { success: true };
    }),
  }),

  // ===========================================================================
  // Mall Public (商城公开接口)
  // ===========================================================================
  mall: router({
    // Get mall settings (public)
    settings: publicProcedure.query(async () => {
      const settings = await db.getMallSettings() || await db.createMallSettingsIfNotExists();
      // Don't expose analytics/pixel IDs to public
      const { facebookPixel, googleAnalytics, ...publicSettings } = settings as any;
      return publicSettings;
    }),

    // Get enabled banners (public)
    banners: publicProcedure.input(z.object({ type: z.string().optional() })).query(async ({ input }) => {
      return await db.getEnabledMallBanners(input.type);
    }),

    // Get enabled quick contacts (public)
    quickContacts: publicProcedure.query(async () => {
      return await db.getEnabledMallQuickContacts();
    }),

    // Get enabled notices (public)
    notices: publicProcedure.query(async () => {
      return await db.getEnabledMallNotices();
    }),

    // Get mall categories (public)
    categories: publicProcedure.query(async () => {
      return await db.getMallCategories();
    }),

    // Get mall products (public)
    products: publicProcedure.input(z.object({
      categoryId: z.number().optional(),
      search: z.string().optional(),
    })).query(async ({ input }) => {
      return await db.getMallProducts(input);
    }),

    // Get mall product detail (public)
    productDetail: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const product = await db.getMallProductById(input.id);
      if (!product) throw new Error("Product not found");
      const [productVariants, productImgs, detailImgs] = await Promise.all([
        db.getMallProductVariants(input.id),
        db.getMallProductImages(input.id),
        db.getMallProductDetailImages(input.id),
      ]);
      return {
        ...product,
        variants: productVariants,
        images: productImgs,
        detailImages: detailImgs,
      };
    }),

    // Checkout (public - guest checkout)
    checkout: publicProcedure.input(z.object({
      customerName: z.string(),
      contactNumber: z.string(),
      whatsappNumber: z.string().optional(),
      email: z.string().optional(),
      addressLine1: z.string(),
      addressLine2: z.string().optional(),
      postcode: z.string(),
      city: z.string(),
      state: z.string(),
      area: z.string(),
      deliveryRemark: z.string().optional(),
      shippingMethod: z.enum(["west_malaysia", "east_malaysia", "lalamove", "self_pickup"]),
      items: z.array(z.object({
        productId: z.number(),
        productName: z.string(),
        productSku: z.string().optional(),
        variationId: z.number().optional(),
        variationName: z.string().optional(),
        facebookKeyword: z.string().optional(),
        quantity: z.number().min(1),
        unitPrice: z.string(),
        subtotal: z.string(),
        discount: z.string().optional(),
        isSpecial: z.boolean().optional(),
        isStandalone: z.boolean().optional(),
      })),
      paymentMethodId: z.number().optional(),
      paymentMethodName: z.string().optional(),
      mergeIntoOrderId: z.number().optional(),
      repotPairs: z.array(z.object({
        plantProductId: z.number(),
        plantName: z.string(),
        potProductId: z.number(),
        potName: z.string(),
        quantity: z.number().min(1),
      })).optional(),
      customerRemark: z.string().optional(),
    })).mutation(async ({ input }) => {
      try {
        return await db.mallCheckout(input);
      } catch (error) {
        if (error instanceof Error && error.message === "Selected hold order is no longer available for this customer") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "该保留订单不可合并或不属于当前客户",
          });
        }
        throw error;
      }
    }),

    // Smart Paste (public)
    smartPaste: publicProcedure.input(z.object({ text: z.string() })).query(async ({ input }) => {
      return db.parseSmartPaste(input.text);
    }),

    // Order query (public - guest)
    queryOrder: publicProcedure.input(z.object({
      orderNumber: z.string(),
      contactNumber: z.string(),
    })).query(async ({ input }) => {
      const order = await db.queryOrderByNumber(input.orderNumber, input.contactNumber);
      if (!order) return null;
      const items = await db.getOrderItems(order.id);
      // Don't expose internal fields
      return {
        orderNumber: order.orderNumber,
        physicalStatus: order.physicalStatus,
        totalAmount: order.totalAmount,
        paidAmount: order.paidAmount,
        shippingMethod: order.shippingMethod,
        trackingNumber: order.trackingNumber,
        createdAt: order.createdAt,
        items: items.map((i: any) => ({
          productName: i.productName,
          variationName: i.variationName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          subtotal: i.subtotal,
        })),
      };
    }),

    // Upload payment receipt (public - guest)
    uploadReceipt: publicProcedure.input(z.object({
      orderNumber: z.string().min(1).max(50),
      contactNumber: z.string().min(1).max(50),
      receiptUrl: z.string().min(1).max(500),
      paymentMethodId: z.number().int().positive(),
    })).mutation(async ({ input }) => {
      if (!/^\/manus-storage\/uploads\/[A-Za-z0-9._/-]+$/.test(input.receiptUrl)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "付款凭证必须来自系统上传服务" });
      }

      const dbConn = await db.getDb();
      if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库暂时不可用" });
      const { orders: ordTable, customers: custTable } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const result = await dbConn.select().from(ordTable).where(eq(ordTable.orderNumber, input.orderNumber)).limit(1);
      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "订单不存在或联系电话不匹配" });
      }

      const customerResult = await dbConn.select().from(custTable).where(eq(custTable.id, result[0].customerId)).limit(1);
      if (customerResult.length === 0 || customerResult[0].phoneNumber !== input.contactNumber) {
        throw new TRPCError({ code: "NOT_FOUND", message: "订单不存在或联系电话不匹配" });
      }

      const paymentMethod = await db.getPaymentMethodById(input.paymentMethodId);
      if (!paymentMethod?.isEnabled) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请选择有效的付款方式" });
      }

      const permittedStatuses = ["pending", "partial_payment"];
      if (!permittedStatuses.includes(result[0].physicalStatus || "")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "当前订单状态不允许上传付款凭证" });
      }

      await db.transitionOrderStatus(result[0].id, "receipt_uploaded", "商城顾客", "顾客已上传付款凭证");
      await db.updateOrderStatus(result[0].id, {
        receiptUrl: input.receiptUrl,
        paymentMethodId: paymentMethod.id,
        paymentMethodName: paymentMethod.name,
      });
      return { success: true };
    }),

    // Find mergeable hold orders by customer phone (public)
    findMergeableOrders: publicProcedure.input(z.object({
      contactNumber: z.string(),
    })).query(async ({ input }) => {
      // Find customer by phone
      const dbConn = await db.getDb();
      if (!dbConn) return [];
      const { customers: custTable, holdOrderInfos: holdTable, orders: ordTable } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const customerResult = await dbConn.select().from(custTable).where(eq(custTable.phoneNumber, input.contactNumber)).limit(1);
      if (customerResult.length === 0) return [];
      const customerId = customerResult[0].id;
      return await db.getActiveHoldOrdersByCustomer(customerId);
    }),
  }),

  // ===========================================================================
  // Packing & Shipping (包货发货)
  // ===========================================================================
  packing: router({
    // Get orders by packing status
    list: shippingProcedure.input(z.object({
      status: z.enum(["packing", "shipped", "partial_shipped", "completed"]),
    })).query(async ({ input }) => {
      return await db.getPackingOrders(input.status);
    }),
    
    // Get packing detail
    detail: shippingProcedure.input(z.object({ orderId: z.number() })).query(async ({ input }) => {
      return await db.getPackingDetail(input.orderId);
    }),
    
    // Get A5 packing slip data
    slipData: shippingProcedure.input(z.object({ orderId: z.number() })).query(async ({ input }) => {
      return await db.getPackingSlipData(input.orderId);
    }),
  }),
  
  shipping: router({
    // Full shipping - all items in one or more packages
    fullShip: shippingProcedure.input(z.object({
      orderId: z.number(),
      packages: z.array(z.object({
        courier: z.string(),
        shippingType: z.enum(["auto", "manual"]),
        trackingNumber: z.string().optional(),
        shippingLabelUrl: z.string().optional(),
        providerOrderId: z.string().optional(),
        weight: z.string().optional(),
        shippingCost: z.string().optional(),
      })),
    })).mutation(async ({ input }) => {
      try {
        return await db.fullShipping(input.orderId, input.packages);
      } catch (error) {
        return rethrowPackingShippingError(error);
      }
    }),
    
    // Partial shipping - selected items only
    partialShip: shippingProcedure.input(z.object({
      orderId: z.number(),
      itemIds: z.array(z.number()),
      packageData: z.object({
        courier: z.string(),
        shippingType: z.enum(["auto", "manual"]),
        trackingNumber: z.string().optional(),
        shippingLabelUrl: z.string().optional(),
        providerOrderId: z.string().optional(),
        weight: z.string().optional(),
        shippingCost: z.string().optional(),
      }),
    })).mutation(async ({ input }) => {
      try {
        return await db.partialShipping(input.orderId, input.itemIds, input.packageData);
      } catch (error) {
        return rethrowPackingShippingError(error);
      }
    }),
    
    // Get packages for an order
    packages: shippingProcedure.input(z.object({ orderId: z.number() })).query(async ({ input }) => {
      return await db.getOrderPackages(input.orderId);
    }),
    
    // Create ParcelDaily shipment (auto)
    // Create ParcelKing shipment (auto tracking + label)
    createParcelKing: shippingProcedure.input(z.object({
      orderId: z.number(),
      serviceId: z.number(),
      weightKg: z.number(),
      content: z.string().optional(),
      contentValue: z.number().optional(),
      handoverMethod: z.enum(["pickup", "dropoff"]).optional(),
      pickupTime: z.number().optional(),
      pickupTimeRangeId: z.number().optional(),
      // For partial shipping: which item IDs go in this package
      itemIds: z.array(z.number()).optional(),
      isPartial: z.boolean().optional(),
    })).mutation(async ({ input }) => {
      if (!parcelking.isParcelKingConfigured()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Parcel King API key not configured" });
      }
      try {
        // Get order + customer + system settings
        const order = await db.getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "订单不存在" });

        const settings = await db.getSystemSettings();
        if (!settings || !settings.defaultShipFromAddress) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "系统设置中缺少发货地址" });
        }

        const customer = await db.getCustomerById(order.customerId);
        if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "客户不存在" });

        const senderPhone = parcelking.normalizePhone(settings.defaultShipFromPhone || settings.companyPhone || "");
        const recipientPhone = parcelking.normalizePhone(customer.phoneNumber || "");

        // Call ParcelKing API to create shipment
        const response = await parcelking.createOrder({
          service_id: input.serviceId,
          sender: {
            name: settings.defaultShipFromName || settings.companyName || "Store",
            phone: settings.defaultShipFromPhone || settings.companyPhone || "",
            dial_code: senderPhone.dial_code,
            mobile: senderPhone.mobile,
            line1: settings.defaultShipFromAddress || settings.companyAddress || "",
            city: settings.defaultShipFromCity || "",
            postcode: settings.defaultShipFromPostcode || "",
            state: settings.defaultShipFromState || "",
            country: "Malaysia",
          },
          recipient: {
            name: customer.name || customer.displayName || "Customer",
            phone: customer.phoneNumber || "",
            dial_code: recipientPhone.dial_code,
            mobile: recipientPhone.mobile,
            line1: order.shippingAddress || customer.address || "",
            city: customer.city || "",
            postcode: customer.postalCode || "",
            state: customer.state || "",
            country: "Malaysia",
          },
          parcel: {
            weight_kg: input.weightKg,
            name: input.content || "Goods",
            declared_value: input.contentValue,
          },
          delivery_options: input.handoverMethod ? {
            handover_method: input.handoverMethod,
            pickup_time: input.pickupTime,
            pickup_time_range_id: input.pickupTimeRangeId,
          } : undefined,
          reference: order.orderNumber,
        });

        const trackingNo = response.result.tracking_no;
        const labelUrl = response.result.label_url || null;
        const shippingCost = String(response.result.final_amount || 0);

        // Create package record in database
        if (input.isPartial && input.itemIds && input.itemIds.length > 0) {
          await db.partialShipping(input.orderId, input.itemIds, {
            courier: `ParcelKing #${input.serviceId}`,
            shippingType: "auto",
            trackingNumber: trackingNo,
            shippingLabelUrl: labelUrl || undefined,
            providerOrderId: trackingNo,
            weight: String(input.weightKg),
            shippingCost,
          });
        } else {
          await db.fullShipping(input.orderId, [{
            courier: `ParcelKing #${input.serviceId}`,
            shippingType: "auto",
            trackingNumber: trackingNo,
            shippingLabelUrl: labelUrl || undefined,
            providerOrderId: trackingNo,
            weight: String(input.weightKg),
            shippingCost,
          }]);
        }

        // Send Messenger notification with tracking number
        if (customer.messengerId && settings.notifyOnShipment) {
          try {
            const trackingMsg = `您的订单 ${order.orderNumber} 已发货！\n追踪号码: ${trackingNo}\n物流公司: ParcelKing\n您可在此查询物流状态: https://www.myparcelking.com/tracking/${trackingNo}`;
            await sendTextMessage(customer.messengerId, trackingMsg);
          } catch (msgError: any) {
            // Log but don't fail the shipment creation
            console.error('[ParcelKing] Messenger notification failed:', msgError.message);
          }
        }

        return {
          success: true,
          trackingNumber: trackingNo,
          labelUrl,
          shippingCost,
          testMode: response.result.test_mode,
        };
      } catch (error: any) {
        if (error instanceof ParcelKingError) {
          throw new TRPCError({
            code: error.statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "BAD_REQUEST",
            message: error.message,
          });
        }
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }
    }),

    // Re-download shipping label for an existing package
    redownloadLabel: shippingProcedure.input(z.object({
      trackingNo: z.string(),
    })).mutation(async ({ input }) => {
      if (!parcelking.isParcelKingConfigured()) {
        return { success: false, error: "Parcel King API key not configured" };
      }
      try {
        const url = await parcelking.getShippingLabelUrl(input.trackingNo);
        return { success: true, url };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),

    // Re-sync tracking from ParcelKing
    resyncTracking: shippingProcedure.input(z.object({
      trackingNo: z.string(),
      packageId: z.number(),
    })).mutation(async ({ input }) => {
      if (!parcelking.isParcelKingConfigured()) {
        return { success: false, error: "Parcel King API key not configured" };
      }
      try {
        const tracking = await parcelking.getTracking(input.trackingNo);
        const timeline = tracking.result.timeline || [];
        const latest = timeline[timeline.length - 1];

        let newStatus = "shipped";
        if (latest?.description?.toLowerCase().includes("deliver")) {
          newStatus = "delivered";
        }

        const dbAny = db as any;
        if (dbAny.updatePackageStatus) {
          await dbAny.updatePackageStatus(input.packageId, newStatus);
        }

        return { success: true, timeline, latestEvent: latest, newStatus };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),

    createParcelDaily: shippingProcedure.input(z.object({
      orderId: z.number(),
      weight: z.number(),
      courier: z.string().optional(),
    })).mutation(async ({ input }) => {
      // Get order details for shipping info
      const order = await db.getOrderById(input.orderId);
      if (!order) throw new Error("Order not found");
      
      // Call ParcelDaily API to create order
      // Note: ParcelDaily requires specific address format, this is a simplified version
      // In production, parse shippingAddress into components
      const result = await parceldaily.createOrder({
        serviceProvider: input.courier || "poslaju",
        pickupAddress: {
          fullName: "Xintian Nursery",
          phone: "",
          line1: "",
          city: "",
          postcode: "",
          state: "",
          country: "Malaysia",
        },
        clientAddress: {
          fullName: order.facebookName || "",
          phone: "",
          line1: order.shippingAddress || "",
          city: "",
          postcode: "",
          state: "",
          country: "Malaysia",
        },
        kg: input.weight,
        price: 0,
        content: "Plants",
        content_value: parseFloat(order.totalAmount || "0"),
        contentValueCurrency: "MYR",
        reference: order.orderNumber,
      });
      
      return result;
    }),
  }),
  
  // Customer order tracking (public)
  orderTracking: router({
    query: publicProcedure.input(z.object({
      orderNumber: z.string(),
      contactNumber: z.string().optional(),
    })).query(async ({ input }) => {
      return await db.getCustomerOrderTracking(input.orderNumber, input.contactNumber);
    }),
  }),
  
  // Live Order Capture (直播捉单)
  liveCapture: router({
    // Parse comment keywords (admin tool for testing)
    parse: adminProcedure.input(z.object({ comment: z.string() })).query(async ({ input }) => {
      const keywords = db.parseCommentKeywords(input.comment);
      const { matched, unmatched } = await db.matchKeywordsToProducts(keywords);
      return { keywords, matched, unmatched };
    }),
    
    // Create order from live capture
    createOrder: adminProcedure.input(z.object({
      commenterName: z.string(),
      commenterPsid: z.string().optional(),
      commentMessage: z.string(),
      commentId: z.string().optional(),
      postId: z.string().optional(),
      liveVideoId: z.string().optional(),
      matchedProducts: z.array(z.object({
        keyword: z.string(),
        quantity: z.number(),
        productId: z.number(),
        productName: z.string(),
        productSku: z.string(),
        unitPrice: z.string(),
      })),
      sourceName: z.string().optional(),
    })).mutation(async ({ input }) => {
      return await db.createOrderFromLiveCapture(input);
    }),
    
    // List captures (admin)
    list: adminProcedure.input(z.object({ limit: z.number().optional() })).query(async ({ input }) => {
      return await db.getLiveOrderCaptures(input.limit || 50);
    }),
  }),
  
  // ===========================================================================
  // V1.1: Dashboard V11 (仪表板 V1.1)
  // ===========================================================================
  dashboardV11: router({
    stats: adminProcedure.query(async () => {
      return await db.getDashboardV11Stats();
    }),
  }),

  // ===========================================================================
  // V1.1: Order Remarks (订单备注 - 3种类型)
  // ===========================================================================
  orderRemarks: router({
    list: adminProcedure.input(z.object({ orderId: z.number() })).query(async ({ input }) => {
      return await db.getOrderRemarks(input.orderId);
    }),
    create: adminProcedure.input(z.object({
      orderId: z.number(),
      type: z.enum(["live", "customer", "internal"]),
      content: z.string().min(1),
      createdBy: z.string().optional(),
      remarkCategory: z.enum(["repotting", "desired_delivery_date", "other"]).optional(),
      desiredDeliveryDate: z.string().optional(),
      desiredDeliveryReason: z.string().optional(),
      repottingData: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      await db.createOrderRemark({
        orderId: input.orderId,
        type: input.type,
        content: input.content,
        createdBy: input.createdBy || ctx.user?.name || undefined,
        remarkCategory: input.remarkCategory,
        desiredDeliveryDate: input.desiredDeliveryDate,
        desiredDeliveryReason: input.desiredDeliveryReason,
        repottingData: input.repottingData,
      });
      return { success: true };
    }),
    update: adminProcedure.input(z.object({
      id: z.number(),
      content: z.string().optional(),
      remarkCategory: z.enum(["repotting", "desired_delivery_date", "other"]).optional(),
      desiredDeliveryDate: z.string().optional(),
      desiredDeliveryReason: z.string().optional(),
      repottingData: z.string().optional(),
    })).mutation(async ({ input }) => {
      await db.updateOrderRemark(input.id, {
        content: input.content,
        remarkCategory: input.remarkCategory,
        desiredDeliveryDate: input.desiredDeliveryDate,
        desiredDeliveryReason: input.desiredDeliveryReason,
        repottingData: input.repottingData,
      });
      return { success: true };
    }),
    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteOrderRemark(input.id);
      return { success: true };
    }),
    // V3.0: Get orders with remarks for Dashboard
    ordersWithRemarks: adminProcedure.query(async () => {
      return await db.getOrdersWithRemarks();
    }),
    // V3.0: Get all remarks with order info
    allWithOrder: adminProcedure.input(z.object({ limit: z.number().optional() })).query(async ({ input }) => {
      return await db.getAllRemarksWithOrder(input.limit);
    }),
  }),

  // ===========================================================================
  // V1.1: Order Item Repots (换盆功能)
  // ===========================================================================
  repots: router({
    list: adminProcedure.input(z.object({ orderId: z.number() })).query(async ({ input }) => {
      return await db.getOrderItemRepots(input.orderId);
    }),
    create: adminProcedure.input(z.object({
      orderItemId: z.number(),
      orderId: z.number(),
      productId: z.number(),
      productName: z.string(),
      potProductId: z.number(),
      potProductName: z.string(),
      quantity: z.number().min(1),
    })).mutation(async ({ input }) => {
      await db.createOrderItemRepot(input);
      return { success: true };
    }),
    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteOrderItemRepot(input.id);
      return { success: true };
    }),
    potProducts: adminProcedure.query(async () => {
      return await db.getPotProducts();
    }),
  }),

  // ===========================================================================
  // V1.1: Scheduled Shipping (预约发货)
  // ===========================================================================
  scheduledShipping: router({
    setDate: adminProcedure.input(z.object({
      orderId: z.number(),
      date: z.string().nullable(),
    })).mutation(async ({ input }) => {
      const date = input.date ? new Date(input.date) : null;
      await db.setScheduledShippingDate(input.orderId, date);
      return { success: true };
    }),
    today: adminProcedure.query(async () => {
      return await db.getTodayScheduledShipping();
    }),
    list: adminProcedure.input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      return await db.getScheduledShippingOrders({
        dateFrom: input?.dateFrom ? new Date(input.dateFrom) : undefined,
        dateTo: input?.dateTo ? new Date(input.dateTo) : undefined,
      });
    }),
  }),

    // ===========================================================================
  // Dashboard (original)
  // ===========================================================================
  dashboard: router({
    stats: adminProcedure.query(async () => {
      return await db.getDashboardStats();
    }),
  }),

  // ===========================================================================
  // V1.2: Order Exceptions (订单异常处理)
  // ===========================================================================
  orderException: router({
    // List exceptions for an order
    list: protectedProcedure.input(z.object({ orderId: z.number() })).query(async ({ input }) => {
      return await db.getOrderExceptions(input.orderId);
    }),

    // Create a new exception
    create: protectedProcedure.input(z.object({
      orderId: z.number(),
      orderItemId: z.number().nullable().optional(),
      exceptionType: z.enum(["out_of_stock", "quality_issue", "overcharged_shipping", "other"]),
      description: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const userName = ctx.user?.name || ctx.user?.email || 'Unknown';
      return await db.createOrderException({
        orderId: input.orderId,
        orderItemId: input.orderItemId ?? null,
        exceptionType: input.exceptionType,
        description: input.description,
        createdBy: userName,
      });
    }),

    // Resolve an exception with a chosen resolution type
    resolve: protectedProcedure.input(z.object({
      exceptionId: z.number(),
      resolutionType: z.enum(["replace", "wait_restock", "refund"]),
      scrapCost: z.number().optional(),
      refundAmount: z.number().optional(),
      // For replacement: items to add as new order items
      replacementItems: z.array(z.object({
        productId: z.number(),
        productName: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        subtotal: z.number(),
      })).optional(),
      // Items to scrap (mark as quality scrap)
      scrapItems: z.array(z.object({
        orderItemId: z.number(),
        productId: z.number(),
        productName: z.string(),
        quantity: z.number(),
        unitCost: z.number().optional(),
      })).optional(),
      orderId: z.number(),
    })).mutation(async ({ input, ctx }) => {
      const userName = ctx.user?.name || ctx.user?.email || 'Unknown';

      // 1. Resolve the exception record
      const exception = await db.resolveOrderException(
        input.exceptionId,
        input.resolutionType,
        userName,
        input.scrapCost,
        input.refundAmount,
      );

      // 2. Handle scrap items (mark as scrapped, deduct stock, log inventory adjustment)
      if (input.scrapItems && input.scrapItems.length > 0) {
        for (const item of input.scrapItems) {
          // Create exception item record
          await db.createOrderExceptionItem({
            exceptionId: input.exceptionId,
            orderItemId: item.orderItemId,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitCost: item.unitCost ?? 0,
            totalScrapCost: (item.unitCost ?? 0) * item.quantity,
            isScrapped: true,
          });

          // Create inventory adjustment (stock reduction)
          await db.createInventoryAdjustment({
            productId: item.productId,
            adjustmentType: 'quality_issue',
            quantityChange: -item.quantity,
            unitCost: item.unitCost ?? 0,
            totalCost: (item.unitCost ?? 0) * item.quantity,
            orderExceptionId: input.exceptionId,
            adjustedBy: userName,
            reason: '植物品质异常报废',
          });
        }
      }

      // 3. Handle replacement items (add new order items, deduct stock)
      if (input.replacementItems && input.replacementItems.length > 0) {
        for (const item of input.replacementItems) {
          // Add new order item
          const dbAny = db as any;
          if (dbAny.addOrderItem) {
            await dbAny.addOrderItem({
              orderId: input.orderId,
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
            });
          }

          // Deduct stock for replacement product
          await db.createInventoryAdjustment({
            productId: item.productId,
            adjustmentType: 'other',
            quantityChange: -item.quantity,
            adjustedBy: userName,
            reason: '异常处理更换商品',
          });
        }

        // Recalculate order totals
        await db.recalculateOrderTotals(input.orderId);
      }

      return { success: true, exception };
    }),

    // Get replacements for an exception
    replacements: protectedProcedure.input(z.object({ exceptionId: z.number() })).query(async ({ input }) => {
      return await db.getOrderExceptionReplacements(input.exceptionId);
    }),
  }),

  // ===========================================================================
  // V1.2: Inventory Adjustments (库存手动扣减)
  // ===========================================================================
  inventoryAdjustment: router({
    // List adjustments
    list: adminProcedure.input(z.object({
      productId: z.number().optional(),
      adjustmentType: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      return await db.getInventoryAdjustments({
        productId: input?.productId,
        adjustmentType: input?.adjustmentType,
        dateFrom: input?.dateFrom ? new Date(input.dateFrom) : undefined,
        dateTo: input?.dateTo ? new Date(input.dateTo) : undefined,
      });
    }),

    // Create a manual stock adjustment
    create: protectedProcedure.input(z.object({
      productId: z.number(),
      adjustmentType: z.enum(["quality_issue", "plant_death", "pest_disease", "human_damage", "unhealthy", "lost", "other"]),
      quantityChange: z.number(),
      unitCost: z.number().optional(),
      totalCost: z.number().optional(),
      reason: z.string().optional(),
      remark: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const userName = ctx.user?.name || ctx.user?.email || 'Unknown';
      return await db.createInventoryAdjustment({
        productId: input.productId,
        adjustmentType: input.adjustmentType,
        quantityChange: input.quantityChange,
        unitCost: input.unitCost,
        totalCost: input.totalCost,
        adjustedBy: userName,
        reason: input.reason,
        remark: input.remark,
      });
    }),
  }),

  // ===========================================================================
  // V1.2: Profit Analysis Report (利润分析报告)
  // ===========================================================================
  profitAnalysis: router({
    report: adminProcedure.input(z.object({
      dateFrom: z.string(),
      dateTo: z.string(),
    })).query(async ({ input }) => {
      return await db.getProfitAnalysisReport({
        start: new Date(input.dateFrom),
        end: new Date(input.dateTo),
      });
    }),
  }),

  // ===========================================================================
  // V1.2: Loss Analysis Report (损耗分析报告)
  // ===========================================================================
  lossAnalysis: router({
    report: adminProcedure.input(z.object({
      dateFrom: z.string(),
      dateTo: z.string(),
    })).query(async ({ input }) => {
      return await db.getLossAnalysisReport({
        start: new Date(input.dateFrom),
        end: new Date(input.dateTo),
      });
    }),
  }),
  // ===========================================================================
  // V1.2: Shipping Fee & Special Orders (运费与特别订单)
  // ===========================================================================
  shippingV2: router({
    // Calculate shipping fee for checkout
    calculate: publicProcedure.input(z.object({
      items: z.array(z.object({
        productId: z.number(),
        quantity: z.number(),
        isStandalone: z.boolean().optional(),
      })),
    })).mutation(async ({ input }) => {
      // Fetch product details for each item
      const productDetails = await Promise.all(
        input.items.map(async (item) => {
          const product = await db.getProductByIdEnhanced(item.productId);
          return {
            ...item,
            product,
          };
        })
      );
      
      // Split items into normal and standalone
      const normalItems = productDetails.filter(i => !i.product?.allowStandaloneShipping);
      const standaloneItems = productDetails.filter(i => i.product?.allowStandaloneShipping);
      
      // Calculate normal items subtotal and weight
      const normalSubtotal = normalItems.reduce((sum, i) => sum + (Number(i.product?.sellingPrice || 0) * i.quantity), 0);
      const normalWeight = normalItems.reduce((sum, i) => sum + (Number(i.product?.weightKg || 0) * i.quantity), 0);
      
      // Calculate normal shipping
      const normalShipping = db.calculateNormalShippingFee(normalSubtotal, normalWeight);
      
      // Calculate standalone shipping for each standalone item
      const standaloneShipping = standaloneItems.map(i => ({
        productId: i.productId,
        method: i.product?.standaloneShippingMethod || "fixed_fee",
        fee: db.calculateStandaloneShippingFee(
          (i.product?.standaloneShippingMethod as "fixed_fee" | "free_shipping") || "fixed_fee",
          Number(i.product?.standaloneShippingFee || 0)
        ),
      }));
      
      const standaloneTotal = standaloneShipping.reduce((sum, s) => sum + s.fee, 0);
      const totalShipping = normalShipping.shippingFee + standaloneTotal;
      
      return {
        normalParcel: {
          itemsSubtotal: normalSubtotal,
          weight: normalWeight,
          shippingFee: normalShipping.shippingFee,
          isFreeShipping: normalShipping.isFreeShipping,
        },
        standaloneParcels: standaloneShipping,
        totalShipping,
        needsSplit: standaloneItems.length > 0 && normalItems.length > 0,
      };
    }),
    
    // Update actual weight for an order (packing stage)
    updateActualWeight: shippingProcedure.input(z.object({
      orderId: z.number(),
      actualWeight: z.number(),
    })).mutation(async ({ ctx, input }) => {
      // Get order details
      const order = await db.getOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      
      const itemsSubtotal = Number(order.physicalSubtotal || 0);
      const customerPaidShipping = Number(order.customerPaidShipping || order.shippingFee || 0);
      
      // Process actual weight
      const result = db.processActualWeight(
        input.actualWeight,
        customerPaidShipping,
        itemsSubtotal,
        false, // normal order (not standalone)
        null,
        0
      );
      
      // Update order with actual weight and shipping details
      await db.updateOrderActualWeight(
        input.orderId,
        input.actualWeight,
        result.actualShippingFee,
        result.difference,
        result.difference < 0 ? Math.abs(result.difference) : null, // shippingLoss
        result.difference > 0 ? result.difference : null, // shippingProfit (company profit from overcharge)
        result.needsSpecialOrder,
        result.specialOrderType
      );
      
      // If special order needed, create notification
      if (result.needsSpecialOrder) {
        await db.createSpecialOrderAction(
          input.orderId,
          "notify_shortage",
          Math.abs(result.difference),
          ctx.user?.name || "system",
          result.specialOrderType === "pending_shipping"
            ? `Need to collect RM${Math.abs(result.difference).toFixed(2)} additional shipping fee`
            : `Need to refund RM${Math.abs(result.difference).toFixed(2)} shipping fee`
        );
      }
      
      return {
        success: true,
        actualShippingFee: result.actualShippingFee,
        difference: result.difference,
        needsSpecialOrder: result.needsSpecialOrder,
        specialOrderType: result.specialOrderType,
      };
    }),
    
    // Get special orders list
    specialOrders: adminProcedure.input(z.object({
      status: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    })).query(async ({ input }) => {
      return await db.getSpecialOrders(input);
    }),
    
    // Get special order actions for an order
    specialOrderActions: protectedProcedure.input(z.object({
      orderId: z.number(),
    })).query(async ({ input }) => {
      return await db.getSpecialOrderActions(input.orderId);
    }),
    
    // Process special order action
    processSpecialOrder: shippingProcedure.input(z.object({
      orderId: z.number(),
      actionType: z.enum(["notify_shortage", "confirm_received", "refund", "company_bear", "remark"]),
      amount: z.number().optional(),
      remark: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      await db.createSpecialOrderAction(
        input.orderId,
        input.actionType,
        input.amount || 0,
        ctx.user?.name || "staff",
        input.remark
      );
      
      // If company_bear or confirm_received, resolve the special order
      if (input.actionType === "company_bear" || input.actionType === "confirm_received" || input.actionType === "refund") {
        const dbConn = await db.getDb();
        if (dbConn) {
          const { orders } = await import("../drizzle/schema");
          await dbConn.update(orders).set({
            specialOrderStatus: "resolved",
          }).where(eq(orders.id, input.orderId));
        }
      }
      
      return { success: true };
    }),
    
    // Get sub-orders for a parent order
    subOrders: protectedProcedure.input(z.object({
      parentOrderId: z.number(),
    })).query(async ({ input }) => {
            return await db.getSubOrders(input.parentOrderId);
    }),
  }),
  // ===========================================================================
  // V2.0: Live Rooms (直播房间)
  // ===========================================================================
  liveRooms: router({
    list: adminProcedure
      .input(z.object({
        status: z.enum(['preparing', 'live', 'ended', 'closed']).optional(),
        liveType: z.enum(['normal', 'import_preorder']).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getLiveRooms(input || {});
      }),

    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const room = await db.getLiveRoomById(input.id);
        if (!room) throw new Error('直播房间不存在');
        return room;
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        liveDate: z.coerce.date(),
        facebookLiveUrl: z.string().optional(),
        facebookVideoId: z.string().optional(),
        liveType: z.enum(['normal', 'import_preorder']).optional(),
        importBatchId: z.number().optional(),
        preorderStartDate: z.coerce.date().optional(),
        preorderEndDate: z.coerce.date().optional(),
        estimatedWaitDays: z.string().optional(),
        status: z.enum(['preparing', 'live', 'ended', 'closed']).optional(),
        notes: z.string().optional(),
        streamerName: z.string().optional(),
        facebookPageId: z.string().optional(),
        estimatedStartTime: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createLiveRoom(input);
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        liveDate: z.coerce.date().optional(),
        facebookLiveUrl: z.string().optional(),
        facebookVideoId: z.string().optional(),
        liveType: z.enum(['normal', 'import_preorder']).optional(),
        importBatchId: z.number().optional(),
        preorderStartDate: z.coerce.date().optional(),
        preorderEndDate: z.coerce.date().optional(),
        estimatedWaitDays: z.string().optional(),
        status: z.enum(['preparing', 'live', 'ended', 'closed']).optional(),
        notes: z.string().optional(),
        streamerName: z.string().optional(),
        facebookPageId: z.string().optional(),
        estimatedStartTime: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateLiveRoom(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteLiveRoom(input.id);
        return { success: true };
      }),

    // --- Live Room Products (直播商品) ---
    getProducts: adminProcedure
      .input(z.object({ liveRoomId: z.number() }))
      .query(async ({ input }) => {
        return await db.getLiveRoomProducts(input.liveRoomId);
      }),

    addProduct: adminProcedure
      .input(z.object({
        liveRoomId: z.number(),
        productId: z.number(),
        variationId: z.number().optional(),
        keyword: z.string().min(1),
        displayName: z.string().min(1),
        price: z.union([z.string(), z.number()]),
        stock: z.number().default(0),
        imageUrl: z.string().optional(),
        specImage: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.addLiveRoomProduct(input);
      }),

    updateProduct: adminProcedure
      .input(z.object({
        id: z.number(),
        keyword: z.string().optional(),
        displayName: z.string().optional(),
        price: z.union([z.string(), z.number()]).optional(),
        stock: z.number().optional(),
        status: z.enum(['active', 'paused', 'sold_out']).optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateLiveRoomProduct(id, data);
        return { success: true };
      }),

    deleteProduct: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteLiveRoomProduct(input.id);
        return { success: true };
      }),

    adjustProductStock: adminProcedure
      .input(z.object({
        id: z.number(),
        quantityChange: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.adjustLiveRoomProductStock(input.id, input);
      }),

    reorderProducts: adminProcedure
      .input(z.object({
        liveRoomId: z.number(),
        orderedIds: z.array(z.number()),
      }))
      .mutation(async ({ input }) => {
        return await db.reorderLiveRoomProducts(input.liveRoomId, input.orderedIds);
      }),

    // --- Live Room Stats (业绩统计) ---
    getStats: adminProcedure
      .input(z.object({ liveRoomId: z.number() }))
      .query(async ({ input }) => {
        return await db.getLiveRoomStats(input.liveRoomId);
      }),

    getStatsBatch: adminProcedure
      .input(z.object({ liveRoomIds: z.array(z.number()) }))
      .query(async ({ input }) => {
        return await db.getLiveRoomStatsBatch(input.liveRoomIds);
      }),

    // --- Keyword Copy (关键词复制) ---
    copyKeyword: adminProcedure
      .input(z.object({ liveRoomProductId: z.number() }))
      .query(async ({ input }) => {
        // Get live comment footer from system settings
        const settings = await db.getSystemSettings();
        const footer = settings?.liveCommentFooter || '👇 留言关键词即可自动下单';
        return await db.generateKeywordCopyText(input.liveRoomProductId, footer);
      }),

    // --- Live Orders (直播订单) ---
    getOrders: adminProcedure
      .input(z.object({ liveRoomId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.getLiveRoomOrders(input.liveRoomId, input.limit || 100);
      }),

    getOrdersByProduct: adminProcedure
      .input(z.object({ liveRoomId: z.number() }))
      .query(async ({ input }) => {
        return await db.getLiveRoomOrdersByProduct(input.liveRoomId);
      }),

    // --- Product Search & Batch Add ---
    searchProducts: adminProcedure
      .input(z.object({ liveRoomId: z.number(), query: z.string(), categoryId: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.searchProductsForLiveRoom(input.liveRoomId, input.query, input.categoryId);
      }),

    batchAddProducts: adminProcedure
      .input(z.object({
        liveRoomId: z.number(),
        items: z.array(z.object({
          productId: z.number(),
          variationId: z.number().optional(),
          keyword: z.string(),
          displayName: z.string(),
          price: z.union([z.string(), z.number()]),
          stock: z.number().default(0),
          imageUrl: z.string().optional(),
          specImage: z.string().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        return await db.batchAddProductsToLiveRoom(input.liveRoomId, input.items as any);
      }),

    // --- Preorder Toggle ---
    togglePreorder: adminProcedure
      .input(z.object({ id: z.number(), allowPreorder: z.boolean() }))
      .mutation(async ({ input }) => {
        return await db.toggleLiveRoomProductPreorder(input.id, input.allowPreorder);
      }),

    // --- Live Comments (直播留言) ---
    getComments: adminProcedure
      .input(z.object({
        liveRoomId: z.number(),
        search: z.string().optional(),
        matchResult: z.string().optional(),
        messengerStatus: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getLiveComments(input.liveRoomId, input);
      }),

    getCommentStats: adminProcedure
      .input(z.object({ liveRoomId: z.number() }))
      .query(async ({ input }) => {
        return await db.getLiveCommentStats(input.liveRoomId);
      }),

    updateCommentMessengerStatus: adminProcedure
      .input(z.object({ commentId: z.number(), status: z.string(), error: z.string().optional() }))
      .mutation(async ({ input }) => {
        return await db.updateLiveCommentMessengerStatus(input.commentId, input.status, input.error);
      }),

    markCommentHandled: adminProcedure
      .input(z.object({ commentId: z.number() }))
      .mutation(async ({ input }) => {
        return await db.markLiveCommentHandled(input.commentId);
      }),

    // --- Live Room Report (直播报告) ---
    getReport: adminProcedure
      .input(z.object({ liveRoomId: z.number() }))
      .query(async ({ input }) => {
        return await db.getLiveRoomReport(input.liveRoomId);
      }),

    // --- End Live (直播结束) ---
    endLive: adminProcedure
      .input(z.object({ liveRoomId: z.number() }))
      .mutation(async ({ input }) => {
        // Set status to ended
        await db.updateLiveRoom(input.liveRoomId, { status: 'ended' } as any);
        return { success: true };
      }),
  }),

  // ===========================================================================
  // V2.0: Import Batches (采购批次)
  // ===========================================================================
  importBatches: router({
    list: adminProcedure
      .input(z.object({
        status: z.enum(['in_progress', 'closed', 'purchased', 'preparing', 'in_transit', 'partial_arrived', 'all_arrived', 'completed']).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getImportBatches(input || {});
      }),

    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const batch = await db.getImportBatchById(input.id);
        if (!batch) throw new Error('采购批次不存在');
        return batch;
      }),

    create: adminProcedure
      .input(z.object({
        batchNumber: z.string().min(1),
        batchName: z.string().min(1),
        sourceCountry: z.string().optional(),
        supplierName: z.string().optional(),
        liveRoomId: z.number().optional(),
        preorderStartDate: z.coerce.date().optional(),
        preorderEndDate: z.coerce.date().optional(),
        shippingMethod: z.enum(['air', 'sea']).optional(),
        chinaShippingCost: z.string().optional(),
        status: z.enum(['in_progress', 'closed', 'purchased', 'preparing', 'in_transit', 'partial_arrived', 'all_arrived', 'completed']).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createImportBatch(input);
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        batchName: z.string().optional(),
        sourceCountry: z.string().optional(),
        supplierName: z.string().optional(),
        liveRoomId: z.number().optional(),
        preorderStartDate: z.coerce.date().optional(),
        preorderEndDate: z.coerce.date().optional(),
        actualPurchaseDate: z.coerce.date().optional(),
        shippingMethod: z.enum(['air', 'sea']).optional(),
        chinaShippingCost: z.string().optional(),
        status: z.enum(['in_progress', 'closed', 'purchased', 'preparing', 'in_transit', 'partial_arrived', 'all_arrived', 'completed']).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateImportBatch(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteImportBatch(input.id);
        return { success: true };
      }),

    // Get batch items (采购汇总)
    items: adminProcedure
      .input(z.object({ batchId: z.number() }))
      .query(async ({ input }) => {
        return await db.getImportBatchItems(input.batchId);
      }),

    // Upsert batch item (add/update product in batch)
    upsertItem: adminProcedure
      .input(z.object({
        batchId: z.number(),
        productId: z.number(),
        productName: z.string(),
        variantId: z.number().optional(),
        variantName: z.string().optional(),
        paidQuantity: z.number().optional(),
        finalPurchaseQuantity: z.number().optional(),
        actualReceivedQty: z.number().optional(),
        healthyQty: z.number().optional(),
        damagedQty: z.number().optional(),
        deadQty: z.number().optional(),
        missingQty: z.number().optional(),
        itemStatus: z.enum(['pending', 'all_arrived', 'partial_arrived', 'shortage', 'damaged', 'dead', 'missing']).optional(),
        unitPurchaseCost: z.string().optional(),
        spotSaleEnabled: z.boolean().optional(),
        spotSaleQty: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.upsertImportBatchItem(input);
      }),

    // Delete batch item
    deleteItem: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteImportBatchItem(input.id);
        return { success: true };
      }),

    // Allocate shipping cost to items
    allocateShipping: adminProcedure
      .input(z.object({ batchId: z.number() }))
      .mutation(async ({ input }) => {
        return await db.allocateShippingCost(input.batchId);
      }),
  }),

  // ===========================================================================
    // V2.0: Import Preorder Dashboard & Reports
  // ===========================================================================
  importPreorder: router({
    stats: adminProcedure.query(async () => {
      return await db.getImportPreorderStats();
    }),
    profitAnalysis: adminProcedure
      .input(z.object({
        batchId: z.number().optional(),
        liveRoomId: z.number().optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getImportPreorderProfitAnalysis(input || {});
      }),
  }),

  // ===========================================================================
  // V3.1: Product Bundles (组合包管理)
  // ===========================================================================
  productBundles: router({
    list: adminProcedure
      .input(z.object({
        status: z.string().optional(),
        showInMall: z.boolean().optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getProductBundles(input || {});
      }),

    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
 const bundle = await db.getBundleById(input.id);
        if (!bundle) throw new Error("Bundle not found");
        return bundle;
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string(),
        nameEn: z.string().optional(),
        keyword: z.string(),
        sellingPrice: z.string(),
        originalTotalPrice: z.string().optional(),
        specialPrice: z.string().optional(),
        coverImage: z.string().optional(),
        description: z.string().optional(),
        status: z.string().optional(),
        showInMall: z.boolean().optional(),
        weight: z.string().optional(),
        internalNotes: z.string().optional(),
        items: z.array(z.object({
          productId: z.number(),
          variantId: z.number().optional(),
          productName: z.string(),
          variantName: z.string().optional(),
          qtyPerBundle: z.number(),
          unitCost: z.string(),
          unitPrice: z.string(),
        })),
        bundleQty: z.number(),
        operator: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createBundleWithStock(input);
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        nameEn: z.string().optional(),
        keyword: z.string().optional(),
        sellingPrice: z.string().optional(),
        originalTotalPrice: z.string().optional(),
        specialPrice: z.string().optional(),
        coverImage: z.string().optional(),
        description: z.string().optional(),
        status: z.string().optional(),
        showInMall: z.boolean().optional(),
        weight: z.string().optional(),
        internalNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateBundle(id, data);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteBundle(input.id);
      }),

    restock: adminProcedure
      .input(z.object({
        bundleId: z.number(),
        restockQty: z.number(),
        operator: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.restockBundle(input);
      }),

    disassemble: adminProcedure
      .input(z.object({
        bundleId: z.number(),
        disassembleQty: z.number(),
        reason: z.string(),
        damagedProducts: z.array(z.number()).optional(),
        operator: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.disassembleBundle(input);
      }),

    stockLogs: adminProcedure
      .input(z.object({ bundleId: z.number() }))
      .query(async ({ input }) => {
        return await db.getBundleStockLogs(input.bundleId);
      }),

    calculateMax: adminProcedure
      .input(z.object({
        items: z.array(z.object({
          productId: z.number(),
          qtyPerBundle: z.number(),
        })),
      }))
      .query(async ({ input }) => {
        return await db.calculateMaxBundleQty(input.items);
      }),

    mallList: publicProcedure
      .query(async () => {
        return await db.getMallBundles();
      }),

    profitAnalysis: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getBundleProfitAnalysis(input || {});
      }),
  }),

  // ===========================================================================
  // V2.0 Phase 2.5: Live AI Flows (直播 AI 客服)
  // ===========================================================================
  liveAiFlows: router({
    list: adminProcedure
      .query(async () => {
        return await db.getLiveAiFlows();
      }),
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getLiveAiFlowById(input.id);
      }),
    create: adminProcedure
      .input(z.object({
        name: z.string(),
        triggerKeywords: z.string(),
        replyContent: z.string(),
        isEnabled: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createLiveAiFlow(input);
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        triggerKeywords: z.string().optional(),
        replyContent: z.string().optional(),
        isEnabled: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.updateLiveAiFlow(input.id, input);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteLiveAiFlow(input.id);
      }),
    duplicate: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.duplicateLiveAiFlow(input.id);
      }),
    reorder: adminProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        return await db.reorderLiveAiFlows(input.ids);
      }),
    match: publicProcedure
      .input(z.object({ message: z.string() }))
      .query(async ({ input }) => {
        const reply = await db.matchLiveAiFlow(input.message);
        return { matched: reply !== null, reply };
      }),
  }),

  // ===========================================================================
  // V4.0: AI Customer Service — Chat & Handover
  // ===========================================================================
  chat: router({
    listConversations: adminProcedure
      .input(z.object({
        platform: z.string().optional(),
        unreadOnly: z.boolean().optional(),
        needsHuman: z.boolean().optional(),
        aiDisabled: z.boolean().optional(),
        hasOrder: z.boolean().optional(),
        search: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.listChatConversations(input);
      }),

    getMessages: adminProcedure
      .input(z.object({
        conversationId: z.number(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getChatMessages(input.conversationId, input.limit || 100, input.offset || 0);
      }),

    sendMessage: adminProcedure
      .input(z.object({
        conversationId: z.number(),
        content: z.string(),
        messageType: z.enum(["text", "image", "file"]).default("text"),
        mediaUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const operatorName = ctx.user?.name || "Staff";

        // Store message in DB
        await db.addChatMessage({
          conversationId: input.conversationId,
          senderType: "staff",
          senderName: operatorName,
          messageType: input.messageType,
          content: input.content,
          mediaUrl: input.mediaUrl,
          status: "sent",
        });

        // Get conversation to find platform info
        const allConvs = await db.listChatConversations({ limit: 500 });
        const conv = allConvs.find((c: any) => c.id === input.conversationId);
        if (!conv) throw new Error("Conversation not found");

        // Send via Messenger API if platform is messenger
        if (conv.platform === "messenger" && conv.platformId) {
          try {
            await sendTextMessage(conv.platformId, input.content);
          } catch (err: any) {
            await db.addChatMessage({
              conversationId: input.conversationId,
              senderType: "system",
              messageType: "text",
              content: `[Send failed: ${err.message}]`,
              status: "failed",
              errorMessage: err.message,
            });
            throw new Error(`Failed to send via Messenger: ${err.message}`);
          }
        } else if (conv.platform === "whatsapp") {
          await db.addChatMessage({
            conversationId: input.conversationId,
            senderType: "system",
            messageType: "text",
            content: "[WhatsApp API not yet configured — message stored in system only]",
            status: "failed",
            errorMessage: "WhatsApp API not configured",
          });
        }

        return { success: true };
      }),

    markRead: adminProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ input }) => {
        await db.markConversationRead(input.conversationId);
        return { success: true };
      }),

    toggleAI: adminProcedure
      .input(z.object({
        conversationId: z.number(),
        enabled: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        const operatorName = ctx.user?.name || "Staff";
        await db.toggleConversationAI(input.conversationId, input.enabled, operatorName);
        return { success: true };
      }),

    handover: adminProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const operatorName = ctx.user?.name || "Staff";
        await db.claimHandover(input.conversationId, operatorName);
        return { success: true };
      }),

    resumeAI: adminProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const operatorName = ctx.user?.name || "Staff";
        await db.resumeConversationAI(input.conversationId, operatorName);
        return { success: true };
      }),

    getCustomerInfo: adminProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return await db.getChatCustomerInfo(input.customerId);
      }),
  }),

  aiHandover: router({
    list: adminProcedure
      .input(z.object({
        status: z.enum(["pending", "claimed", "all"]).default("pending"),
      }))
      .query(async ({ input }) => {
        const status = input.status === "all" ? undefined : input.status;
        return await db.listHandoverRequests(status);
      }),

    getStats: adminProcedure
      .query(async () => {
        return await db.getHandoverStats();
      }),

    claim: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const operatorName = ctx.user?.name || "Staff";
        const requests = await db.listHandoverRequests("pending");
        const req = requests.find((r: any) => r.id === input.id);
        if (!req) throw new Error("Handover request not found");
        if (req.conversationId) {
          await db.claimHandover(req.conversationId, operatorName);
        }
        return { success: true };
      }),
  }),

  // =========================================================================
  // AI Engine — Reply Rules Management (Admin-maintained fixed replies)
  // =========================================================================
  replyRules: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllReplyRules();
    }),
    create: protectedProcedure.input(z.object({
      name: z.string(),
      triggerKeywords: z.string(),
      replyContent: z.string(),
      priority: z.number().optional(),
      channels: z.string().optional(),
      isEnabled: z.boolean().optional(),
    })).mutation(async ({ input }) => {
      return await db.createReplyRule(input);
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      triggerKeywords: z.string().optional(),
      replyContent: z.string().optional(),
      priority: z.number().optional(),
      channels: z.string().optional(),
      isEnabled: z.boolean().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      return await db.updateReplyRule(id, data);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      return await db.deleteReplyRule(input.id);
    }),
  }),

  // =========================================================================
  // AI Engine — Knowledge Base Management (Admin-maintained AI knowledge)
  // =========================================================================
  aiKnowledge: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllAiKnowledge();
    }),
    create: protectedProcedure.input(z.object({
      category: z.string(),
      topic: z.string(),
      triggerKeywords: z.string(),
      content: z.string(),
      priority: z.number().optional(),
      useLLM: z.boolean().optional(),
      isEnabled: z.boolean().optional(),
    })).mutation(async ({ input }) => {
      return await db.createAiKnowledge(input);
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      category: z.string().optional(),
      topic: z.string().optional(),
      triggerKeywords: z.string().optional(),
      content: z.string().optional(),
      priority: z.number().optional(),
      useLLM: z.boolean().optional(),
      isEnabled: z.boolean().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      return await db.updateAiKnowledge(id, data);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      return await db.deleteAiKnowledge(input.id);
    }),
  }),

  // =========================================================================
  // AI Brain — Central management hub for all AI features
  // =========================================================================
  aiBrain: router({
    getStatus: adminProcedure.query(async () => {
      return await db.getAiBrainStatus();
    }),

    getStats: adminProcedure.query(async () => {
      return await db.getAiBrainStats();
    }),

    getAlerts: adminProcedure.query(async () => {
      return await db.getAiBrainAlerts();
    }),

    getPersona: adminProcedure.query(async () => {
      return await db.getAiPersona();
    }),

    updatePersona: adminProcedure.input(z.object({
      aiName: z.string().optional(),
      brandName: z.string().optional(),
      aiSelfReference: z.string().optional(),
      customerAddress: z.string().optional(),
      replyTone: z.string().optional(),
      defaultLanguage: z.string().optional(),
      supportedLanguages: z.string().optional(),
      emojiLevel: z.string().optional(),
      replyLength: z.string().optional(),
      proactiveRecommend: z.boolean().optional(),
      proactiveInquire: z.boolean().optional(),
      enableCTA: z.boolean().optional(),
      ctaTemplate: z.string().optional(),
      customPrompt: z.string().optional(),
      replyPrinciples: z.string().optional(),
    })).mutation(async ({ input }) => {
      return await db.updateAiPersona(input);
    }),

    previewReply: adminProcedure
      .input(z.object({
        userMessage: z.string().min(1),
        // Preview may use the form's unsaved state. This remains simulation-only
        // and never persists or sends a message to a customer.
        personaOverride: z.object({
          aiName: z.string().optional(),
          brandName: z.string().optional(),
          aiSelfReference: z.string().optional(),
          customerAddress: z.string().optional(),
          replyTone: z.string().optional(),
          defaultLanguage: z.string().optional(),
          supportedLanguages: z.string().optional(),
          emojiLevel: z.string().optional(),
          replyLength: z.string().optional(),
          proactiveRecommend: z.boolean().optional(),
          proactiveInquire: z.boolean().optional(),
          enableCTA: z.boolean().optional(),
          ctaTemplate: z.string().optional(),
          customPrompt: z.string().optional(),
          replyPrinciples: z.string().optional(),
        }).partial().optional(),
      }))
      .mutation(async ({ input }) => {
        const savedPersona = await db.getAiPersona();
        if (!savedPersona) {
          return { reply: "请先设置 AI 人设后再进行预览。" };
        }
        const persona = { ...savedPersona, ...input.personaOverride };

        // Build system prompt from persona settings
        const toneMap: Record<string, string> = {
          warm: "温暖亲切",
          friendly: "友善轻松",
          professional: "专业正式",
          casual: "随性自然",
        };
        const lengthMap: Record<string, string> = {
          short: "简短（1-2句话）",
          medium: "适中（3-5句话）",
          long: "详细（5句以上）",
        };
        const emojiMap: Record<string, string> = {
          none: "不使用 emoji",
          low: "少量 emoji",
          medium: "适度 emoji",
          high: "多使用 emoji",
        };

        const supportedLangs = (() => {
          try { return JSON.parse(persona.supportedLanguages || '[]') as string[]; } catch { return ['zh']; }
        })();

        const systemPrompt = `你是${persona.aiName}，${persona.brandName}的AI客服助手。

人设要求：
- 自称：${persona.aiSelfReference}
- 称呼客户：${persona.customerAddress}
- 语气：${toneMap[persona.replyTone] || persona.replyTone}
- 回复长度：${lengthMap[persona.replyLength] || persona.replyLength}
- Emoji 使用：${emojiMap[persona.emojiLevel] || persona.emojiLevel}
- 默认语言：${persona.defaultLanguage === 'zh' ? '中文' : persona.defaultLanguage === 'en' ? 'English' : persona.defaultLanguage}
- 支持语言：${supportedLangs.join(', ')}
${persona.proactiveRecommend ? '- 主动推荐适合的商品\n' : ''}${persona.proactiveInquire ? '- 主动询问客户需求\n' : ''}${persona.enableCTA && persona.ctaTemplate ? `- 回复结束语：${persona.ctaTemplate}\n` : ''}${persona.replyPrinciples ? `\n不可违反的 AI回复原则（最高优先级；如与前述人设字段冲突，以本区原则为准）：\n${persona.replyPrinciples}\n请逐条严格遵守这些原则。\n` : ''}${persona.customPrompt ? `\n额外要求：\n${persona.customPrompt}\n` : ''}
注意：这是模拟预览，不要提及你是AI模型或ChatGPT。直接以${persona.aiName}的身份回复。`;

        try {
          const { invokeLLM } = await import("./_core/llm");
          // Claude Haiku provides low-latency text output for this interactive
          // preview. GPT-5 may spend the small output budget on reasoning first,
          // which can leave the visible reply empty when max_tokens is capped.
          const result = await invokeLLM({
            model: "claude-haiku-4-5",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: input.userMessage },
            ],
            maxTokens: 500,
          });
          const content = result.choices?.[0]?.message?.content;
          const reply = Array.isArray(content)
            ? content
                .filter((part): part is { type: "text"; text: string } => part.type === "text")
                .map(part => part.text)
                .join("\n")
                .trim()
            : typeof content === "string"
              ? content.trim()
              : "";
          if (!reply) {
            throw new Error("预览模型未生成可用文本，请稍后重试。");
          }
          return { reply };
        } catch (err: any) {
          return { reply: `预览生成失败：${err.message || "未知错误"}` };
        }
      }),
  }),

  // ============================================================================
  // AI Log Center — Phase 2 Task 1
  // ============================================================================
  aiLog: router({
    list: adminProcedure
      .input(z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        customerName: z.string().optional(),
        platform: z.string().optional(),
        sourceType: z.enum(["private_chat", "facebook_live", "facebook_post", "facebook_reel"]).optional(),
        finalSource: z.string().optional(),
        sendStatus: z.string().optional(),
        isHandover: z.boolean().optional(),
        errorStage: z.string().optional(),
        keyword: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return db.getAiLogs(input);
      }),

    getDetail: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const detail = await db.getAiLogDetail(input.id);
        if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "日志不存在" });
        return detail;
      }),

    retryDelivery: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        try {
          return await retryFailedAiLogDelivery(input.id);
        } catch (error: any) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error?.message ?? "AI日志重试失败",
          });
        }
      }),

    getStats: adminProcedure
      .input(z.object({ days: z.number().min(1).max(365).default(1) }))
      .query(async ({ input }) => {
        return db.getAiLogStats(input.days);
      }),

    getCleanupPreview: adminProcedure
      .query(async () => {
        const stats = await db.getAiLogStats(9999);
        const retentionDays = (await import('./_core/env')).ENV.aiLogRetentionDays;
        return {
          totalLogs: stats.total,
          retentionDays,
          message: `当前保留 ${retentionDays} 天，超过的日志将被自动清理`,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
