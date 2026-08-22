CREATE TABLE `inventory_lots` (
  `id` int AUTO_INCREMENT NOT NULL,
  `lotNo` varchar(100) NOT NULL,
  `purchaseOrderId` int,
  `supplierId` int,
  `productId` int NOT NULL,
  `variantId` int,
  `originalQuantity` int NOT NULL,
  `remainingQuantity` int NOT NULL,
  `unitCost` decimal(10,2) NOT NULL,
  `purchaseDate` timestamp NOT NULL DEFAULT (now()),
  `status` enum('active','depleted','void') NOT NULL DEFAULT 'active',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `inventory_lots_id` PRIMARY KEY(`id`),
  CONSTRAINT `inventory_lots_lotNo_unique` UNIQUE(`lotNo`)
);
--> statement-breakpoint
CREATE TABLE `inventory_ledger` (
  `id` int AUTO_INCREMENT NOT NULL,
  `productId` int NOT NULL,
  `variantId` int,
  `lotId` int,
  `transactionType` varchar(50) NOT NULL,
  `referenceType` varchar(50),
  `referenceId` int,
  `quantityChange` int NOT NULL,
  `balanceAfter` int NOT NULL,
  `unitCost` decimal(10,2) NOT NULL,
  `createdBy` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `inventory_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_inventory_lots_product_fifo` ON `inventory_lots` (`productId`,`status`,`purchaseDate`);
--> statement-breakpoint
CREATE INDEX `idx_inventory_lots_variant_fifo` ON `inventory_lots` (`variantId`,`status`,`purchaseDate`);
--> statement-breakpoint
CREATE INDEX `idx_inventory_lots_purchase_order` ON `inventory_lots` (`purchaseOrderId`);
--> statement-breakpoint
CREATE INDEX `idx_inventory_ledger_reference` ON `inventory_ledger` (`referenceType`,`referenceId`);
--> statement-breakpoint
CREATE INDEX `idx_inventory_ledger_product_time` ON `inventory_ledger` (`productId`,`createdAt`);
--> statement-breakpoint
CREATE INDEX `idx_inventory_ledger_lot` ON `inventory_ledger` (`lotId`);
