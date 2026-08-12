CREATE TABLE IF NOT EXISTS `ai_notification_actions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `notificationLogId` INT NOT NULL,
  `action` ENUM('manual_sent', 'resolved', 'ignored') NOT NULL,
  `note` TEXT NULL,
  `handledBy` VARCHAR(255) NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ai_notification_actions_log_idx` (`notificationLogId`),
  KEY `ai_notification_actions_created_idx` (`createdAt`)
);
