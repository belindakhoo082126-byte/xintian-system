-- Business AI Integration: Draft Orders, Order Change Requests, Reservation Records
-- Migration: 0010_business_ai.sql

-- 1. Draft Orders
CREATE TABLE `draft_orders` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `draftNumber` varchar(50) NOT NULL UNIQUE,
  `customerId` int,
  `customerName` varchar(255),
  `messengerId` varchar(255),
  `platform` enum('messenger','whatsapp','other') NOT NULL DEFAULT 'messenger',
  `aiLogId` int,
  `detectedIntent` varchar(100),
  `originalMessage` text,
  `items` json NOT NULL,
  `totalAmount` decimal(10, 2) NOT NULL DEFAULT '0',
  `status` enum('waiting_approval','approved','rejected','expired') NOT NULL DEFAULT 'waiting_approval',
  `approvedBy` varchar(255),
  `approvedAt` timestamp NULL,
  `rejectedBy` varchar(255),
  `rejectedAt` timestamp NULL,
  `rejectReason` text,
  `officialOrderId` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Order Change Requests
CREATE TABLE `order_change_requests` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `requestNumber` varchar(50) NOT NULL UNIQUE,
  `orderId` int NOT NULL,
  `orderNumber` varchar(50) NOT NULL,
  `customerId` int,
  `customerName` varchar(255),
  `requestType` enum('add_item','remove_item','change_quantity','change_address','change_phone','cancel_item','other') NOT NULL,
  `changeDetails` json NOT NULL,
  `aiLogId` int,
  `detectedIntent` varchar(100),
  `originalMessage` text,
  `status` enum('waiting_approval','approved','rejected','expired') NOT NULL DEFAULT 'waiting_approval',
  `approvedBy` varchar(255),
  `approvedAt` timestamp NULL,
  `rejectedBy` varchar(255),
  `rejectedAt` timestamp NULL,
  `rejectReason` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Reservation Records
CREATE TABLE `reservation_records` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `productId` int NOT NULL,
  `productName` varchar(200),
  `variantId` int,
  `quantity` int NOT NULL,
  `source` enum('draft_order','change_request') NOT NULL,
  `referenceNumber` varchar(50) NOT NULL,
  `referenceId` int NOT NULL,
  `status` enum('active','converted','released') NOT NULL DEFAULT 'active',
  `convertedAt` timestamp NULL,
  `releasedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 4. Add reservedQuantity to products table
ALTER TABLE `products` ADD COLUMN `reservedQuantity` int DEFAULT 0 NOT NULL;

-- 5. Add detectedIntent to ai_logs
ALTER TABLE `ai_logs` ADD COLUMN `detectedIntent` varchar(100);

-- 6. Add structured handover summary fields to ai_handover_requests
ALTER TABLE `ai_handover_requests` ADD COLUMN `handoverSummary` json;
ALTER TABLE `ai_handover_requests` ADD COLUMN `detectedIntent` varchar(100);
ALTER TABLE `ai_handover_requests` ADD COLUMN `relatedOrderId` int;
ALTER TABLE `ai_handover_requests` ADD COLUMN `trackingStatus` varchar(255);
ALTER TABLE `ai_handover_requests` ADD COLUMN `suggestedNextAction` text;
ALTER TABLE `ai_handover_requests` ADD COLUMN `priorityLevel` enum('high','medium','normal') DEFAULT 'normal';
