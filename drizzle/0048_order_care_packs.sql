CREATE TABLE `product_care_profiles` (
  `id` int AUTO_INCREMENT NOT NULL,
  `productId` int NOT NULL,
  `variationId` int NOT NULL DEFAULT 0,
  `profileType` enum('plant','fertilizer','pesticide','medium','tool','other') NOT NULL,
  `purpose` text,
  `usageMethod` text,
  `dosage` text,
  `frequency` text,
  `suitableFor` text,
  `safetyNotes` text,
  `additionalNotes` text,
  `isEnabled` boolean NOT NULL DEFAULT true,
  `createdBy` varchar(255),
  `updatedBy` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `product_care_profiles_id` PRIMARY KEY(`id`),
  CONSTRAINT `product_care_profiles_product_variation_unique` UNIQUE(`productId`,`variationId`)
);
CREATE INDEX `product_care_profiles_product_idx` ON `product_care_profiles` (`productId`);

CREATE TABLE `care_pack_settings` (
  `id` int AUTO_INCREMENT NOT NULL,
  `finalizationTrigger` enum('checkout','packing_start') NOT NULL DEFAULT 'packing_start',
  `missingContentPolicy` enum('show_notice','block_finalization','exclude_item') NOT NULL DEFAULT 'show_notice',
  `customerTitle` varchar(255) NOT NULL DEFAULT '商品养护／使用知识包',
  `customerIntro` text,
  `employeeTitle` varchar(255) NOT NULL DEFAULT '包裹内商品养护／使用说明',
  `updatedBy` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `care_pack_settings_id` PRIMARY KEY(`id`)
);

CREATE TABLE `order_care_packs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `orderId` int NOT NULL,
  `status` enum('active','finalized','revoked') NOT NULL DEFAULT 'active',
  `publicTokenHash` varchar(64) NOT NULL,
  `tokenVersion` int NOT NULL DEFAULT 1,
  `currentContentHash` varchar(64),
  `finalSnapshot` json,
  `finalizedAt` timestamp,
  `finalizedBy` varchar(255),
  `finalizedTrigger` enum('checkout','packing_start'),
  `revokedAt` timestamp,
  `revokedBy` varchar(255),
  `revokedReason` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `order_care_packs_id` PRIMARY KEY(`id`),
  CONSTRAINT `order_care_packs_order_unique` UNIQUE(`orderId`)
);
CREATE INDEX `order_care_packs_status_idx` ON `order_care_packs` (`status`);

CREATE TABLE `order_care_pack_items` (
  `id` int AUTO_INCREMENT NOT NULL,
  `carePackId` int NOT NULL,
  `productId` int NOT NULL,
  `variationId` int NOT NULL DEFAULT 0,
  `productNameSnapshot` varchar(255) NOT NULL,
  `variationNameSnapshot` varchar(255),
  `sourceOrderItemIds` text NOT NULL,
  `quantity` int NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `order_care_pack_items_id` PRIMARY KEY(`id`),
  CONSTRAINT `order_care_pack_items_pack_product_variant_unique` UNIQUE(`carePackId`,`productId`,`variationId`)
);
CREATE INDEX `order_care_pack_items_product_idx` ON `order_care_pack_items` (`productId`);

CREATE TABLE `order_care_pack_revisions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `carePackId` int NOT NULL,
  `revisionNumber` int NOT NULL,
  `revisionType` enum('created','order_items_changed','product_content_changed','finalized','revoked','rebuilt') NOT NULL,
  `contentSnapshot` json,
  `summary` text,
  `createdBy` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `order_care_pack_revisions_id` PRIMARY KEY(`id`),
  CONSTRAINT `order_care_pack_revisions_pack_revision_unique` UNIQUE(`carePackId`,`revisionNumber`)
);
CREATE INDEX `order_care_pack_revisions_pack_idx` ON `order_care_pack_revisions` (`carePackId`);

CREATE TABLE `care_pack_delivery_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `carePackId` int NOT NULL,
  `action` enum('checkout_attached','manual_resent','link_copied','customer_view','customer_save','customer_print','employee_view','employee_print','revoked','rebuilt') NOT NULL,
  `channel` varchar(50),
  `actorType` enum('customer','staff','system') NOT NULL,
  `actorName` varchar(255),
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `care_pack_delivery_logs_id` PRIMARY KEY(`id`)
);
CREATE INDEX `care_pack_delivery_logs_pack_action_idx` ON `care_pack_delivery_logs` (`carePackId`,`action`);
