-- V2.0: Live Studio + Order Security Link Migration

-- 1. Add aiReplyEnabled and continueMonitor to live_rooms
ALTER TABLE `live_rooms` ADD COLUMN `aiReplyEnabled` BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE `live_rooms` ADD COLUMN `continueMonitor` BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Add secureToken to orders
ALTER TABLE `orders` ADD COLUMN `secureToken` VARCHAR(64) UNIQUE;

-- 3. Create live_comment_notes table
CREATE TABLE `live_comment_notes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `liveCommentId` INT NOT NULL,
  `liveRoomId` INT NOT NULL,
  `orderId` INT,
  `customerId` INT,
  `content` TEXT NOT NULL,
  `createdBy` VARCHAR(255),
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_lcn_comment` (`liveCommentId`),
  INDEX `idx_lcn_room` (`liveRoomId`),
  INDEX `idx_lcn_order` (`orderId`),
  INDEX `idx_lcn_customer` (`customerId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
