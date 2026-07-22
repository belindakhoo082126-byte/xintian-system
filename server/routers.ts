import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { eq } from "drizzle-orm";
import { variants } from "../drizzle/schema";
import { sendTelegramJoinFlow, sendMembershipFlow, getUserProfile, sendTextMessage } from "./messenger";
import * as parceldaily from "./parceldaily";
import * as shippingProvider from "./shippingProvider";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ===========================================================================
  // Products
  // ===========================================================================
  products: router({
    list: protectedProcedure
      .input(z.object({
        type: z.enum(["physical", "membership", "gift"]).optional(),
        search: z.string().optional(),
        isListed: z.boolean().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getProducts(input || {});
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const product = await db.getProductById(input.id);
        if (!product) throw new Error("Product not found");
        return product;
      }),

    create: protectedProcedure
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

    update: protectedProcedure
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

    delete: protectedProcedure
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
    list: protectedProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getProductCategories(input?.activeOnly);
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        parentId: z.number().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createProductCategory(input as any);
      }),

    update: protectedProcedure
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

    delete: protectedProcedure
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
    list: protectedProcedure
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

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const category = await db.getCategoryById(input.id);
        if (!category) throw new Error('分类不存在');
        const productCount = await db.countProductsInCategory(input.id);
        return { ...category, productCount };
      }),

    create: protectedProcedure
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

    update: protectedProcedure
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

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteCategory(input.id);
      }),

    reorder: protectedProcedure
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
    list: protectedProcedure.query(async () => {
      return await db.getAllUnits();
    }),

    create: protectedProcedure
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
    list: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        categoryId: z.number().optional(),
        status: z.enum(['draft', 'active', 'inactive', 'out_of_stock']).optional(),
        productMode: z.enum(['simple', 'variant']).optional(),
        visibility: z.enum(['public', 'link_only', 'hidden']).optional(),
        type: z.enum(['physical', 'membership', 'gift']).optional(),
        isFeatured: z.boolean().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getProductsEnhanced(input || {});
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const product = await db.getProductByIdEnhanced(input.id);
        if (!product) throw new Error('商品不存在');
        return product;
      }),

    create: protectedProcedure
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
        estimatedCost: z.string().optional(),
        currentCost: z.string().optional(),
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
      }))
      .mutation(async ({ input }) => {
        // Check keyword conflict
        const conflict = await db.checkKeywordConflict(input.keyword);
        if (!conflict.available) {
          throw new Error(`关键词「${input.keyword}」已被商品「${conflict.conflictWith?.name}」使用`);
        }
        return await db.createProductEnhanced(input);
      }),

    update: protectedProcedure
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
        estimatedCost: z.string().optional(),
        currentCost: z.string().optional(),
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

    setStatus: protectedProcedure
      .input(z.object({ id: z.number(), status: z.enum(['draft', 'active', 'inactive', 'out_of_stock']) }))
      .mutation(async ({ input }) => {
        await db.updateProductEnhanced(input.id, { status: input.status });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteProductEnhanced(input.id);
      }),

    duplicate: protectedProcedure
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
          estimatedCost: product.estimatedCost ?? undefined,
          currentCost: product.currentCost ?? undefined,
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

    checkKeyword: protectedProcedure
      .input(z.object({ keyword: z.string().min(1), excludeProductId: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.checkKeywordConflict(input.keyword, input.excludeProductId);
      }),

    checkVariantKeyword: protectedProcedure
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
    create: protectedProcedure
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

    update: protectedProcedure
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

    delete: protectedProcedure
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
    generate: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .mutation(async ({ input }) => {
        return await db.generateMemberLink(input.productId);
      }),

    list: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        return await db.getMemberLinksByProductId(input.productId);
      }),

    deactivate: protectedProcedure
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
    add: protectedProcedure
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

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProductImage(input.id);
        return { success: true };
      }),

    updateOrder: protectedProcedure
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
    add: protectedProcedure
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

    delete: protectedProcedure
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
    add: protectedProcedure
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

    delete: protectedProcedure
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
    list: protectedProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getSuppliers(input?.activeOnly);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const supplier = await db.getSupplierById(input.id);
        if (!supplier) throw new Error("Supplier not found");
        return supplier;
      }),

    create: protectedProcedure
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

    update: protectedProcedure
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

    delete: protectedProcedure
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
    list: protectedProcedure
      .input(z.object({
        supplierId: z.number().optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getPurchaseOrders(input || {});
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const po = await db.getPurchaseOrderById(input.id);
        if (!po) throw new Error("Purchase order not found");
        const items = await db.getPurchaseOrderItems(input.id);
        return { ...po, items };
      }),

    create: protectedProcedure
      .input(z.object({
        supplierId: z.number(),
        notes: z.string().optional(),
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.number().min(1),
          unitCost: z.string(),
          subtotal: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        return await db.createPurchaseOrder(input);
      }),

    receive: protectedProcedure
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
    monthlyProfit: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
      }))
      .query(async ({ input }) => {
        return await db.getMonthlyProfitReport(input.year, input.month);
      }),
    // Business overview: 12 data cards
    overview: protectedProcedure
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
    topByQuantity: protectedProcedure
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
    topByRevenue: protectedProcedure
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
    topByProfit: protectedProcedure
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
    topCustomers: protectedProcedure
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
    salesPayment: protectedProcedure
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
    productSales: protectedProcedure
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
    customerSpending: protectedProcedure
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
    purchaseInventory: protectedProcedure
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
    refunds: protectedProcedure
      .input(z.object({
        preset: z.string(),
        customStart: z.string().optional(),
        customEnd: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const dateRange = db.getDateRange(input.preset, input.customStart, input.customEnd);
        return await db.getRefundRecords(dateRange);
      }),
  }),

  // ===========================================================================
  // Orders
  // ===========================================================================
  orders: router({
    list: protectedProcedure
      .input(z.object({
        physicalStatus: z.string().optional(),
        membershipStatus: z.string().optional(),
        orderType: z.string().optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getOrders(input || {});
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const order = await db.getOrderById(input.id);
        if (!order) throw new Error("Order not found");
        const items = await db.getOrderItems(input.id);
        return { ...order, items };
      }),

    create: protectedProcedure
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
        })),
        shippingAddress: z.string().optional(),
        shippingMethod: z.string().optional(),
        paymentMethod: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createOrderWithSplit(input);
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        physicalStatus: z.string().optional(),
        membershipStatus: z.string().optional(),
        courierCompany: z.string().optional(),
        trackingNumber: z.string().optional(),
        receiptUrl: z.string().optional(),
        paymentMethod: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateOrderStatus(id, data);
        return { success: true };
      }),
  }),

  // ===========================================================================
  // Membership Fee Reviews
  // ===========================================================================
  membership: router({
    listReviews: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        flowStatus: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getMembershipReviews(input || {});
      }),

    getReviewById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const review = await db.getMembershipReviewById(input.id);
        if (!review) throw new Error("Review not found");
        return review;
      }),

    getReviewByOrderId: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        return await db.getMembershipReviewByOrderId(input.orderId);
      }),

    createReview: protectedProcedure
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

    approveFee: protectedProcedure
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

    rejectFee: protectedProcedure
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

    resendFlow: protectedProcedure
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

    markLinkClicked: protectedProcedure
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

    markNeedsFollowUp: protectedProcedure
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

    cancelMembershipOrder: protectedProcedure
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

    getFlowLogs: protectedProcedure
      .input(z.object({ reviewId: z.number() }))
      .query(async ({ input }) => {
        return await db.getFlowSendLogsByReviewId(input.reviewId);
      }),
  }),

  // ===========================================================================
  // Flow Templates
  // ===========================================================================
  flows: router({
    list: protectedProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getFlowTemplates(input?.activeOnly);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const template = await db.getFlowTemplateById(input.id);
        if (!template) throw new Error("Flow template not found");
        const steps = await db.getFlowStepsByTemplateId(input.id);
        return { ...template, steps };
      }),

    create: protectedProcedure
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

    update: protectedProcedure
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

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteFlowTemplate(input.id);
        return { success: true };
      }),

    // Flow Steps
    listSteps: protectedProcedure
      .input(z.object({ templateId: z.number() }))
      .query(async ({ input }) => {
        return await db.getFlowStepsByTemplateId(input.templateId);
      }),

    createStep: protectedProcedure
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

    updateStep: protectedProcedure
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

    deleteStep: protectedProcedure
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
    list: protectedProcedure
      .input(z.object({ search: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getCustomers(input?.search);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const customer = await db.getCustomerById(input.id);
        if (!customer) throw new Error("Customer not found");
        return customer;
      }),

    findOrCreate: protectedProcedure
      .input(z.object({
        facebookId: z.string().optional(),
        facebookName: z.string().optional(),
        messengerId: z.string().optional(),
        name: z.string().optional(),
        phoneNumber: z.string().optional(),
        email: z.string().optional(),
        shopLinkIdentifier: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.findOrCreateCustomer(input);
      }),

    update: protectedProcedure
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
        membershipLevel: z.enum(["regular", "member", "vip"]).optional(),
        pointsBalance: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCustomer(id, data as any);
        return { success: true };
      }),

    findDuplicates: protectedProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return await db.findPotentialDuplicateCustomers(input.customerId);
      }),

    merge: protectedProcedure
      .input(z.object({
        sourceId: z.number(),
        targetId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.mergeCustomers(input.sourceId, input.targetId, ctx.user.id);
        return { success: true };
      }),

    getMergeSuggestions: protectedProcedure
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
    testSend: protectedProcedure
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
    getProfile: protectedProcedure
      .input(z.object({ psid: z.string() }))
      .query(async ({ input }) => {
        return await getUserProfile(input.psid);
      }),

    // Send custom message to a customer
    sendCustomMessage: protectedProcedure
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
    status: protectedProcedure.query(async () => {
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
    get: protectedProcedure.query(async () => {
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
    list: protectedProcedure.query(async () => {
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
    list: protectedProcedure.query(async () => {
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
    checkPostcode: protectedProcedure.input(z.object({
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
    getQuote: protectedProcedure.input(z.object({
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
    createShipment: protectedProcedure.input(z.object({
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
    checkoutShipment: protectedProcedure.input(z.object({
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
    getConsignmentNote: protectedProcedure.input(z.object({
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
  // Payment Methods (付款方式设定)
  // ===========================================================================
  paymentMethods: router({
    list: protectedProcedure.query(async () => {
      return await db.getPaymentMethods(true);
    }),
    
    listEnabled: publicProcedure.query(async () => {
      return await db.getPaymentMethods(false);
    }),
    
    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
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
    getStatusLogs: protectedProcedure.input(z.object({ orderId: z.number() })).query(async ({ input }) => {
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
    getInfo: protectedProcedure.input(z.object({ orderId: z.number() })).query(async ({ input }) => {
      return await db.getHoldOrderInfo(input.orderId);
    }),
    
    getActiveByCustomer: protectedProcedure.input(z.object({ customerId: z.number() })).query(async ({ input }) => {
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
      return await db.createHoldOrderInfo({
        orderId: input.orderId,
        holdType: input.holdType,
        scheduledShippingDate: input.scheduledShippingDate ? new Date(input.scheduledShippingDate) : null,
        allowAutoMerge: input.allowAutoMerge,
        holdRemark: input.holdRemark || null,
        holdBy,
      });
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
    
    findMergeable: protectedProcedure.input(z.object({ customerId: z.number() })).query(async ({ input }) => {
      return await db.findMergeableHoldOrder(input.customerId);
    }),
  }),

  // ===========================================================================
  // Notification Logs (通知记录)
  // ===========================================================================
  notifications: router({
    list: protectedProcedure.input(z.object({ orderId: z.number().optional() })).query(async ({ input }) => {
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
  // Dashboard
  // ===========================================================================
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      return await db.getDashboardStats();
    }),
  }),
});

export type AppRouter = typeof appRouter;
