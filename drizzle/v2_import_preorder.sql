-- V2.0: Import Pre-order Module Migration

-- 1. Add sales mode fields to products table
ALTER TABLE `products` ADD COLUMN `salesMode` ENUM('normal','presale','import_preorder') NOT NULL DEFAULT 'normal';
ALTER TABLE `products` ADD COLUMN `preorderWaitDays` VARCHAR(100);
ALTER TABLE `products` ADD COLUMN `spotSaleEnabled` BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE `products` ADD COLUMN `spotSaleQty` INT NOT NULL DEFAULT 0;
ALTER TABLE `products` ADD COLUMN `linkedBatchId` INT;

-- 2. Add order nature fields to orders table
ALTER TABLE `orders` ADD COLUMN `orderNature` ENUM('normal','import_preorder') NOT NULL DEFAULT 'normal';
ALTER TABLE `orders` ADD COLUMN `importBatchId` INT;
ALTER TABLE `orders` ADD COLUMN `liveRoomId` INT;
ALTER TABLE `orders` ADD COLUMN `importStatus` ENUM('waiting_payment','paid_waiting_close','waiting_purchase','purchased','supplier_preparing','in_transit','arriving_inspection','ready_to_ship','shipped','completed') DEFAULT 'waiting_payment';

-- 3. Add item source and sales mode to order_items table
ALTER TABLE `order_items` ADD COLUMN `itemSource` ENUM('admin','facebook_live','messenger','mall') DEFAULT 'admin';
ALTER TABLE `order_items` ADD COLUMN `salesMode` ENUM('normal','presale','import_preorder') DEFAULT 'normal';

-- 4. Create live_rooms table
CREATE TABLE IF NOT EXISTS `live_rooms` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `liveDate` TIMESTAMP NOT NULL,
  `facebookLiveUrl` VARCHAR(500),
  `facebookVideoId` VARCHAR(255),
  `liveType` ENUM('normal','import_preorder') NOT NULL DEFAULT 'normal',
  `importBatchId` INT,
  `preorderStartDate` TIMESTAMP,
  `preorderEndDate` TIMESTAMP,
  `estimatedWaitDays` VARCHAR(100),
  `status` ENUM('scheduled','live','ended','closed') NOT NULL DEFAULT 'scheduled',
  `notes` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT NOW(),
  `updatedAt` TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW()
);

-- 5. Create import_batches table
CREATE TABLE IF NOT EXISTS `import_batches` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `batchNumber` VARCHAR(50) NOT NULL UNIQUE,
  `batchName` VARCHAR(255) NOT NULL,
  `sourceCountry` VARCHAR(100) NOT NULL DEFAULT '中国',
  `supplierName` VARCHAR(255),
  `liveRoomId` INT,
  `preorderStartDate` TIMESTAMP,
  `preorderEndDate` TIMESTAMP,
  `actualPurchaseDate` TIMESTAMP,
  `shippingMethod` ENUM('air','sea'),
  `chinaShippingCost` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `status` ENUM('in_progress','closed','purchased','preparing','in_transit','partial_arrived','all_arrived','completed') NOT NULL DEFAULT 'in_progress',
  `notes` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT NOW(),
  `updatedAt` TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW()
);

-- 6. Create import_batch_items table
CREATE TABLE IF NOT EXISTS `import_batch_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `batchId` INT NOT NULL,
  `productId` INT NOT NULL,
  `productName` VARCHAR(255) NOT NULL,
  `variantId` INT,
  `variantName` VARCHAR(255),
  `paidQuantity` INT NOT NULL DEFAULT 0,
  `finalPurchaseQuantity` INT NOT NULL DEFAULT 0,
  `actualReceivedQty` INT,
  `healthyQty` INT,
  `damagedQty` INT NOT NULL DEFAULT 0,
  `deadQty` INT NOT NULL DEFAULT 0,
  `missingQty` INT NOT NULL DEFAULT 0,
  `itemStatus` ENUM('pending','all_arrived','partial_arrived','shortage','damaged','dead','missing') DEFAULT 'pending',
  `unitPurchaseCost` DECIMAL(10,2),
  `allocatedShippingCost` DECIMAL(10,2),
  `totalUnitCost` DECIMAL(10,2),
  `spotSaleEnabled` BOOLEAN NOT NULL DEFAULT FALSE,
  `spotSaleQty` INT NOT NULL DEFAULT 0,
  `notes` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT NOW(),
  `updatedAt` TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW()
);
