import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { eq } from "drizzle-orm";
import { variants } from "../drizzle/schema";
import { sendTelegramJoinFlow, sendMembershipFlow, getUserProfile, sendTextMessage } from "./messenger";

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
  // Profit Report (利润报表)
  // ===========================================================================
  reports: router({
    monthlyProfit: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
      }))
      .query(async ({ input }) => {
        return await db.getMonthlyProfitReport(input.year, input.month);
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
  // XLCS V1.0: Couriers (快递公司管理)
  // ===========================================================================
  couriers: router({
    list: protectedProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        if (input?.activeOnly) {
          return await db.getActiveCouriers();
        }
        return await db.getAllCouriers();
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createCourier(input);
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCourier(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCourier(input.id);
        return { success: true };
      }),
  }),

  // ===========================================================================
  // XLCS V1.0: Orders V2 (增强版订单管理)
  // ===========================================================================
  ordersV2: router({
    list: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        orderSource: z.string().optional(),
        physicalStatus: z.string().optional(),
        shippingMethod: z.string().optional(),
        orderType: z.string().optional(),
        customerId: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getOrdersEnhanced(input || {});
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const order = await db.getOrderDetail(input.id);
        if (!order) throw new Error('订单不存在');
        return order;
      }),

    ship: protectedProcedure
      .input(z.object({
        id: z.number(),
        courierId: z.number().optional(),
        courierCompany: z.string().optional(),
        trackingNumber: z.string().min(1),
        shipmentDate: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.shipOrder(input.id, {
          courierId: input.courierId,
          courierCompany: input.courierCompany,
          trackingNumber: input.trackingNumber,
          shipmentDate: input.shipmentDate ? new Date(input.shipmentDate) : undefined,
          operatorId: ctx.user.id,
          operatorName: ctx.user.name || undefined,
        });
        return { success: true };
      }),

    cancel: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.cancelOrder(input.id, ctx.user.id, ctx.user.name || undefined);
        return { success: true };
      }),

    complete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.completeOrder(input.id, ctx.user.id, ctx.user.name || undefined);
        return { success: true };
      }),

    workQueue: protectedProcedure.query(async () => {
      return await db.getWorkQueueStats();
    }),
  }),

  // ===========================================================================
  // XLCS V1.0: Order Payments (付款纪录)
  // ===========================================================================
  orderPayments: router({
    list: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        return await db.getOrderPayments(input.orderId);
      }),

    add: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        amount: z.string().min(1),
        paymentDate: z.string(),
        paymentMethod: z.enum(['online_banking', 'tng', 'cash', 'shopee', 'bank_transfer', 'other']),
        receiptUrl: z.string().optional(),
        purpose: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.addOrderPayment({
          orderId: input.orderId,
          amount: input.amount,
          paymentDate: new Date(input.paymentDate),
          paymentMethod: input.paymentMethod,
          receiptUrl: input.receiptUrl,
          purpose: input.purpose,
          operatorId: ctx.user.id,
          operatorName: ctx.user.name || undefined,
          notes: input.notes,
        });
      }),
  }),

  // ===========================================================================
  // XLCS V1.0: Order Notifications (通知历史)
  // ===========================================================================
  orderNotifications: router({
    list: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        return await db.getOrderNotifications(input.orderId);
      }),

    markManual: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.markManualNotified(input.notificationId, ctx.user.id, ctx.user.name || undefined);
        return { success: true };
      }),
  }),

  // ===========================================================================
  // XLCS V1.0: Order Audit Logs (审计日志)
  // ===========================================================================
  auditLogs: router({
    list: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        return await db.getOrderAuditLogs(input.orderId);
      }),
  }),

  // ===========================================================================
  // XLCS V1.0 Module 3: Customer Management - Enhanced routes
  // ===========================================================================
  customersV2: router({
    // Global customer search (fuzzy search across all fields)
    search: protectedProcedure
      .input(z.object({ term: z.string().min(1), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.globalCustomerSearch(input.term, input.limit ?? 20);
      }),

    // Get customer detail with all related data
    getDetail: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const detail = await db.getCustomerDetail(input.id);
        if (!detail) throw new Error("Customer not found");
        return detail;
      }),

    // Update customer with audit logging
    updateWithAudit: protectedProcedure
      .input(z.object({
        id: z.number(),
        displayName: z.string().optional(),
        phoneNumber: z.string().optional(),
        whatsappPhone: z.string().optional(),
        email: z.string().optional(),
        facebookName: z.string().optional(),
        name: z.string().optional(),
        membershipLevel: z.enum(["regular", "member", "vip"]).optional(),
        avatarUrl: z.string().optional(),
        overrideAvatarUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateCustomerWithAudit(id, data, ctx.user.id, ctx.user.name || undefined);
        return { success: true };
      }),

    // Enhanced blacklist management
    setBlacklist: protectedProcedure
      .input(z.object({
        id: z.number(),
        blacklisted: z.boolean(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.setBlacklist(input.id, input.blacklisted, input.reason || "", ctx.user.id, ctx.user.name || "");
        return { success: true };
      }),

    // Customer statistics (auto-calculated)
    stats: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getCustomerStats(input.id);
      }),

    // Enhanced duplicate detection
    findEnhancedDuplicates: protectedProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return await db.findEnhancedDuplicates(input.customerId);
      }),
  }),

  // ===========================================================================
  // XLCS V1.0 Module 3: Customer Addresses
  // ===========================================================================
  customerAddresses: router({
    list: protectedProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return await db.getCustomerAddresses(input.customerId);
      }),

    create: protectedProcedure
      .input(z.object({
        customerId: z.number(),
        label: z.string(),
        recipientName: z.string(),
        recipientPhone: z.string(),
        address: z.string(),
        city: z.string().optional(),
        state: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.createCustomerAddress(input);
        // Timeline event
        await db.addTimelineEvent({
          customerId: input.customerId,
          eventType: "address_added",
          title: `新增地址: ${input.label}`,
          description: input.address,
          operatorId: ctx.user.id,
          operatorName: ctx.user.name || undefined,
        });
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        label: z.string().optional(),
        recipientName: z.string().optional(),
        recipientPhone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateCustomerAddress(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCustomerAddress(input.id);
        return { success: true };
      }),
  }),

  // ===========================================================================
  // XLCS V1.0 Module 3: Customer Credit Ledger
  // ===========================================================================
  customerCredit: router({
    list: protectedProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return await db.getCustomerCreditLedger(input.customerId);
      }),

    balance: protectedProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        const balance = await db.getCustomerCreditBalance(input.customerId);
        return { balance };
      }),

    add: protectedProcedure
      .input(z.object({
        customerId: z.number(),
        amount: z.number(),
        type: z.enum(["topup", "refund", "adjustment", "order_deduction", "manual"]),
        reason: z.string().optional(),
        orderId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.addCustomerCredit({
          ...input,
          operatorId: ctx.user.id,
          operatorName: ctx.user.name || undefined,
        });
        return result;
      }),
  }),

  // ===========================================================================
  // XLCS V1.0 Module 3: Customer Refunds
  // ===========================================================================
  customerRefunds: router({
    list: protectedProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return await db.getCustomerRefunds(input.customerId);
      }),

    add: protectedProcedure
      .input(z.object({
        customerId: z.number(),
        orderId: z.number(),
        amount: z.number(),
        refundMethod: z.enum(["bank_transfer", "tng", "cash", "store_credit", "other"]),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.addCustomerRefund({
          ...input,
          operatorId: ctx.user.id,
          operatorName: ctx.user.name || undefined,
        });
        return result;
      }),
  }),

  // ===========================================================================
  // XLCS V1.0 Module 3: Customer Timeline
  // ===========================================================================
  customerTimeline: router({
    list: protectedProcedure
      .input(z.object({ customerId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.getCustomerTimeline(input.customerId, input.limit ?? 50);
      }),
  }),

  // ===========================================================================
  // XLCS V1.0 Module 3: Customer Audit Logs
  // ===========================================================================
  customerAuditLogs: router({
    list: protectedProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return await db.getCustomerAuditLogs(input.customerId);
      }),
  }),

  // ===========================================================================
  // XLCS V1.0: Dashboard Work Center
  // ===========================================================================
  workCenter: router({
    stats: protectedProcedure.query(async () => {
      return await db.getWorkCenterStats();
    }),
    recentActions: protectedProcedure.query(async () => {
      return await db.getRecentActionItems(5);
    }),
    allActions: protectedProcedure
      .input(z.object({
        source: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getAllActionItems(input);
      }),
    completeAction: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.completeActionItem(
          input.id,
          ctx.user?.id || 0,
          ctx.user?.name || "Unknown"
        );
        return { success: true };
      }),
  }),

  // ===========================================================================
  // XLCS V1.0: Order Notes
  // ===========================================================================
  orderNotes: router({
    list: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        includeInternal: z.boolean().default(true),
      }))
      .query(async ({ input }) => {
        return await db.getOrderNotes(input.orderId, input.includeInternal);
      }),
    add: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        customerId: z.number().optional(),
        noteType: z.enum(["customer_note", "internal_note", "checkout_note"]),
        visibility: z.enum(["customer", "internal"]),
        content: z.string().min(1),
        source: z.string().optional(),
        sourceReferenceId: z.string().optional(),
        needsAction: z.boolean().default(false),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.addOrderNote({
          ...input,
          createdBy: ctx.user?.id,
          createdByName: ctx.user?.name || "Unknown",
        });
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteOrderNote(input.id);
        return { success: true };
      }),
  }),

  // ===========================================================================
  // XLCS V1.0: Action Items
  // ===========================================================================
  actionItems: router({
    list: protectedProcedure
      .input(z.object({
        source: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getAllActionItems(input);
      }),
    create: protectedProcedure
      .input(z.object({
        orderId: z.number().optional(),
        customerId: z.number().optional(),
        sessionId: z.number().optional(),
        source: z.string(),
        content: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.createActionItem({
          ...input,
          createdBy: ctx.user?.id,
          createdByName: ctx.user?.name || "Unknown",
        });
      }),
    complete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.completeActionItem(
          input.id,
          ctx.user?.id || 0,
          ctx.user?.name || "Unknown"
        );
        return { success: true };
      }),
  }),

  // ===========================================================================
  // XLCS V1.0: Sales Sessions (Facebook Live/Post/Reel)
  // ===========================================================================
  salesSessions: router({
    list: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        sessionType: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.listSalesSessions(input);
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getSalesSessionById(input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        sessionCode: z.string(),
        sessionType: z.enum(["facebook_live", "facebook_post", "facebook_reel"]),
        facebookPageId: z.string().optional(),
        facebookPostId: z.string().optional(),
        facebookLiveVideoId: z.string().optional(),
        title: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.createSalesSession({
          ...input,
          createdBy: ctx.user?.id,
        });
      }),
    updateStatus: protectedProcedure
      .input(z.object({ id: z.number(), status: z.string() }))
      .mutation(async ({ input }) => {
        await db.updateSalesSessionStatus(input.id, input.status);
        return { success: true };
      }),
    stats: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return await db.getSessionStats(input.sessionId);
      }),
  }),

  // ===========================================================================
  // XLCS V1.0: Session Products
  // ===========================================================================
  sessionProducts: router({
    list: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return await db.getSessionProducts(input.sessionId);
      }),
    add: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        productId: z.number(),
        variantId: z.number().optional(),
        keyword: z.string(),
        sellingPrice: z.string().optional(),
        physicalStockAtStart: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.addSessionProduct(input);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        preorderEnabled: z.boolean().optional(),
        preorderLimit: z.number().nullable().optional(),
        sellingStatus: z.string().optional(),
        sellingPrice: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await db.updateSessionProduct(id, updates);
        return { success: true };
      }),
  }),

  // ===========================================================================
  // XLCS V1.0: Facebook Comments
  // ===========================================================================
  facebookComments: router({
    list: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.listSessionComments(
          input.sessionId,
          input.limit || 100,
          input.offset || 0
        );
      }),
  }),

  // ===========================================================================
  // XLCS V1.0: AI Agent - Settings
  // ===========================================================================
  aiSettings: router({
    get: protectedProcedure.query(async () => {
      return await db.getAiSettings();
    }),
    update: adminProcedure
      .input(z.object({
        autoReplyEnabled: z.boolean().optional(),
        learningMode: z.enum(['suggestion', 'draft', 'disabled']).optional(),
        minConfidenceThreshold: z.string().optional(),
        messengerAiEnabled: z.boolean().optional(),
        whatsappAiEnabled: z.boolean().optional(),
        facebookCommentsOrderOnly: z.boolean().optional(),
        plantDiagnosticForceHuman: z.boolean().optional(),
        paymentRequiresHumanConfirm: z.boolean().optional(),
        parcelAnomalyDays: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.updateAiSettings({
          ...input,
          updatedBy: ctx.user?.name || 'Admin',
        });
      }),
  }),

  // ===========================================================================
  // XLCS V1.0: AI Agent - Reply Logs
  // ===========================================================================
  aiReplyLogs: router({
    list: protectedProcedure
      .input(z.object({
        customerId: z.number().optional(),
        platform: z.string().optional(),
        aiModule: z.string().optional(),
        transferredToHuman: z.boolean().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAiReplyLogs(input || {});
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getAiReplyLogById(input.id);
      }),
    add: protectedProcedure
      .input(z.object({
        customerId: z.number().optional(),
        customerName: z.string().optional(),
        platform: z.enum(['messenger', 'whatsapp', 'facebook_comment', 'internal']),
        aiModule: z.enum(['order', 'parcel', 'plant_diagnostic', 'faq', 'knowledge', 'payment', 'content', 'unknown']),
        userMessage: z.string().optional(),
        aiReply: z.string().optional(),
        flowUsed: z.string().optional(),
        faqUsed: z.string().optional(),
        knowledgeUsed: z.string().optional(),
        confidenceScore: z.string().optional(),
        transferredToHuman: z.boolean().optional(),
        chatSessionId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.addAiReplyLog(input as any);
      }),
    updateHumanReply: protectedProcedure
      .input(z.object({
        id: z.number(),
        humanReply: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.updateAiReplyLogHumanReply(
          input.id,
          input.humanReply,
          ctx.user?.name || 'Admin'
        );
      }),
  }),

  // ===========================================================================
  // XLCS V1.0: AI Agent - Review Items (AI 学习建议)
  // ===========================================================================
  aiReviewItems: router({
    list: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        suggestionType: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAiReviewItems(input || {});
      }),
    create: protectedProcedure
      .input(z.object({
        replyLogId: z.number().optional(),
        customerQuestion: z.string(),
        humanReply: z.string().optional(),
        aiSuggestion: z.string(),
        suggestionType: z.enum(['faq', 'knowledge', 'flow']),
        suggestedCategory: z.string().optional(),
        suggestedContent: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createAiReviewItem(input as any);
      }),
    updateStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['pending', 'approved', 'rejected', 'modified', 'ignored']),
        adminNote: z.string().optional(),
        modifiedReply: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.updateAiReviewItemStatus(
          input.id,
          input.status,
          ctx.user?.name || 'Admin',
          input.adminNote,
          input.modifiedReply
        );
      }),
  }),

  // ===========================================================================
  // XLCS V1.0: AI Agent - FAQ Entries
  // ===========================================================================
  faqEntries: router({
    list: protectedProcedure
      .input(z.object({
        category: z.string().optional(),
        productId: z.number().optional(),
        isActive: z.boolean().optional(),
        search: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getFaqEntries(input || {});
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getFaqEntryById(input.id);
      }),
    create: adminProcedure
      .input(z.object({
        category: z.string(),
        keywords: z.string().optional(),
        question: z.string(),
        answer: z.string(),
        imageUrl: z.string().optional(),
        videoUrl: z.string().optional(),
        pdfUrl: z.string().optional(),
        productId: z.number().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createFaqEntry(input as any);
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        category: z.string().optional(),
        keywords: z.string().optional(),
        question: z.string().optional(),
        answer: z.string().optional(),
        imageUrl: z.string().optional(),
        videoUrl: z.string().optional(),
        pdfUrl: z.string().optional(),
        productId: z.number().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateFaqEntry(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteFaqEntry(input.id);
      }),
  }),

  // ===========================================================================
  // XLCS V1.0: AI Agent - Knowledge Entries
  // ===========================================================================
  knowledgeEntries: router({
    list: protectedProcedure
      .input(z.object({
        productId: z.number().optional(),
        topic: z.string().optional(),
        isActive: z.boolean().optional(),
        search: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getKnowledgeEntries(input || {});
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getKnowledgeEntryById(input.id);
      }),
    create: adminProcedure
      .input(z.object({
        productId: z.number().optional(),
        topic: z.string(),
        content: z.string(),
        imageUrl: z.string().optional(),
        videoUrl: z.string().optional(),
        pdfUrl: z.string().optional(),
        tags: z.string().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createKnowledgeEntry(input as any);
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        productId: z.number().optional(),
        topic: z.string().optional(),
        content: z.string().optional(),
        imageUrl: z.string().optional(),
        videoUrl: z.string().optional(),
        pdfUrl: z.string().optional(),
        tags: z.string().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateKnowledgeEntry(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteKnowledgeEntry(input.id);
      }),
  }),

  // ===========================================================================
  // XLCS V1.0: AI Agent - Plant Diagnostic Tickets
  // ===========================================================================
  plantDiagnostics: router({
    list: protectedProcedure
      .input(z.object({
        customerId: z.number().optional(),
        status: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getPlantDiagnosticTickets(input || {});
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getPlantDiagnosticTicketById(input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        customerId: z.number().optional(),
        customerName: z.string().optional(),
        platform: z.enum(['messenger', 'whatsapp', 'internal']).optional(),
        placement: z.string().optional(),
        lightingHours: z.string().optional(),
        wateringFrequency: z.string().optional(),
        soilDryDays: z.string().optional(),
        recentFertilized: z.boolean().optional(),
        fertilizerType: z.string().optional(),
        recentRepotted: z.boolean().optional(),
        recentSprayed: z.boolean().optional(),
        hasPests: z.boolean().optional(),
        leafCondition: z.string().optional(),
        branchCondition: z.string().optional(),
        rootCondition: z.string().optional(),
        photoUrls: z.string().optional(),
        chatSessionId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createPlantDiagnosticTicket(input as any);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['collecting', 'pending_human', 'in_progress', 'resolved', 'closed']).optional(),
        assignedTo: z.string().optional(),
        humanReply: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: any = { ...data };
        if (data.status === 'resolved') {
          updateData.resolvedAt = new Date();
        }
        return await db.updatePlantDiagnosticTicket(id, updateData);
      }),
  }),

  // ===========================================================================
  // XLCS V1.0: AI Agent - Chat Sessions
  // ===========================================================================
  aiChatSessions: router({
    list: protectedProcedure
      .input(z.object({
        customerId: z.number().optional(),
        platform: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAiChatSessions(input || {});
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getAiChatSessionById(input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        customerId: z.number().optional(),
        customerName: z.string().optional(),
        platform: z.enum(['messenger', 'whatsapp', 'facebook_comment', 'internal']),
      }))
      .mutation(async ({ input }) => {
        return await db.createAiChatSession(input as any);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['active', 'transferred', 'closed']).optional(),
        transferredTo: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: any = { ...data };
        if (data.status === 'transferred') {
          updateData.transferredAt = new Date();
        }
        return await db.updateAiChatSession(id, updateData);
      }),
  }),

  // ===========================================================================
  // XLCS V1.0: Session Product Variants (场次 Variant 绑定)
  // ===========================================================================
  sessionProductVariants: router({
    list: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return await db.getSessionProductVariants(input.sessionId);
      }),
    add: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        sessionProductId: z.number(),
        productId: z.number(),
        variantId: z.number(),
        keyword: z.string(),
        sellingPrice: z.string().optional(),
        physicalStockAtStart: z.number().optional(),
        preorderEnabled: z.boolean().optional(),
        preorderLimit: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.addSessionProductVariant({
          ...input,
          keyword: input.keyword.toUpperCase().trim(),
        } as any);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        sellingPrice: z.string().optional(),
        physicalStockAtStart: z.number().optional(),
        preorderEnabled: z.boolean().optional(),
        preorderLimit: z.number().optional(),
        sellingStatus: z.enum(['available', 'stopped']).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateSessionProductVariant(id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteSessionProductVariant(input.id);
      }),
    findByKeyword: protectedProcedure
      .input(z.object({ sessionId: z.number(), keyword: z.string() }))
      .query(async ({ input }) => {
        return await db.findSessionProductVariantByKeyword(input.sessionId, input.keyword);
      }),
  }),

  // ===========================================================================
  // XLCS V1.0: Live Selling Center - Sellable Products & Dashboard
  // ===========================================================================
  liveSelling: router({
    getSellableProducts: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return await db.getSellableSessionProducts(input.sessionId);
      }),
    getDashboardStats: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return await db.getLiveDashboardStats(input.sessionId);
      }),
  }),

  // ===========================================================================
  // Dashboard (legacy - keep for backward compat)
  // ===========================================================================
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      return await db.getWorkCenterStats();
    }),
  }),
});

export type AppRouter = typeof appRouter;
