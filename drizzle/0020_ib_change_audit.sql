-- CN/IB 重构补充：IB 修改审计
CREATE TABLE IF NOT EXISTS `import_batch_change_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `ibId` INT NOT NULL,
  `field` VARCHAR(160) NOT NULL,
  `oldValue` TEXT NULL,
  `newValue` TEXT NULL,
  `changedBy` INT NULL,
  `changedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `import_batch_change_logs_ibId_changedAt_idx` (`ibId`, `changedAt`)
);
