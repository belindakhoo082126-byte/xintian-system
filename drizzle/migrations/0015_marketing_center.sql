-- V5.0: Marketing Center
-- All fields use the existing camelCase convention required by TiDB.

ALTER TABLE `order_items`
  ADD COLUMN `marketingCampaignId` INT NULL,
  ADD COLUMN `marketingRuleId` INT NULL,
  ADD COLUMN `marketingSource` ENUM('campaign_discount','campaign_gift','add_on','lottery_prize','clearance') NULL,
  ADD COLUMN `marketingDiscount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN `marketingSnapshot` TEXT NULL;

CREATE TABLE `marketing_campaigns` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `campaignCode` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `status` ENUM('draft','scheduled','active','paused','ended') NOT NULL DEFAULT 'draft',
  `startAt` TIMESTAMP NULL,
  `endAt` TIMESTAMP NULL,
  `orderCategories` TEXT NULL,
  `orderSources` TEXT NULL,
  `customerAudience` ENUM('all','member','non_member','new_customer','segment') NOT NULL DEFAULT 'all',
  `customerSegmentId` INT NULL,
  `showInMall` BOOLEAN NOT NULL DEFAULT FALSE,
  `allowMemberPriceStack` BOOLEAN NOT NULL DEFAULT FALSE,
  `allowBundlePriceStack` BOOLEAN NOT NULL DEFAULT FALSE,
  `allowCouponStack` BOOLEAN NOT NULL DEFAULT FALSE,
  `allowPointsEarn` BOOLEAN NOT NULL DEFAULT TRUE,
  `perCustomerLimit` INT NULL,
  `perOrderLimit` INT NULL,
  `usageLimit` INT NULL,
  `usageCount` INT NOT NULL DEFAULT 0,
  `createdBy` VARCHAR(255) NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_marketing_campaign_code` (`campaignCode`),
  INDEX `idx_marketing_campaign_status` (`status`, `startAt`, `endAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `marketing_rules` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `campaignId` INT NOT NULL,
  `ruleType` ENUM('quantity_gift','nth_item_discount','order_threshold','spin_eligibility','add_on','product_discount','category_discount','clearance','live_lottery','member_offer') NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `status` ENUM('draft','active','paused','ended') NOT NULL DEFAULT 'draft',
  `priority` INT NOT NULL DEFAULT 100,
  `stackable` BOOLEAN NOT NULL DEFAULT FALSE,
  `config` JSON NOT NULL,
  `usageLimit` INT NULL,
  `usageCount` INT NOT NULL DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_marketing_rules_campaign` (`campaignId`, `status`, `priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `marketing_rule_scopes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ruleId` INT NOT NULL,
  `scopeType` ENUM('trigger_product','eligible_product','eligible_category','gift_product','add_on_product') NOT NULL,
  `productId` INT NULL,
  `categoryId` INT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `approvedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_marketing_rule_scope` (`ruleId`, `scopeType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `marketing_order_applications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `orderId` INT NOT NULL,
  `campaignId` INT NOT NULL,
  `ruleId` INT NULL,
  `customerId` INT NOT NULL,
  `applicationType` ENUM('discount','gift','add_on','free_shipping','points','lottery','coupon') NOT NULL,
  `status` ENUM('applied','reversed','expired') NOT NULL DEFAULT 'applied',
  `originalAmount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `discountAmount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `shippingSubsidy` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `pointsGranted` INT NOT NULL DEFAULT 0,
  `snapshot` JSON NOT NULL,
  `appliedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reversedAt` TIMESTAMP NULL,
  UNIQUE KEY `uq_marketing_order_campaign_rule` (`orderId`, `campaignId`, `ruleId`),
  INDEX `idx_marketing_app_campaign` (`campaignId`, `status`),
  INDEX `idx_marketing_app_customer` (`customerId`, `appliedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `marketing_campaign_usages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `campaignId` INT NOT NULL,
  `ruleId` INT NULL,
  `customerId` INT NOT NULL,
  `orderId` INT NOT NULL,
  `status` ENUM('used','reversed') NOT NULL DEFAULT 'used',
  `usedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reversedAt` TIMESTAMP NULL,
  UNIQUE KEY `uq_marketing_campaign_customer_order` (`campaignId`, `customerId`, `orderId`),
  INDEX `idx_marketing_usage_customer` (`customerId`, `campaignId`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `marketing_lottery_prizes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `campaignId` INT NOT NULL,
  `ruleId` INT NULL,
  `name` VARCHAR(255) NOT NULL,
  `prizeType` ENUM('physical_product','coupon','points','membership_days','free_shipping','no_prize') NOT NULL,
  `productId` INT NULL,
  `productQuantity` INT NOT NULL DEFAULT 1,
  `couponCode` VARCHAR(100) NULL,
  `pointsValue` INT NOT NULL DEFAULT 0,
  `membershipDays` INT NOT NULL DEFAULT 0,
  `probabilityWeight` INT NOT NULL DEFAULT 1,
  `quantityLimit` INT NULL,
  `quantityAwarded` INT NOT NULL DEFAULT 0,
  `status` ENUM('active','paused','depleted') NOT NULL DEFAULT 'active',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_marketing_prizes_campaign` (`campaignId`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `marketing_lottery_entries` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `campaignId` INT NOT NULL,
  `ruleId` INT NULL,
  `customerId` INT NOT NULL,
  `orderId` INT NULL,
  `liveRoomId` INT NULL,
  `entrySource` ENUM('order_threshold','live_keyword','live_answer','live_interaction','admin','live_order') NOT NULL,
  `reason` VARCHAR(500) NULL,
  `entryCount` INT NOT NULL DEFAULT 1,
  `usedCount` INT NOT NULL DEFAULT 0,
  `status` ENUM('pending_payment','eligible','drawn','expired','cancelled') NOT NULL DEFAULT 'pending_payment',
  `eligibleAt` TIMESTAMP NULL,
  `expiresAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_marketing_lottery_customer` (`customerId`, `campaignId`, `status`),
  INDEX `idx_marketing_lottery_order` (`orderId`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `marketing_lottery_draws` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `entryId` INT NOT NULL,
  `prizeId` INT NULL,
  `customerId` INT NOT NULL,
  `sourceOrderId` INT NULL,
  `mergedOrderId` INT NULL,
  `orderItemId` INT NULL,
  `status` ENUM('drawn','pending_claim','merged','claimed_in_store','forfeited') NOT NULL DEFAULT 'drawn',
  `prizeSnapshot` JSON NOT NULL,
  `drawnAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `claimedAt` TIMESTAMP NULL,
  INDEX `idx_marketing_draw_customer` (`customerId`, `status`),
  INDEX `idx_marketing_draw_order` (`mergedOrderId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `marketing_segments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `filterConfig` JSON NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdBy` VARCHAR(255) NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `marketing_message_templates` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `channel` ENUM('messenger','manual_copy') NOT NULL DEFAULT 'messenger',
  `subject` VARCHAR(255) NULL,
  `content` TEXT NOT NULL,
  `buttonLabel` VARCHAR(100) NULL,
  `buttonUrl` VARCHAR(500) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdBy` VARCHAR(255) NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `marketing_automation_rules` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `campaignId` INT NULL,
  `name` VARCHAR(255) NOT NULL,
  `triggerType` ENUM('segment','campaign_start','campaign_ending','restock','lottery_eligible','manual_batch') NOT NULL,
  `segmentId` INT NULL,
  `templateId` INT NOT NULL,
  `status` ENUM('paused','active','ended') NOT NULL DEFAULT 'paused',
  `scheduleType` ENUM('once','cron','event') NOT NULL DEFAULT 'event',
  `scheduledAt` TIMESTAMP NULL,
  `heartbeatJobId` VARCHAR(255) NULL,
  `filterConfig` JSON NULL,
  `lastRunAt` TIMESTAMP NULL,
  `createdBy` VARCHAR(255) NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_marketing_automation_status` (`status`, `scheduledAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `marketing_message_deliveries` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `automationRuleId` INT NULL,
  `campaignId` INT NULL,
  `templateId` INT NULL,
  `customerId` INT NOT NULL,
  `orderId` INT NULL,
  `channel` ENUM('messenger','manual_copy') NOT NULL DEFAULT 'messenger',
  `status` ENUM('queued','sent','failed','skipped') NOT NULL DEFAULT 'queued',
  `renderedContent` TEXT NOT NULL,
  `trackingToken` VARCHAR(100) NOT NULL,
  `providerMessageId` VARCHAR(255) NULL,
  `errorMessage` TEXT NULL,
  `sentAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_marketing_delivery_token` (`trackingToken`),
  INDEX `idx_marketing_delivery_customer` (`customerId`, `status`, `createdAt`),
  INDEX `idx_marketing_delivery_rule` (`automationRuleId`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `marketing_message_events` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `deliveryId` INT NOT NULL,
  `eventType` ENUM('opened','clicked','ordered','paid') NOT NULL,
  `orderId` INT NULL,
  `metadata` JSON NULL,
  `occurredAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_marketing_delivery_event_order` (`deliveryId`, `eventType`, `orderId`),
  INDEX `idx_marketing_event_delivery` (`deliveryId`, `occurredAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
