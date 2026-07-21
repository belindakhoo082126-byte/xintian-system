import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";

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
  // Product Categories
  // ===========================================================================
  categories: router({
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
            // Simulate sending Messenger message
            // In production, this would call Facebook Messenger API
            const messageContent = template.messageContent;
            const buttonName = template.buttonName || "进入心田会员系统";
            const buttonLink = template.buttonLink || "";

            // Log the send attempt
            await db.createFlowSendLog({
              reviewId: input.reviewId,
              flowTemplateId: template.id,
              stepOrder: 1,
              status: "sent",
              messageContent,
              sentAt: new Date(),
            } as any);

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

        // Simulate resending
        await db.createFlowSendLog({
          reviewId: input.reviewId,
          flowTemplateId: template.id,
          stepOrder: 1,
          status: "sent",
          messageContent: template.messageContent,
          sentAt: new Date(),
        } as any);

        await db.updateFlowStatus(input.reviewId, {
          flowStatus: "sent",
          flowSentAt: new Date(),
          flowErrorMessage: undefined,
        });

        // Update order status
        await db.updateOrderStatus(review.orderId, {
          membershipStatus: "flow_sent",
        });

        return {
          success: true,
          message: "Flow 已重新发送",
          messageContent: template.messageContent,
        };
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
  // Dashboard
  // ===========================================================================
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      return await db.getDashboardStats();
    }),
  }),
});

export type AppRouter = typeof appRouter;
