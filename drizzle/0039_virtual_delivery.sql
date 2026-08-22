CREATE TABLE IF NOT EXISTS `virtual_delivery_products` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `productId` INT NOT NULL,
  `deliveryType` ENUM('membership','course','resource') NOT NULL,
  `defaultDeliveryMessage` TEXT NULL,
  `allowMixedCheckout` BOOLEAN NOT NULL DEFAULT TRUE,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_virtual_delivery_products_product` (`productId`)
);

CREATE TABLE IF NOT EXISTS `virtual_delivery_packages` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `virtualProductId` INT NOT NULL,
  `variantId` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `deliveryLink` VARCHAR(500) NULL,
  `deliveryMessage` TEXT NULL,
  `contentCost` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_virtual_delivery_packages_variant` (`variantId`),
  UNIQUE KEY `uq_virtual_delivery_packages_name` (`virtualProductId`, `name`)
);

CREATE TABLE IF NOT EXISTS `virtual_delivery_tasks` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `orderId` INT NOT NULL,
  `orderItemId` INT NOT NULL,
  `customerId` INT NOT NULL,
  `virtualProductId` INT NOT NULL,
  `virtualPackageId` INT NULL,
  `deliveryType` ENUM('membership','course','resource') NOT NULL,
  `productNameSnapshot` VARCHAR(255) NOT NULL,
  `packageNameSnapshot` VARCHAR(255) NULL,
  `deliveryLinkSnapshot` VARCHAR(500) NULL,
  `deliveryMessageSnapshot` TEXT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `revenueNet` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `contentCostSnapshot` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `profitAmount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `status` ENUM('pending_manual','sent','failed','cancelled') NOT NULL DEFAULT 'pending_manual',
  `sentAt` TIMESTAMP NULL,
  `sentByUserId` INT NULL,
  `failureReason` TEXT NULL,
  `manualNotes` TEXT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_virtual_delivery_tasks_order_item` (`orderItemId`),
  KEY `idx_virtual_delivery_tasks_status` (`status`),
  KEY `idx_virtual_delivery_tasks_order` (`orderId`)
);

ALTER TABLE `order_items` ADD COLUMN `virtualPackageId` INT NULL AFTER `variationName`;
ALTER TABLE `order_items` ADD COLUMN `virtualDeliveryLinkSnapshot` VARCHAR(500) NULL;
ALTER TABLE `order_items` ADD COLUMN `virtualDeliveryMessageSnapshot` TEXT NULL;
ALTER TABLE `order_items` ADD COLUMN `virtualContentCostSnapshot` DECIMAL(10,2) NULL;
