-- V3.3 Packing, partial fulfilment and merged-shipping compatibility layer.
-- Every new field is nullable or has a safe default so existing orders,
-- packages and exceptions remain valid without a data rewrite.

ALTER TABLE `orders`
  ADD COLUMN `cancelProtection` BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing partially shipped orders must never be picked up by an automatic
-- cancellation flow after this migration.
UPDATE `orders`
SET `cancelProtection` = TRUE
WHERE `physicalStatus` = 'partial_shipped'
  AND `cancelProtection` = FALSE;

ALTER TABLE `packages`
  ADD COLUMN `batchNo` INT NOT NULL DEFAULT 1,
  ADD COLUMN `isMerged` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `mergedOrderIds` TEXT NULL;

CREATE TABLE `package_order_links` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `packageId` INT NOT NULL,
  `orderId` INT NOT NULL,
  `shippingCostShare` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `uq_package_order_links_package_order` UNIQUE (`packageId`, `orderId`),
  INDEX `idx_package_order_links_order` (`orderId`)
);

ALTER TABLE `order_exceptions`
  ADD COLUMN `itemLevel` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `waitingForRestock` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `closedAt` TIMESTAMP NULL,
  ADD COLUMN `closedBy` VARCHAR(255) NULL;
