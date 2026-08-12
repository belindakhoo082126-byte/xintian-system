-- CN/IB refactor: date-window procurement, auto-created IB linkage, lock controls and change audit.
ALTER TABLE `import_batches`
  ADD COLUMN `documentType` enum('cn','ib') NOT NULL DEFAULT 'cn',
  ADD COLUMN `cnId` int NULL,
  ADD COLUMN `startDate` date NULL,
  ADD COLUMN `endDate` date NULL,
  ADD COLUMN `paymentDeadline` date NULL,
  ADD COLUMN `autoIbId` int NULL,
  ADD COLUMN `isLocked` boolean NOT NULL DEFAULT false,
  ADD COLUMN `lockedAt` timestamp NULL,
  ADD COLUMN `lockedBy` int NULL,
  ADD COLUMN `unlockReason` text NULL;

ALTER TABLE `import_batches`
  ADD KEY `idx_import_batches_documentType_cnId` (`documentType`, `cnId`),
  ADD KEY `idx_import_batches_paymentDeadline` (`paymentDeadline`);

CREATE TABLE `cn_change_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cnId` int NOT NULL,
  `field` varchar(100) NOT NULL,
  `oldValue` text NULL,
  `newValue` text NULL,
  `changedBy` int NULL,
  `changedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cn_change_logs_cnId_changedAt` (`cnId`, `changedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
