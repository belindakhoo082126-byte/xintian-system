CREATE TABLE `ai_handover_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int,
	`customerId` int,
	`platform` enum('messenger','whatsapp') NOT NULL,
	`platformId` varchar(255),
	`customerName` varchar(255),
	`reason` text NOT NULL,
	`aiSummary` text,
	`priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`status` enum('pending','claimed') NOT NULL DEFAULT 'pending',
	`claimedBy` varchar(255),
	`claimedAt` timestamp,
	`lastMessageAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_handover_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_knowledge` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` varchar(100) NOT NULL,
	`topic` varchar(255) NOT NULL,
	`triggerKeywords` text NOT NULL,
	`content` text NOT NULL,
	`priority` int NOT NULL DEFAULT 100,
	`useLLM` boolean NOT NULL DEFAULT false,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`usageCount` int NOT NULL DEFAULT 0,
	`lastMatchedAt` timestamp,
	`status` enum('draft','published') NOT NULL DEFAULT 'published',
	`sourceAiTestRunId` int,
	`sourceNote` text,
	`approvedBy` varchar(255),
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_knowledge_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_log_delivery_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`aiLogId` int NOT NULL,
	`attemptNumber` int NOT NULL,
	`sendStatus` enum('sent','failed','pending') NOT NULL,
	`platformMessageId` varchar(255),
	`errorCode` varchar(50),
	`errorMessage` text,
	`attemptedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_log_delivery_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int,
	`customerId` int,
	`customerName` varchar(255),
	`platform` enum('messenger','whatsapp','other') NOT NULL,
	`sourceType` enum('private_chat','facebook_live','facebook_post','facebook_reel') NOT NULL DEFAULT 'private_chat',
	`sourceEventId` varchar(255),
	`sourceBindingId` int,
	`customerMessageId` int,
	`aiReplyMessageId` int,
	`customerMessage` text,
	`receivedAt` timestamp NOT NULL,
	`aiEnabled` boolean NOT NULL,
	`handoverStatus` enum('none','pending','claimed') NOT NULL,
	`processingSteps` json,
	`finalSource` enum('order_keyword','product','reply_rule','knowledge','llm','flow','human_handover','no_match','error','ai_disabled','human_claimed') NOT NULL,
	`matchedRuleId` int,
	`matchedKnowledgeId` int,
	`matchedProductId` int,
	`matchedFlowId` int,
	`aiReply` text,
	`sendStatus` enum('sent','failed','not_sent','pending') NOT NULL DEFAULT 'not_sent',
	`platformMessageId` varchar(255),
	`retryCount` int NOT NULL DEFAULT 0,
	`lastRetryAt` timestamp,
	`errorCode` varchar(50),
	`errorStage` varchar(50),
	`errorMessage` text,
	`isHandover` boolean NOT NULL DEFAULT false,
	`handoverReason` text,
	`processingTimeMs` int,
	`detectedIntent` varchar(100),
	`handoverSummary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_notification_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notificationLogId` int NOT NULL,
	`action` enum('manual_sent','resolved','ignored') NOT NULL,
	`note` text,
	`handledBy` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_notification_actions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_ai_notification_actions_log` UNIQUE(`notificationLogId`)
);
--> statement-breakpoint
CREATE TABLE `ai_persona` (
	`id` int AUTO_INCREMENT NOT NULL,
	`aiName` varchar(100) NOT NULL DEFAULT '小田',
	`brandName` varchar(200) NOT NULL DEFAULT '心田 Xintian',
	`aiSelfReference` varchar(50) NOT NULL DEFAULT '小田',
	`customerAddress` varchar(50) NOT NULL DEFAULT '亲爱的',
	`replyTone` varchar(50) NOT NULL DEFAULT 'warm',
	`defaultLanguage` varchar(20) NOT NULL DEFAULT 'zh',
	`supportedLanguages` varchar(255) NOT NULL DEFAULT '["zh","en","ms"]',
	`emojiLevel` varchar(20) NOT NULL DEFAULT 'low',
	`replyLength` varchar(20) NOT NULL DEFAULT 'medium',
	`proactiveRecommend` boolean NOT NULL DEFAULT true,
	`proactiveInquire` boolean NOT NULL DEFAULT true,
	`enableCTA` boolean NOT NULL DEFAULT true,
	`ctaTemplate` varchar(1000) DEFAULT '还有什么小田可以帮到你的吗？😊',
	`customPrompt` text,
	`replyPrinciples` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_persona_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_test_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`platform` enum('messenger','whatsapp') NOT NULL,
	`language` varchar(20) NOT NULL DEFAULT 'auto',
	`aiEnabled` boolean NOT NULL DEFAULT true,
	`handoverStatus` enum('none','pending','claimed') NOT NULL DEFAULT 'none',
	`enableLLM` boolean NOT NULL DEFAULT true,
	`simulatedCustomerName` varchar(255),
	`isMember` boolean NOT NULL DEFAULT false,
	`hasOrder` boolean NOT NULL DEFAULT false,
	`testMessage` text NOT NULL,
	`processingSteps` json,
	`finalSource` enum('order_keyword','product','reply_rule','knowledge','llm','no_match','error','ai_disabled','human_claimed') NOT NULL,
	`matchedRuleId` int,
	`matchedKnowledgeId` int,
	`matchedProductId` int,
	`aiReply` text,
	`shouldHandover` boolean NOT NULL DEFAULT false,
	`handoverReason` text,
	`processingTimeMs` int,
	`errorCode` varchar(50),
	`errorStage` varchar(50),
	`errorMessage` text,
	`llmCalled` boolean NOT NULL DEFAULT false,
	`llmModel` varchar(100),
	`llmProcessingTimeMs` int,
	`llmSuccess` boolean,
	`llmErrorStage` varchar(50),
	`llmErrorCode` varchar(50),
	`llmTimedOut` boolean NOT NULL DEFAULT false,
	`llmInputTokens` int,
	`llmOutputTokens` int,
	`personaSnapshot` json,
	`testedBy` varchar(255) NOT NULL,
	`notes` text,
	`previousRunId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_test_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`versionNumber` varchar(50) NOT NULL,
	`label` varchar(255),
	`description` text,
	`knowledgeCount` int NOT NULL DEFAULT 0,
	`ruleCount` int NOT NULL DEFAULT 0,
	`personaId` int,
	`personaSnapshot` json,
	`knowledgeSnapshot` json,
	`rulesSnapshot` json,
	`regressionRunId` int,
	`regressionAccuracy` decimal(5,2),
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`publishedBy` varchar(255),
	`publishedAt` timestamp,
	`createdBy` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bundle_stock_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bundleId` int NOT NULL,
	`actionType` enum('create','restock','disassemble','sell','adjust') NOT NULL,
	`qtyChange` int NOT NULL,
	`stockBefore` int NOT NULL,
	`stockAfter` int NOT NULL,
	`affectedProducts` text,
	`reason` varchar(100),
	`operator` varchar(100),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bundle_stock_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaign_buttons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`flowId` int,
	`name` varchar(100) NOT NULL,
	`productId` int NOT NULL,
	`variantId` int,
	`quantity` int NOT NULL DEFAULT 1,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaign_buttons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaign_content_ids` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`contentType` enum('post','reel','video') NOT NULL,
	`contentId` varchar(200) NOT NULL,
	`facebookLink` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaign_content_ids_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaign_flows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`type` enum('text','image','video','audio','file','product_intro','button') NOT NULL,
	`text` text,
	`mediaUrl` varchar(500),
	`mediaType` varchar(100),
	`buttonConfig` text,
	`productId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaign_flows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`type` enum('post','reel','video') NOT NULL DEFAULT 'post',
	`facebookLink` varchar(500),
	`facebookPostId` varchar(200),
	`facebookVideoId` varchar(200),
	`facebookPageId` varchar(200),
	`startDate` timestamp,
	`endDate` timestamp,
	`status` enum('draft','active','ended','archived') NOT NULL DEFAULT 'draft',
	`autoReplyEnabled` boolean NOT NULL DEFAULT true,
	`autoReplyText` text,
	`messengerFlowEnabled` boolean NOT NULL DEFAULT true,
	`commentCount` int NOT NULL DEFAULT 0,
	`messengerCount` int NOT NULL DEFAULT 0,
	`orderCount` int NOT NULL DEFAULT 0,
	`totalRevenue` decimal(12,2) NOT NULL DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nameZh` varchar(100) NOT NULL,
	`nameEn` varchar(100) NOT NULL,
	`descZh` text,
	`descEn` text,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`showInStore` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`imageUrl` varchar(500),
	`iconUrl` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int,
	`platform` enum('messenger','whatsapp') NOT NULL,
	`platformId` varchar(255),
	`lastMessagePreview` text,
	`lastMessageAt` timestamp,
	`unreadCount` int NOT NULL DEFAULT 0,
	`aiReplyEnabled` boolean NOT NULL DEFAULT true,
	`aiToggledBy` varchar(255),
	`aiToggledAt` timestamp,
	`handoverStatus` enum('none','pending','claimed') NOT NULL DEFAULT 'none',
	`handoverClaimedBy` varchar(255),
	`handoverClaimedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chat_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`senderType` enum('customer','ai','staff','system') NOT NULL,
	`senderName` varchar(255),
	`messageType` enum('text','image','audio','video','file','flow','order_action','handover') NOT NULL DEFAULT 'text',
	`content` text,
	`mediaUrl` text,
	`platformMessageId` varchar(255),
	`status` enum('sent','delivered','read','failed') NOT NULL DEFAULT 'sent',
	`errorMessage` text,
	`aiResponseSource` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cn_change_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cnId` int NOT NULL,
	`field` varchar(100) NOT NULL,
	`oldValue` text,
	`newValue` text,
	`changedBy` int,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cn_change_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cn_expiry_run_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inspectedCount` int NOT NULL DEFAULT 0,
	`cancelledCount` int NOT NULL DEFAULT 0,
	`failedCount` int NOT NULL DEFAULT 0,
	`cancelledOrderNumbers` json,
	`runAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cn_expiry_run_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cost_adjustment_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` int NOT NULL,
	`fieldName` varchar(100) NOT NULL,
	`itemId` int,
	`oldValue` varchar(255),
	`newValue` varchar(255),
	`reason` text NOT NULL,
	`operatorName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cost_adjustment_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_credit_ledger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`balanceAfter` decimal(10,2) NOT NULL,
	`type` enum('admin_add','admin_deduct','order_use','order_refund') NOT NULL,
	`reason` text NOT NULL,
	`orderId` int,
	`orderNumber` varchar(30),
	`performedBy` varchar(255) NOT NULL,
	`adminId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_credit_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_merge_suggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerAId` int NOT NULL,
	`customerBId` int NOT NULL,
	`matchReasons` text,
	`status` enum('pending','approved','rejected','auto_merged') NOT NULL DEFAULT 'pending',
	`reviewedByStaffId` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_merge_suggestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`facebookId` varchar(255),
	`facebookName` varchar(255),
	`messengerId` varchar(255),
	`name` varchar(255),
	`phoneNumber` varchar(20),
	`email` varchar(255),
	`address` text,
	`addressLine1` varchar(500),
	`addressLine2` varchar(500),
	`city` varchar(100),
	`state` varchar(100),
	`postalCode` varchar(20),
	`postcode` varchar(20),
	`country` varchar(100),
	`shopLinkIdentifier` varchar(255),
	`totalOrders` int DEFAULT 0,
	`totalSpent` decimal(12,2) DEFAULT '0',
	`membershipLevel` enum('regular','member','vip') DEFAULT 'regular',
	`pointsBalance` int DEFAULT 0,
	`isBlacklisted` boolean DEFAULT false,
	`blacklistReason` text,
	`notes` text,
	`mergedIntoCustomerId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastOrderAt` timestamp,
	`customerId` varchar(20) NOT NULL,
	`displayName` varchar(255),
	`whatsappPhone` varchar(20),
	`avatarUrl` varchar(500),
	`overrideAvatarUrl` varchar(500),
	`customerSource` enum('facebook_live','facebook_messenger','whatsapp','store','admin') NOT NULL DEFAULT 'admin',
	`lastInteractionAt` timestamp,
	`blacklistAt` timestamp,
	`blacklistBy` int,
	`unblacklistAt` timestamp,
	`unblacklistBy` int,
	`customerType` enum('retail','wholesale','agent') NOT NULL DEFAULT 'retail',
	`creditBalance` decimal(10,2) NOT NULL DEFAULT '0',
	`accountEmail` varchar(255),
	`accountPasswordHash` varchar(255),
	`canLogin` boolean NOT NULL DEFAULT false,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `draft_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`draftNumber` varchar(50) NOT NULL,
	`customerId` int,
	`customerName` varchar(255),
	`messengerId` varchar(255),
	`platform` enum('messenger','whatsapp','other') NOT NULL DEFAULT 'messenger',
	`aiLogId` int,
	`detectedIntent` varchar(100),
	`originalMessage` text,
	`items` json NOT NULL,
	`totalAmount` decimal(10,2) NOT NULL DEFAULT '0',
	`status` enum('waiting_approval','approved','rejected','expired','invalid') NOT NULL DEFAULT 'waiting_approval',
	`approvedBy` varchar(255),
	`approvedAt` timestamp,
	`rejectedBy` varchar(255),
	`rejectedAt` timestamp,
	`rejectReason` text,
	`officialOrderId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `draft_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `draft_orders_draftNumber_unique` UNIQUE(`draftNumber`)
);
--> statement-breakpoint
CREATE TABLE `flow_send_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reviewId` int NOT NULL,
	`flowTemplateId` int NOT NULL,
	`stepOrder` int NOT NULL,
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`messageContent` text,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `flow_send_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `flow_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`flowTemplateId` int NOT NULL,
	`stepOrder` int NOT NULL,
	`stepName` varchar(255) NOT NULL,
	`messageType` enum('text','image','video','audio','button','contact_support') NOT NULL,
	`messageContent` text,
	`mediaUrl` varchar(500),
	`buttonName` varchar(100),
	`buttonLink` varchar(500),
	`delaySeconds` int DEFAULT 0,
	`conditionType` enum('always','if_not_clicked','if_clicked'),
	`conditionValue` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `flow_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hold_order_infos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`holdType` enum('wait_next_live','scheduled_shipping','wait_stock','other') NOT NULL,
	`scheduledShippingDate` timestamp,
	`allowAutoMerge` boolean NOT NULL DEFAULT true,
	`holdRemark` text,
	`holdBy` varchar(255),
	`holdCreatedAt` timestamp NOT NULL DEFAULT (now()),
	`holdReleasedAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hold_order_infos_id` PRIMARY KEY(`id`),
	CONSTRAINT `hold_order_infos_orderId_unique` UNIQUE(`orderId`)
);
--> statement-breakpoint
CREATE TABLE `ib_differences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` int NOT NULL,
	`cnBatchNumber` varchar(50),
	`supplierName` varchar(255),
	`productId` int NOT NULL,
	`productName` varchar(255) NOT NULL,
	`variantId` int,
	`variantName` varchar(255),
	`cnPurchaseQty` int NOT NULL DEFAULT 0,
	`ibReceivedQty` int NOT NULL DEFAULT 0,
	`differenceQty` int NOT NULL DEFAULT 0,
	`differenceType` enum('shortage','over_supply','damaged','dead','wrong_item','not_arrived','other') NOT NULL DEFAULT 'shortage',
	`reason` text,
	`evidenceUrl` varchar(500),
	`needsReplenish` boolean NOT NULL DEFAULT false,
	`needsRefund` boolean NOT NULL DEFAULT false,
	`processStatus` enum('pending','in_progress','resolved','no_action') NOT NULL DEFAULT 'pending',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ib_differences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `import_batch_change_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ibId` int NOT NULL,
	`field` varchar(160) NOT NULL,
	`oldValue` text,
	`newValue` text,
	`changedBy` int,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `import_batch_change_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `import_batch_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` int NOT NULL,
	`productId` int NOT NULL,
	`productName` varchar(255) NOT NULL,
	`variantId` int,
	`variantName` varchar(255),
	`paidQuantity` int NOT NULL DEFAULT 0,
	`finalPurchaseQuantity` int NOT NULL DEFAULT 0,
	`actualReceivedQty` int,
	`healthyQty` int,
	`damagedQty` int DEFAULT 0,
	`deadQty` int DEFAULT 0,
	`missingQty` int DEFAULT 0,
	`wrongItemQty` int DEFAULT 0,
	`differenceReason` enum('none','supplier_short','over_supply','damaged','dead','wrong_item','not_arrived','other') DEFAULT 'none',
	`differenceNotes` text,
	`itemStatus` enum('pending','all_arrived','partial_arrived','shortage','damaged','dead','missing','wrong_item') DEFAULT 'pending',
	`unitPurchaseCost` decimal(10,2),
	`allocatedShippingCost` decimal(10,2),
	`allocatedOtherFees` decimal(10,2),
	`totalUnitCost` decimal(10,2),
	`spotSaleEnabled` boolean NOT NULL DEFAULT false,
	`spotSaleQty` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `import_batch_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentType` enum('cn','ib') NOT NULL DEFAULT 'cn',
	`cnId` int,
	`batchNumber` varchar(50) NOT NULL,
	`batchName` varchar(255) NOT NULL,
	`sourceCountry` varchar(100) NOT NULL DEFAULT '中国',
	`supplierName` varchar(255),
	`supplierOrderNumber` varchar(100),
	`chinaTrackingNumber` varchar(255),
	`liveRoomId` int,
	`preorderStartDate` timestamp,
	`preorderEndDate` timestamp,
	`startDate` date,
	`endDate` date,
	`paymentDeadline` date,
	`autoIbId` int,
	`actualPurchaseDate` timestamp,
	`shippingMethod` enum('air','sea'),
	`chinaShippingCost` decimal(12,2) DEFAULT '0',
	`otherFees` decimal(12,2) DEFAULT '0',
	`totalEstimatedCost` decimal(12,2) DEFAULT '0',
	`totalActualCost` decimal(12,2) DEFAULT '0',
	`status` enum('draft','in_progress','closed','purchased','preparing','in_transit','partial_arrived','all_arrived','completed') NOT NULL DEFAULT 'draft',
	`ibGenerated` boolean NOT NULL DEFAULT false,
	`costLocked` boolean NOT NULL DEFAULT false,
	`costLockedAt` timestamp,
	`isLocked` boolean NOT NULL DEFAULT false,
	`lockedAt` timestamp,
	`lockedBy` int,
	`unlockReason` text,
	`parentBatchId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `import_batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `import_batches_batchNumber_unique` UNIQUE(`batchNumber`)
);
--> statement-breakpoint
CREATE TABLE `inventory_adjustments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`supplierId` int,
	`supplierName` varchar(255),
	`adjustmentType` enum('quality_issue','plant_death','pest_disease','human_damage','unhealthy','lost','other') NOT NULL,
	`quantityChange` int NOT NULL,
	`unitCost` decimal(10,2) DEFAULT '0',
	`totalCost` decimal(10,2) DEFAULT '0',
	`orderExceptionId` int,
	`correctsAdjustmentId` int,
	`adjustedBy` varchar(255),
	`reason` text,
	`remark` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_adjustments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `live_ai_flows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`triggerKeywords` text NOT NULL,
	`replyContent` text NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `live_ai_flows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `live_comment_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`liveCommentId` int NOT NULL,
	`liveRoomId` int NOT NULL,
	`orderId` int,
	`customerId` int,
	`content` text NOT NULL,
	`createdBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `live_comment_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `live_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`liveRoomId` int NOT NULL,
	`commentId` varchar(255),
	`commenterName` varchar(255) NOT NULL,
	`commenterPsid` varchar(255),
	`commenterAvatarUrl` varchar(500),
	`commentMessage` text NOT NULL,
	`parsedKeyword` varchar(100),
	`parsedQuantity` int DEFAULT 0,
	`matchResult` enum('matched','no_match','paused','sold_out','preorder','duplicate','ignored','ai_replied') NOT NULL DEFAULT 'no_match',
	`matchedProductId` int,
	`matchedProductName` varchar(255),
	`matchedLiveRoomProductId` int,
	`orderId` int,
	`orderNumber` varchar(50),
	`messengerStatus` enum('pending','sent','failed','not_needed','manually_handled') DEFAULT 'not_needed',
	`messengerError` text,
	`aiFlowId` int,
	`aiReplyContent` text,
	`isHandled` boolean NOT NULL DEFAULT false,
	`commentDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `live_comments_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_live_comment_id` UNIQUE(`commentId`)
);
--> statement-breakpoint
CREATE TABLE `live_order_captures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`commentId` varchar(255),
	`commenterName` varchar(255) NOT NULL,
	`commenterPsid` varchar(255),
	`commentMessage` text NOT NULL,
	`postId` varchar(255),
	`liveVideoId` varchar(255),
	`parsedKeywords` text,
	`matchedProducts` text,
	`status` enum('matched','no_match','order_created','order_merged','failed') NOT NULL DEFAULT 'matched',
	`orderId` int,
	`errorMessage` text,
	`commentDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `live_order_captures_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_comment_id` UNIQUE(`commentId`)
);
--> statement-breakpoint
CREATE TABLE `live_room_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`liveRoomId` int NOT NULL,
	`productId` int NOT NULL,
	`variationId` int,
	`keyword` varchar(50) NOT NULL,
	`displayName` varchar(255) NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`startStock` int NOT NULL DEFAULT 0,
	`reservedCount` int NOT NULL DEFAULT 0,
	`availableStock` int NOT NULL DEFAULT 0,
	`orderedCount` int NOT NULL DEFAULT 0,
	`allowPreorder` boolean NOT NULL DEFAULT false,
	`preorderCount` int NOT NULL DEFAULT 0,
	`status` enum('active','paused','sold_out') NOT NULL DEFAULT 'active',
	`sortOrder` int NOT NULL DEFAULT 0,
	`imageUrl` varchar(500),
	`specImage` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `live_room_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `live_rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`liveDate` timestamp NOT NULL,
	`facebookLiveUrl` varchar(500),
	`facebookVideoId` varchar(255),
	`liveType` enum('normal','import_preorder') NOT NULL DEFAULT 'normal',
	`importBatchId` int,
	`preorderStartDate` timestamp,
	`preorderEndDate` timestamp,
	`estimatedWaitDays` varchar(100),
	`status` enum('preparing','live','ended','closed') NOT NULL DEFAULT 'preparing',
	`streamerName` varchar(255),
	`facebookPageId` varchar(255),
	`estimatedStartTime` varchar(50),
	`notes` text,
	`aiReplyEnabled` boolean NOT NULL DEFAULT true,
	`continueMonitor` boolean NOT NULL DEFAULT true,
	`liveStartTime` timestamp,
	`liveEndTime` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `live_rooms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mall_banners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('home_16x9','home_9x16','home_1x1','marketing_16x9','marketing_1x1','marketing_9x16') NOT NULL,
	`imageUrl` varchar(500) NOT NULL,
	`linkUrl` varchar(500),
	`displayOrder` int NOT NULL DEFAULT 0,
	`startDate` timestamp,
	`endDate` timestamp,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mall_banners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mall_notices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`announcement` varchar(500) NOT NULL,
	`announcementEn` varchar(500),
	`isEnabled` boolean NOT NULL DEFAULT true,
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mall_notices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mall_product_detail_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`imageUrl` varchar(500) NOT NULL,
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mall_product_detail_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mall_quick_contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('whatsapp','messenger','facebook_page','waze','google_map') NOT NULL,
	`name` varchar(100) NOT NULL,
	`imageUrl` varchar(500),
	`linkUrl` varchar(500) NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mall_quick_contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mall_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shopName` varchar(200) NOT NULL,
	`domain` varchar(255),
	`logoUrl` varchar(500),
	`faviconUrl` varchar(500),
	`slogan` varchar(500),
	`seoTitle` varchar(200),
	`seoDescription` text,
	`facebookPixel` varchar(100),
	`googleAnalytics` varchar(100),
	`shippingPolicy` text,
	`refundPolicy` text,
	`serviceTerms` text,
	`companyName` varchar(200),
	`phone` varchar(50),
	`whatsapp` varchar(50),
	`email` varchar(200),
	`facebook` varchar(500),
	`address` text,
	`wazeLink` varchar(500),
	`googleMapLink` varchar(500),
	`activeTheme` varchar(50) NOT NULL DEFAULT 'xintian_nature',
	`customThemeColors` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mall_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mall_theme_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`themeKey` varchar(50) NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mall_theme_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketing_automation_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int,
	`name` varchar(255) NOT NULL,
	`triggerType` enum('segment','campaign_start','campaign_ending','restock','lottery_eligible','manual_batch') NOT NULL,
	`segmentId` int,
	`templateId` int NOT NULL,
	`status` enum('paused','active','ended') NOT NULL DEFAULT 'paused',
	`scheduleType` enum('once','cron','event') NOT NULL DEFAULT 'event',
	`scheduledAt` timestamp,
	`heartbeatJobId` varchar(255),
	`scheduleCronTaskUid` varchar(65),
	`filterConfig` json,
	`lastRunAt` timestamp,
	`createdBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketing_automation_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_marketing_automation_schedule_task` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
