-- V1.2: Order Exceptions (订单异常处理)
CREATE TABLE IF NOT EXISTS `order_exceptions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `orderId` int NOT NULL,
  `orderItemId` int,
  `exceptionType` enum('out_of_stock','quality_issue','overcharged_shipping','other') NOT NULL,
  `resolutionType` enum('replace','wait_restock','refund','pending') DEFAULT 'pending',
  `status` enum('open','resolved','cancelled') NOT NULL DEFAULT 'open',
  `scrapCost` decimal(10,2) DEFAULT '0',
  `refundAmount` decimal(10,2) DEFAULT '0',
  `description` text,
  `createdBy` varchar(255),
  `resolvedBy` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT now(),
  `updatedAt` timestamp NOT NULL DEFAULT now() ON UPDATE now(),
  `resolvedAt` timestamp NULL
);

-- V1.2: Order Exception Items (异常涉及的商品明细)
CREATE TABLE IF NOT EXISTS `order_exception_items` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `exceptionId` int NOT NULL,
  `orderItemId` int NOT NULL,
  `productId` int NOT NULL,
  `productName` varchar(255) NOT NULL,
  `quantity` int NOT NULL,
  `unitCost` decimal(10,2) DEFAULT '0',
  `totalScrapCost` decimal(10,2) DEFAULT '0',
  `isScrapped` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT now()
);

-- V1.2: Order Exception Replacements (更换商品记录)
CREATE TABLE IF NOT EXISTS `order_exception_replacements` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
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
  `createdAt` timestamp NOT NULL DEFAULT now()
);

-- V1.2: Inventory Adjustments (库存手动扣减日志)
CREATE TABLE IF NOT EXISTS `inventory_adjustments` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `productId` int NOT NULL,
  `adjustmentType` enum('quality_issue','plant_death','pest_disease','human_damage','lost','other') NOT NULL,
  `quantityChange` int NOT NULL,
  `unitCost` decimal(10,2) DEFAULT '0',
  `totalCost` decimal(10,2) DEFAULT '0',
  `orderExceptionId` int,
  `adjustedBy` varchar(255),
  `reason` text,
  `remark` text,
  `createdAt` timestamp NOT NULL DEFAULT now()
);
