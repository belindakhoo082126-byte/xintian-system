-- Refund management: multi-refund workflow, item-level stock treatment, and audit fields.
-- Historical records are retained and treated as already processed refunds.

ALTER TABLE `order_refunds`
  ADD COLUMN `refundNumber` varchar(50) NULL,
  ADD COLUMN `status` enum('pending','processed','awaiting_return','rejected','cancelled') NOT NULL DEFAULT 'processed',
  ADD COLUMN `requestedAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
  ADD COLUMN `refundReason` varchar(255) NULL,
  ADD COLUMN `issueDescription` text NULL,
  ADD COLUMN `customerRefundDetails` text NULL,
  ADD COLUMN `attachmentUrls` text NULL,
  ADD COLUMN `internalNotes` text NULL,
  ADD COLUMN `requestedBy` varchar(255) NULL,
  ADD COLUMN `processedBy` varchar(255) NULL,
  ADD COLUMN `processedAt` timestamp NULL,
  ADD COLUMN `rejectedBy` varchar(255) NULL,
  ADD COLUMN `rejectedAt` timestamp NULL,
  ADD COLUMN `cancelledBy` varchar(255) NULL,
  ADD COLUMN `cancelledAt` timestamp NULL,
  ADD COLUMN `creditLedgerId` int NULL,
  ADD COLUMN `inventoryFinalizedAt` timestamp NULL;

ALTER TABLE `order_refunds`
  ADD UNIQUE KEY `order_refunds_refundNumber_unique` (`refundNumber`),
  ADD KEY `idx_order_refunds_status_createdAt` (`status`, `createdAt`);

UPDATE `order_refunds`
SET
  `requestedAmount` = `amount`,
  `status` = 'processed',
  `processedAt` = COALESCE(`refundDate`, `createdAt`),
  `processedBy` = `operatorName`
WHERE `requestedAmount` = '0.00'
  AND `amount` > '0.00';

CREATE TABLE `order_refund_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `refundId` int NOT NULL,
  `orderItemId` int NULL,
  `productId` int NULL,
  `productName` varchar(255) NOT NULL,
  `productSku` varchar(100) NULL,
  `refundQuantity` int NOT NULL,
  `unitPrice` decimal(10,2) NOT NULL DEFAULT '0.00',
  `unitCost` decimal(10,2) NOT NULL DEFAULT '0.00',
  `refundAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `inventoryTreatment` enum('return_to_sale','write_off','none','pending_return') NOT NULL DEFAULT 'none',
  `inventoryActionStatus` enum('not_required','pending','returned','written_off','reversed') NOT NULL DEFAULT 'not_required',
  `inventoryAdjustmentId` int NULL,
  `inventoryHandledBy` varchar(255) NULL,
  `inventoryHandledAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_refund_items_refundId` (`refundId`),
  KEY `idx_order_refund_items_orderItemId` (`orderItemId`),
  KEY `idx_order_refund_items_productId` (`productId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