CREATE TABLE `marketing_campaign_usages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`ruleId` int,
	`customerId` int NOT NULL,
	`orderId` int NOT NULL,
	`status` enum('used','reversed') NOT NULL DEFAULT 'used',
	`usedAt` timestamp NOT NULL DEFAULT (now()),
	`reversedAt` timestamp,
	CONSTRAINT `marketing_campaign_usages_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_marketing_campaign_customer_order` UNIQUE(`campaignId`,`customerId`,`orderId`)
);
--> statement-breakpoint
CREATE TABLE `marketing_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignCode` varchar(50) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`status` enum('draft','scheduled','active','paused','ended') NOT NULL DEFAULT 'draft',
	`startAt` timestamp,
	`endAt` timestamp,
	`orderCategories` text,
	`orderSources` text,
	`customerAudience` enum('all','member','non_member','new_customer','segment') NOT NULL DEFAULT 'all',
	`customerSegmentId` int,
	`showInMall` boolean NOT NULL DEFAULT false,
	`allowMemberPriceStack` boolean NOT NULL DEFAULT false,
	`allowBundlePriceStack` boolean NOT NULL DEFAULT false,
	`allowCouponStack` boolean NOT NULL DEFAULT false,
	`allowPointsEarn` boolean NOT NULL DEFAULT true,
	`perCustomerLimit` int,
	`perOrderLimit` int,
	`usageLimit` int,
	`usageCount` int NOT NULL DEFAULT 0,
	`createdBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketing_campaigns_id` PRIMARY KEY(`id`),
	CONSTRAINT `marketing_campaigns_campaignCode_unique` UNIQUE(`campaignCode`)
);
--> statement-breakpoint
CREATE TABLE `marketing_lottery_draws` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entryId` int NOT NULL,
	`prizeId` int,
	`customerId` int NOT NULL,
	`sourceOrderId` int,
	`mergedOrderId` int,
	`orderItemId` int,
	`status` enum('drawn','pending_claim','merged','claimed_in_store','forfeited') NOT NULL DEFAULT 'drawn',
	`prizeSnapshot` json NOT NULL,
	`drawnAt` timestamp NOT NULL DEFAULT (now()),
	`claimedAt` timestamp,
	CONSTRAINT `marketing_lottery_draws_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketing_lottery_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`ruleId` int,
	`customerId` int NOT NULL,
	`orderId` int,
	`liveRoomId` int,
	`entrySource` enum('order_threshold','live_keyword','live_answer','live_interaction','admin','live_order') NOT NULL,
	`reason` varchar(500),
	`entryCount` int NOT NULL DEFAULT 1,
	`usedCount` int NOT NULL DEFAULT 0,
	`status` enum('pending_payment','eligible','drawn','expired','cancelled') NOT NULL DEFAULT 'pending_payment',
	`eligibleAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketing_lottery_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketing_lottery_prizes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`ruleId` int,
	`name` varchar(255) NOT NULL,
	`prizeType` enum('physical_product','coupon','points','membership_days','free_shipping','no_prize') NOT NULL,
	`productId` int,
	`productQuantity` int NOT NULL DEFAULT 1,
	`couponCode` varchar(100),
	`pointsValue` int NOT NULL DEFAULT 0,
	`membershipDays` int NOT NULL DEFAULT 0,
	`probabilityWeight` int NOT NULL DEFAULT 1,
	`quantityLimit` int,
	`quantityAwarded` int NOT NULL DEFAULT 0,
	`status` enum('active','paused','depleted') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketing_lottery_prizes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketing_message_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`automationRuleId` int,
	`campaignId` int,
	`templateId` int,
	`customerId` int NOT NULL,
	`orderId` int,
	`channel` enum('messenger','manual_copy') NOT NULL DEFAULT 'messenger',
	`status` enum('queued','sent','failed','skipped') NOT NULL DEFAULT 'queued',
	`renderedContent` text NOT NULL,
	`trackingToken` varchar(100) NOT NULL,
	`providerMessageId` varchar(255),
	`errorMessage` text,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketing_message_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `marketing_message_deliveries_trackingToken_unique` UNIQUE(`trackingToken`),
	CONSTRAINT `uq_marketing_rule_customer_delivery` UNIQUE(`automationRuleId`,`customerId`)
);
--> statement-breakpoint
CREATE TABLE `marketing_message_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deliveryId` int NOT NULL,
	`eventType` enum('opened','clicked','ordered','paid') NOT NULL,
	`orderId` int,
	`metadata` json,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketing_message_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_marketing_delivery_event_order` UNIQUE(`deliveryId`,`eventType`,`orderId`)
);
--> statement-breakpoint
CREATE TABLE `marketing_message_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`channel` enum('messenger','manual_copy') NOT NULL DEFAULT 'messenger',
	`subject` varchar(255),
	`content` text NOT NULL,
	`buttonLabel` varchar(100),
	`buttonUrl` varchar(500),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketing_message_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketing_order_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`campaignId` int NOT NULL,
	`ruleId` int,
	`customerId` int NOT NULL,
	`applicationType` enum('discount','gift','add_on','free_shipping','points','lottery','coupon') NOT NULL,
	`status` enum('applied','reversed','expired') NOT NULL DEFAULT 'applied',
	`originalAmount` decimal(12,2) NOT NULL DEFAULT '0',
	`discountAmount` decimal(12,2) NOT NULL DEFAULT '0',
	`shippingSubsidy` decimal(12,2) NOT NULL DEFAULT '0',
	`pointsGranted` int NOT NULL DEFAULT 0,
	`snapshot` json NOT NULL,
	`appliedAt` timestamp NOT NULL DEFAULT (now()),
	`reversedAt` timestamp,
	CONSTRAINT `marketing_order_applications_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_marketing_order_campaign_rule` UNIQUE(`orderId`,`campaignId`,`ruleId`)
);
--> statement-breakpoint
CREATE TABLE `marketing_rule_scopes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ruleId` int NOT NULL,
	`scopeType` enum('trigger_product','eligible_product','eligible_category','gift_product','add_on_product') NOT NULL,
	`productId` int,
	`categoryId` int,
	`quantity` int NOT NULL DEFAULT 1,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketing_rule_scopes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketing_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`ruleType` enum('quantity_gift','nth_item_discount','order_threshold','spin_eligibility','add_on','product_discount','category_discount','clearance','live_lottery','member_offer') NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`status` enum('draft','active','paused','ended') NOT NULL DEFAULT 'draft',
	`priority` int NOT NULL DEFAULT 100,
	`stackable` boolean NOT NULL DEFAULT false,
	`config` json NOT NULL,
	`usageLimit` int,
	`usageCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketing_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketing_segments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`filterConfig` json NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketing_segments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `member_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`token` varchar(64) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `member_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `member_links_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `membership_fee_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`receiptFileUrl` varchar(500),
	`receiptUploadedAt` timestamp NOT NULL,
	`reviewedByStaffId` int,
	`reviewStatus` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewNotes` text,
	`reviewedAt` timestamp,
	`flowSentAt` timestamp,
	`flowStatus` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`flowErrorMessage` text,
	`flowTemplateId` int,
	`telegramLinkClicked` boolean DEFAULT false,
	`telegramLinkClickedAt` timestamp,
	`needsManualFollowUp` boolean DEFAULT false,
	`followUpNotes` text,
	`followUpCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `membership_fee_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messenger_flow_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`messageContent` text NOT NULL,
	`imageUrl` varchar(500),
	`videoUrl` varchar(500),
	`audioUrl` varchar(500),
	`buttonName` varchar(100) DEFAULT '进入心田会员系统',
	`buttonLink` varchar(500),
	`reminderEnabled` boolean DEFAULT true,
	`reminderDelayHours` int DEFAULT 24,
	`reminderMessage` text,
	`reminderMaxCount` int DEFAULT 3,
	`followUpEnabled` boolean DEFAULT true,
	`followUpDelayHours` int DEFAULT 72,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `messenger_flow_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int,
	`customerId` int,
	`type` varchar(50) NOT NULL,
	`channel` enum('messenger','whatsapp','email') NOT NULL DEFAULT 'messenger',
	`message` text,
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`externalMessageId` varchar(255),
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notification_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_change_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestNumber` varchar(50) NOT NULL,
	`orderId` int NOT NULL,
	`orderNumber` varchar(50) NOT NULL,
	`customerId` int,
	`customerName` varchar(255),
	`requestType` enum('add_item','remove_item','change_quantity','change_address','change_phone','change_variant','cancel_item','cancel_order','other') NOT NULL,
	`changeDetails` json NOT NULL,
	`aiLogId` int,
	`detectedIntent` varchar(100),
	`originalMessage` text,
	`status` enum('waiting_approval','approved','rejected','expired','invalid') NOT NULL DEFAULT 'waiting_approval',
	`approvedBy` varchar(255),
	`approvedAt` timestamp,
	`rejectedBy` varchar(255),
	`rejectedAt` timestamp,
	`rejectReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_change_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_change_requests_requestNumber_unique` UNIQUE(`requestNumber`)
);
--> statement-breakpoint
CREATE TABLE `order_exception_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`exceptionId` int NOT NULL,
	`orderItemId` int NOT NULL,
	`productId` int NOT NULL,
	`productName` varchar(255) NOT NULL,
	`quantity` int NOT NULL,
	`unitCost` decimal(10,2) DEFAULT '0',
	`totalScrapCost` decimal(10,2) DEFAULT '0',
	`isScrapped` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_exception_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_exception_replacements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`exceptionId` int NOT NULL,
	`originalOrderItemId` int NOT NULL,
	`originalProductId` int NOT NULL,
	`originalProductName` varchar(255) NOT NULL,
	`originalQuantity` int NOT NULL,
	`newProductId` int NOT NULL,
	`newProductName` varchar(255) NOT NULL,
	`newQuantity` int NOT NULL,
	`newUnitPrice` decimal(10,2) NOT NULL,
	`newSubtotal` decimal(10,2) NOT NULL,
	`newOrderItemId` int,
	`createdBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_exception_replacements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_exceptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`orderItemId` int,
	`exceptionType` enum('out_of_stock','quality_issue','overcharged_shipping','delivery_delay','cancelled_item','other') NOT NULL,
	`resolutionType` enum('replace','wait_restock','refund','pending') DEFAULT 'pending',
	`status` enum('open','resolved','cancelled') NOT NULL DEFAULT 'open',
	`scrapCost` decimal(10,2) DEFAULT '0',
	`refundAmount` decimal(10,2) DEFAULT '0',
	`refundId` int,
	`description` text,
	`quantity` int DEFAULT 0,
	`customerAction` enum('replace_product','wait_restock','refund','pending') DEFAULT 'pending',
	`replacementProductId` int,
	`replacementProductName` varchar(255),
	`replacementQuantity` int DEFAULT 0,
	`replacementUnitPrice` decimal(10,2) DEFAULT '0',
	`refundMethod` enum('credit','tng','cash'),
	`createdBy` varchar(255),
	`resolvedBy` varchar(255),
	`itemLevel` boolean NOT NULL DEFAULT false,
	`waitingForRestock` boolean NOT NULL DEFAULT false,
	`closedAt` timestamp,
	`closedBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`resolvedAt` timestamp,
	CONSTRAINT `order_exceptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_item_repots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderItemId` int NOT NULL,
	`orderId` int NOT NULL,
	`productId` int NOT NULL,
	`productName` varchar(255) NOT NULL,
	`potProductId` int NOT NULL,
	`potProductName` varchar(255) NOT NULL,
	`quantity` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_item_repots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int NOT NULL,
	`productName` varchar(255) NOT NULL,
	`productSku` varchar(100),
	`productType` enum('physical','membership','gift'),
	`giftSlot` int,
	`variationId` int,
	`variationName` varchar(255),
	`facebookKeyword` varchar(100),
	`quantity` int NOT NULL,
	`unitPrice` decimal(10,2) NOT NULL,
	`discount` decimal(10,2) DEFAULT '0',
	`subtotal` decimal(10,2) NOT NULL,
	`unitWeight` decimal(8,2) DEFAULT '0',
	`itemSource` enum('admin','facebook_live','messenger','mall') DEFAULT 'admin',
	`salesMode` enum('normal','presale','import_preorder') DEFAULT 'normal',
	`priceType` enum('retail','wholesale','agent','special','manual') DEFAULT 'retail',
	`unitCost` decimal(10,2) DEFAULT '0',
	`originalUnitPrice` decimal(10,2),
	`marketingCampaignId` int,
	`marketingRuleId` int,
	`marketingSource` enum('campaign_discount','campaign_gift','add_on','lottery_prize','clearance'),
	`marketingDiscount` decimal(10,2) DEFAULT '0',
	`marketingSnapshot` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_operation_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`operationType` varchar(50) NOT NULL,
	`description` text,
	`changes` text,
	`operator` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_operation_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`paymentDate` timestamp,
	`paymentMethod` varchar(100),
	`receiptUrl` varchar(500),
	`purpose` varchar(255),
	`operatorId` int,
	`operatorName` varchar(255),
	`notes` text,
	`paymentSource` varchar(50) NOT NULL DEFAULT 'admin_manual',
	`reviewStatus` varchar(20) NOT NULL DEFAULT 'approved',
	`reviewedBy` varchar(255),
	`reviewedAt` bigint,
	`rejectReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_refund_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`refundId` int NOT NULL,
	`orderItemId` int,
	`productId` int,
	`productName` varchar(255) NOT NULL,
	`productSku` varchar(100),
	`refundQuantity` int NOT NULL,
	`unitPrice` decimal(10,2) NOT NULL DEFAULT '0',
	`unitCost` decimal(10,2) NOT NULL DEFAULT '0',
	`refundAmount` decimal(10,2) NOT NULL DEFAULT '0',
	`inventoryTreatment` enum('return_to_sale','write_off','none','pending_return') NOT NULL DEFAULT 'none',
	`inventoryActionStatus` enum('not_required','pending','returned','written_off','reversed') NOT NULL DEFAULT 'not_required',
	`inventoryAdjustmentId` int,
	`inventoryHandledBy` varchar(255),
	`inventoryHandledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_refund_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_refunds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`sourceExceptionId` int,
	`refundNumber` varchar(50),
	`status` enum('pending','processed','awaiting_return','rejected','cancelled') NOT NULL DEFAULT 'processed',
	`requestedAmount` decimal(10,2) NOT NULL DEFAULT '0',
	`amount` decimal(10,2) NOT NULL,
	`refundMethod` varchar(100) NOT NULL,
	`refundDate` timestamp,
	`receiptUrl` varchar(500),
	`refundReason` varchar(255),
	`refundReasonCode` varchar(50),
	`refundSource` varchar(20) NOT NULL DEFAULT 'manual',
	`issueDescription` text,
	`customerRefundDetails` text,
	`customerRefundQrUrl` varchar(500),
	`attachmentUrls` text,
	`internalNotes` text,
	`notes` text,
	`operatorName` varchar(255),
	`requestedBy` varchar(255),
	`processedBy` varchar(255),
	`processedAt` timestamp,
	`rejectedBy` varchar(255),
	`rejectedAt` timestamp,
	`cancelledBy` varchar(255),
	`cancelledAt` timestamp,
	`creditLedgerId` int,
	`inventoryFinalizedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_refunds_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_refunds_sourceExceptionId_unique` UNIQUE(`sourceExceptionId`),
	CONSTRAINT `order_refunds_refundNumber_unique` UNIQUE(`refundNumber`)
);
--> statement-breakpoint
CREATE TABLE `order_remarks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`type` enum('live','customer','internal') NOT NULL,
	`remarkCategory` enum('repotting','desired_delivery_date','select_tree','other','customer_other'),
	`content` text NOT NULL,
	`scheduledShippingDate` date,
	`desiredDeliveryDate` date,
	`desiredDeliveryReason` varchar(255),
	`repottingData` text,
	`createdBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_remarks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_seq` (
	`id` int AUTO_INCREMENT NOT NULL,
	`prefix` varchar(10) NOT NULL,
	`next_number` int NOT NULL DEFAULT 1,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_seq_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_special_statuses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`type` enum('pending_shipping','pending_refund','company_bear','logistics_error','incomplete_info','notification_failed','stock_exception','overdue','over_payment','amount_changed','amount_anomaly','other') NOT NULL,
	`status` enum('pending','resolved','cancelled','false_positive') NOT NULL DEFAULT 'pending',
	`reason` text,
	`amount` decimal(10,2) DEFAULT '0',
	`source` enum('system','manual') NOT NULL DEFAULT 'system',
	`resolution` varchar(255),
	`resolutionMethod` enum('credit','tng','cash','bank_transfer','other','data_corrected','company_bear','false_positive'),
	`resolutionRemark` text,
	`createdBy` varchar(255),
	`resolvedBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_special_statuses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_status_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`fromStatus` varchar(50),
	`toStatus` varchar(50) NOT NULL,
	`changedBy` varchar(255),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_status_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_sub_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parentOrderId` int NOT NULL,
	`subOrderNumber` varchar(60) NOT NULL,
	`subOrderType` enum('normal','standalone') NOT NULL,
	`itemsSubtotal` decimal(10,2) DEFAULT '0',
	`shippingMethod` enum('normal_rule','fixed_fee','free_shipping') NOT NULL DEFAULT 'normal_rule',
	`shippingFee` decimal(10,2) DEFAULT '0',
	`totalAmount` decimal(10,2) DEFAULT '0',
	`actualWeight` decimal(8,2),
	`actualShippingFee` decimal(10,2),
	`awbNumber` varchar(100),
	`trackingNumber` varchar(100),
	`courierCompany` varchar(100),
	`status` enum('pending','ready_to_ship','shipped','cancelled') DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_sub_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_sub_orders_subOrderNumber_unique` UNIQUE(`subOrderNumber`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(50) NOT NULL,
	`customerId` int NOT NULL,
	`facebookName` varchar(255),
	`facebookId` varchar(255),
	`messengerId` varchar(255),
	`orderType` enum('physical','membership','mixed') NOT NULL,
	`salesChannel` enum('retail','wholesale','agent','import_preorder') NOT NULL DEFAULT 'retail',
	`physicalSubtotal` decimal(10,2) DEFAULT '0',
	`membershipSubtotal` decimal(10,2) DEFAULT '0',
	`shippingFee` decimal(10,2) DEFAULT '0',
	`totalAmount` decimal(10,2) NOT NULL,
	`paidAmount` decimal(10,2) DEFAULT '0',
	`overpaidAmount` decimal(10,2) DEFAULT '0',
	`refundedAmount` decimal(10,2) DEFAULT '0',
	`resolvedOverpaymentAmount` decimal(10,2) DEFAULT '0',
	`physicalStatus` enum('pending','receipt_uploaded','partial_payment','hold_order','packing','shipped','partial_shipped','completed','cancelled','scheduled','special') DEFAULT 'pending',
	`membershipStatus` enum('pending','fee_confirmed','manual_follow_up','completed','rejected','cancelled') DEFAULT 'pending',
	`shippingAddress` text,
	`shippingMethod` enum('west_malaysia','east_malaysia_shopee','east_malaysia_poslaju','self_pickup','lalamove'),
	`courierCompany` varchar(100),
	`trackingNumber` varchar(100),
	`paymentMethodId` int,
	`paymentMethodName` varchar(100),
	`receiptUrl` varchar(500),
	`orderSource` enum('facebook_live','facebook_post','facebook_reel','messenger','store','manual') DEFAULT 'manual',
	`sourceName` varchar(255),
	`originalCustomerComment` text,
	`commentDate` timestamp,
	`totalWeight` decimal(8,2) DEFAULT '0',
	`discountAmount` decimal(10,2) DEFAULT '0',
	`discountReason` varchar(500),
	`promotionId` int,
	`promotionName` varchar(255),
	`promotionDiscount` decimal(10,2) DEFAULT '0',
	`extraCharge` decimal(10,2) DEFAULT '0',
	`extraChargeDescription` varchar(500),
	`creditUsed` decimal(10,2) DEFAULT '0',
	`creditRefunded` decimal(10,2) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`paymentUploadedAt` timestamp,
	`paymentConfirmedAt` timestamp,
	`fullPaymentConfirmedAt` timestamp,
	`shippedAt` timestamp,
	`completedAt` timestamp,
	`autoCompleteAt` timestamp,
	`scheduledShippingDate` timestamp,
	`estimatedWeight` decimal(8,2) DEFAULT '0',
	`estimatedChargeableWeight` decimal(8,2) DEFAULT '0',
	`customerPaidShipping` decimal(10,2) DEFAULT '0',
	`actualWeight` decimal(8,2),
	`actualChargeableWeight` decimal(8,2),
	`actualShippingFee` decimal(10,2),
	`shippingDifference` decimal(10,2),
	`shippingProfit` decimal(10,2),
	`shippingLoss` decimal(10,2),
	`isSpecialOrder` boolean NOT NULL DEFAULT false,
	`specialOrderType` enum('pending_shipping','pending_refund','company_bear','logistics_error','incomplete_info','notification_failed','stock_exception','overdue','partial_payment','over_payment','amount_changed','other'),
	`specialOrderStatus` enum('pending','resolved','cancelled') DEFAULT 'pending',
	`specialOrderSource` enum('system','manual') DEFAULT 'manual',
	`specialOrderReason` text,
	`specialOrderBy` varchar(255),
	`specialOrderUpdatedAt` timestamp,
	`parentOrderId` int,
	`orderCategory` enum('local','import') NOT NULL DEFAULT 'local',
	`orderNature` enum('retail','wholesale','agent') NOT NULL DEFAULT 'retail',
	`importBatchId` int,
	`cancelReason` varchar(255),
	`cancelledBy` varchar(255),
	`liveRoomId` int,
	`importStatus` enum('pending','receipt_uploaded','partial_payment','waiting_stock','ready_to_ship','scheduled_ship','partial_shipped','shipped','completed','cancelled') DEFAULT 'pending',
	`recipientName` varchar(255),
	`recipientPhone` varchar(50),
	`addressLine1` varchar(500),
	`addressLine2` varchar(500),
	`postcode` varchar(20),
	`recipientCity` varchar(100),
	`recipientState` varchar(100),
	`recipientPostcode` varchar(20),
	`recipientCountry` varchar(100),
	`secureToken` varchar(64),
	`campaignId` int,
	`campaignName` varchar(255),
	`sourceType` varchar(50),
	`checkoutLink` varchar(255),
	`notificationStatus` enum('pending','sent','failed') DEFAULT 'pending',
	`notificationError` text,
	`notificationSentAt` timestamp,
	`cancelProtection` boolean NOT NULL DEFAULT false,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderNumber_unique` UNIQUE(`orderNumber`),
	CONSTRAINT `orders_secureToken_unique` UNIQUE(`secureToken`)
);
--> statement-breakpoint
CREATE TABLE `package_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packageId` int NOT NULL,
	`orderItemId` int NOT NULL,
	`quantity` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `package_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `package_order_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packageId` int NOT NULL,
	`orderId` int NOT NULL,
	`shippingCostShare` decimal(10,2) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `package_order_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_package_order_links_package_order` UNIQUE(`packageId`,`orderId`)
);
--> statement-breakpoint
CREATE TABLE `packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`packageNumber` int NOT NULL,
	`batchNo` int NOT NULL DEFAULT 1,
	`isMerged` boolean NOT NULL DEFAULT false,
	`mergedOrderIds` text,
	`courier` varchar(100) NOT NULL,
	`shippingType` enum('auto','manual') NOT NULL DEFAULT 'manual',
	`trackingNumber` varchar(100),
	`shippingLabelUrl` varchar(500),
	`providerOrderId` varchar(100),
	`weight` decimal(8,2) DEFAULT '0',
	`shippingCost` decimal(10,2),
	`status` enum('pending','shipped','delivered') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`shippedAt` timestamp,
	`deliveredAt` timestamp,
	CONSTRAINT `packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`type` enum('qr_code','bank_transfer','cash','other') NOT NULL DEFAULT 'qr_code',
	`qrImageUrl` varchar(500),
	`bankName` varchar(100),
	`accountHolder` varchar(255),
	`accountNumber` varchar(50),
	`paymentInstruction` text,
	`remark` text,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_methods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_attributes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`attributeName` varchar(100) NOT NULL,
	`attributeValue` varchar(255) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isFilterable` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_attributes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_bundle_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bundleId` int NOT NULL,
	`productId` int NOT NULL,
	`variantId` int,
	`productName` varchar(200) NOT NULL,
	`variantName` varchar(100),
	`qtyPerBundle` int NOT NULL DEFAULT 1,
	`unitCost` decimal(10,2) NOT NULL DEFAULT '0',
	`unitPrice` decimal(10,2) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_bundle_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_bundles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`nameEn` varchar(200),
	`keyword` varchar(50) NOT NULL,
	`sellingPrice` decimal(10,2) NOT NULL,
	`originalTotalPrice` decimal(10,2) NOT NULL DEFAULT '0',
	`specialPrice` decimal(10,2),
	`coverImage` varchar(500),
	`description` text,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`showInMall` boolean NOT NULL DEFAULT true,
	`weight` decimal(8,2) NOT NULL DEFAULT '0',
	`internalNotes` text,
	`bundleStock` int NOT NULL DEFAULT 0,
	`totalCost` decimal(10,2) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_bundles_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_bundles_keyword_unique` UNIQUE(`keyword`)
);
--> statement-breakpoint
CREATE TABLE `product_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`parentId` int,
	`sortOrder` int DEFAULT 0,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`url` varchar(500) NOT NULL,
	`fileKey` varchar(300) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isMain` boolean NOT NULL DEFAULT false,
	`altText` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_variations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`stockQuantity` int DEFAULT 0,
	`keywords` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_variations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`url` varchar(500) NOT NULL,
	`fileKey` varchar(300) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isMain` boolean NOT NULL DEFAULT false,
	`thumbnailUrl` varchar(500),
	`duration` int,
	`altText` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_videos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`type` enum('physical','membership','gift') NOT NULL,
	`productMode` enum('simple','variant') NOT NULL DEFAULT 'simple',
	`categoryId` int,
	`unitId` int,
	`keyword` varchar(50) NOT NULL,
	`sku` varchar(30) NOT NULL,
	`status` enum('draft','active','inactive','out_of_stock') NOT NULL DEFAULT 'draft',
	`visibility` enum('public','link_only','hidden') NOT NULL DEFAULT 'public',
	`priceVisibility` enum('show','hide','member_link') NOT NULL DEFAULT 'show',
	`shortDescZh` text,
	`shortDescEn` text,
	`fullDescZh` text,
	`fullDescEn` text,
	`careZh` text,
	`careEn` text,
	`description` text,
	`coverImageUrl` varchar(500),
	`images` text,
	`sellingPrice` decimal(10,2),
	`compareAtPrice` decimal(10,2),
	`memberPrice` decimal(10,2),
	`estimatedCost` decimal(10,2),
	`currentCost` decimal(10,2),
	`cost` decimal(10,2),
	`regularPrice` decimal(10,2),
	`originalPrice` decimal(10,2),
	`specialPrice` decimal(10,2),
	`dimensions` json,
	`weightKg` decimal(8,2),
	`stockQuantity` int DEFAULT 0,
	`reservedQuantity` int NOT NULL DEFAULT 0,
	`isPreOrder` boolean DEFAULT false,
	`isListed` boolean DEFAULT true,
	`isSpecialItem` boolean DEFAULT false,
	`allowFreeShipping` boolean DEFAULT true,
	`isFeatured` boolean NOT NULL DEFAULT false,
	`featuredSortOrder` int NOT NULL DEFAULT 0,
	`categories` text,
	`keywords` varchar(500),
	`keywordChannels` text,
	`videoUrl` varchar(500),
	`membershipIntro` text,
	`telegramFlowLink` varchar(500),
	`facebookFlowId` varchar(255),
	`allowStandalonePurchase` boolean DEFAULT true,
	`allowMixedCheckout` boolean DEFAULT true,
	`seoTitle` varchar(200),
	`seoDesc` text,
	`syncToMall` boolean NOT NULL DEFAULT false,
	`mallSortOrder` int NOT NULL DEFAULT 0,
	`isPot` boolean NOT NULL DEFAULT false,
	`potCapacity` varchar(100),
	`isSpecial` boolean NOT NULL DEFAULT false,
	`allowPresale` boolean NOT NULL DEFAULT false,
	`allowStandaloneShipping` boolean NOT NULL DEFAULT false,
	`standaloneShippingMethod` enum('fixed_fee','free_shipping') DEFAULT 'fixed_fee',
	`standaloneShippingFee` decimal(10,2) DEFAULT '0',
	`lightDesc` text,
	`waterDesc` text,
	`fertilizerDesc` text,
	`pruningDesc` text,
	`salesMode` enum('normal','presale','import_preorder') NOT NULL DEFAULT 'normal',
	`orderCategory` enum('local','import') NOT NULL DEFAULT 'local',
	`allowImportOrder` boolean NOT NULL DEFAULT false,
	`preorderWaitDays` varchar(100),
	`spotSaleEnabled` boolean NOT NULL DEFAULT false,
	`spotSaleQty` int NOT NULL DEFAULT 0,
	`linkedBatchId` int,
	`wholesalePrice` decimal(10,2),
	`agentPrice` decimal(10,2),
	`moq` int NOT NULL DEFAULT 0,
	`visibleTo` text,
	`specialPriceStartDate` timestamp,
	`specialPriceEndDate` timestamp,
	`aiTags` text,
	`aiSellingPoints` text,
	`allowOversold` boolean NOT NULL DEFAULT false,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_keyword_unique` UNIQUE(`keyword`),
	CONSTRAINT `products_sku_unique` UNIQUE(`sku`)
);
--> statement-breakpoint
CREATE TABLE `purchase_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseOrderId` int NOT NULL,
	`productId` int NOT NULL,
	`variantId` int,
	`variantName` varchar(100),
	`variantKeyword` varchar(50),
	`sellingPrice` decimal(10,2),
	`quantity` int NOT NULL,
	`unitCost` decimal(10,2) NOT NULL,
	`subtotal` decimal(12,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchase_order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`poNumber` varchar(50) NOT NULL,
	`supplierId` int NOT NULL,
	`totalAmount` decimal(12,2) NOT NULL,
	`status` enum('draft','ordered','received','cancelled') NOT NULL DEFAULT 'draft',
	`notes` text,
	`orderedAt` timestamp,
	`receivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchase_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchase_orders_poNumber_unique` UNIQUE(`poNumber`)
);
--> statement-breakpoint
CREATE TABLE `regression_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`setId` int NOT NULL,
	`question` text NOT NULL,
	`expectedSource` varchar(50),
	`expectedKeywords` text,
	`expectedReply` text,
	`category` varchar(100),
	`priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`isEnabled` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `regression_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `regression_run_details` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`questionId` int NOT NULL,
	`question` text NOT NULL,
	`finalSource` varchar(50) NOT NULL,
	`matchedRuleId` int,
	`matchedKnowledgeId` int,
	`matchedProductId` int,
	`aiReply` text,
	`shouldHandover` boolean NOT NULL DEFAULT false,
	`processingTimeMs` int,
	`llmCalled` boolean NOT NULL DEFAULT false,
	`processingSteps` json,
	`baselineSource` varchar(50),
	`baselineReply` text,
	`baselineRuleId` int,
	`baselineKnowledgeId` int,
	`baselineProductId` int,
	`baselineIsHandover` boolean,
	`isPassed` boolean NOT NULL DEFAULT false,
	`differences` json,
	`suggestion` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `regression_run_details_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `regression_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`setId` int NOT NULL,
	`versionId` int,
	`isBaseline` boolean NOT NULL DEFAULT false,
	`baselineRunId` int,
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`totalQuestions` int NOT NULL DEFAULT 0,
	`passedCount` int NOT NULL DEFAULT 0,
	`failedCount` int NOT NULL DEFAULT 0,
	`accuracy` decimal(5,2) NOT NULL DEFAULT '0',
	`avgProcessingMs` int NOT NULL DEFAULT 0,
	`newHits` int NOT NULL DEFAULT 0,
	`lostHits` int NOT NULL DEFAULT 0,
	`sourceChanged` int NOT NULL DEFAULT 0,
	`replyChanged` int NOT NULL DEFAULT 0,
	`noMatchIncreased` int NOT NULL DEFAULT 0,
	`noMatchDecreased` int NOT NULL DEFAULT 0,
	`handoverIncreased` int NOT NULL DEFAULT 0,
	`llmIncreased` int NOT NULL DEFAULT 0,
	`llmDecreased` int NOT NULL DEFAULT 0,
	`runBy` varchar(255) NOT NULL,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `regression_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `regression_sets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(100),
	`isEnabled` boolean NOT NULL DEFAULT true,
	`createdBy` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `regression_sets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reply_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`triggerKeywords` text NOT NULL,
	`replyContent` text NOT NULL,
	`actionType` enum('text_only','button','template') NOT NULL DEFAULT 'text_only',
	`actionData` text,
	`priority` int NOT NULL DEFAULT 100,
	`channels` varchar(255) NOT NULL DEFAULT '["messenger","whatsapp"]',
	`isEnabled` boolean NOT NULL DEFAULT true,
	`usageCount` int NOT NULL DEFAULT 0,
	`lastMatchedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reply_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reservation_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`productName` varchar(200),
	`variantId` int,
	`quantity` int NOT NULL,
	`source` enum('draft_order','change_request') NOT NULL,
	`referenceNumber` varchar(50) NOT NULL,
	`referenceId` int NOT NULL,
	`status` enum('active','converted','released') NOT NULL DEFAULT 'active',
	`convertedAt` timestamp,
	`releasedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reservation_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`providerKey` varchar(50) NOT NULL,
	`courier` varchar(50) NOT NULL,
	`providerOrderId` varchar(100),
	`trackingNumber` varchar(100),
	`consignmentNoteUrl` varchar(500),
	`actualWeight` decimal(8,2) NOT NULL,
	`shippingCost` decimal(10,2),
	`status` enum('created','checked_out','in_transit','delivered','failed','cancelled') NOT NULL DEFAULT 'created',
	`rawResponse` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`checkedOutAt` timestamp,
	`shippedAt` timestamp,
	`deliveredAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shipping_providers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`providerKey` varchar(50) NOT NULL,
	`displayName` varchar(100) NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT false,
	`environment` enum('sandbox','production') NOT NULL DEFAULT 'production',
	`credentials` text,
	`supportedCouriers` text,
	`lastSyncAt` timestamp,
	`accountBalance` decimal(12,2),
	`config` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipping_providers_id` PRIMARY KEY(`id`),
	CONSTRAINT `shipping_providers_providerKey_unique` UNIQUE(`providerKey`)
);
--> statement-breakpoint
CREATE TABLE `shipping_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`zone` enum('west_malaysia','east_malaysia','self_pickup','lalamove') NOT NULL,
	`displayName` varchar(100) NOT NULL,
	`freeShippingThreshold` decimal(10,2),
	`freeShippingMaxWeight` decimal(8,2),
	`additionalKgPrice` decimal(10,2),
	`defaultCourier` varchar(50),
	`maxCalculateWeight` decimal(8,2),
	`specialInstruction` text,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipping_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `special_order_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`actionType` enum('notify_shortage','confirm_received','refund','company_bear','remark','convert_to_credit') NOT NULL,
	`amount` decimal(10,2) DEFAULT '0',
	`performedBy` varchar(255) NOT NULL,
	`remark` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `special_order_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_allocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` int NOT NULL,
	`orderId` int NOT NULL,
	`orderNumber` varchar(50) NOT NULL,
	`productId` int NOT NULL,
	`variantId` int,
	`allocatedQty` int NOT NULL DEFAULT 0,
	`allocationType` enum('auto','manual') NOT NULL DEFAULT 'auto',
	`originalOrderId` int,
	`originalOrderNumber` varchar(50),
	`adjustmentReason` text,
	`operatorName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stock_allocations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`contactPerson` varchar(100),
	`phoneNumber` varchar(20),
	`email` varchar(255),
	`address` text,
	`bankAccount` varchar(255),
	`notes` text,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyName` varchar(255),
	`companyLogoUrl` varchar(500),
	`companyAddress` text,
	`companyPhone` varchar(50),
	`companyEmail` varchar(255),
	`companyWebsite` varchar(255),
	`businessRegNo` varchar(100),
	`defaultShipFromAddress` text,
	`defaultShipFromPhone` varchar(50),
	`defaultShipFromName` varchar(255),
	`defaultShipFromPostcode` varchar(10),
	`defaultShipFromState` varchar(100),
	`defaultShipFromCity` varchar(100),
	`currency` varchar(10) NOT NULL DEFAULT 'MYR',
	`timezone` varchar(50) NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
	`orderPrefix` varchar(20) NOT NULL DEFAULT 'ORD',
	`localOrderPrefix` varchar(20) NOT NULL DEFAULT 'XT',
	`importOrderPrefix` varchar(20) NOT NULL DEFAULT 'XTC',
	`orderNumberPadding` int NOT NULL DEFAULT 5,
	`poPrefix` varchar(20) NOT NULL DEFAULT 'PO',
	`poNumberPadding` int NOT NULL DEFAULT 5,
	`customerPrefix` varchar(20) NOT NULL DEFAULT 'CUS',
	`customerNumberPadding` int NOT NULL DEFAULT 5,
	`skuPrefix` varchar(20) NOT NULL DEFAULT 'SKU',
	`skuNumberPadding` int NOT NULL DEFAULT 5,
	`notifyOnNewOrder` boolean NOT NULL DEFAULT true,
	`notifyOnPayment` boolean NOT NULL DEFAULT true,
	`notifyOnShipment` boolean NOT NULL DEFAULT true,
	`notifyEmail` varchar(255),
	`requireStaffLogin` boolean NOT NULL DEFAULT true,
	`autoCompleteDays` int NOT NULL DEFAULT 7,
	`localOrderExpiryTaskUid` varchar(65),
	`liveCommentFooter` text,
	`checkoutMessageTemplate` text,
	`liveWinNoticeTemplate` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `units` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nameZh` varchar(20) NOT NULL,
	`nameEn` varchar(20) NOT NULL,
	`isDefault` boolean NOT NULL DEFAULT false,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	CONSTRAINT `units_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`keyword` varchar(50) NOT NULL,
	`sku` varchar(30) NOT NULL,
	`sellingPrice` decimal(10,2),
	`compareAtPrice` decimal(10,2),
	`memberPrice` decimal(10,2),
	`estimatedCost` decimal(10,2),
	`currentCost` decimal(10,2),
	`weight` decimal(8,2),
	`dimensions` json,
	`status` enum('active','inactive','hidden') NOT NULL DEFAULT 'active',
	`visibility` enum('public','link_only','hidden') NOT NULL DEFAULT 'public',
	`sortOrder` int NOT NULL DEFAULT 0,
	`imageUrl` varchar(500),
	`stockQuantity` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `variants_sku_unique` UNIQUE(`sku`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `preferredLanguage` enum('zh','en') DEFAULT 'zh' NOT NULL;--> statement-breakpoint
CREATE INDEX `cn_expiry_run_logs_run_at_idx` ON `cn_expiry_run_logs` (`runAt`);--> statement-breakpoint
CREATE INDEX `import_batch_change_logs_ibId_changedAt_idx` ON `import_batch_change_logs` (`ibId`,`changedAt`);--> statement-breakpoint
CREATE INDEX `idx_package_order_links_order` ON `package_order_links` (`orderId`);
