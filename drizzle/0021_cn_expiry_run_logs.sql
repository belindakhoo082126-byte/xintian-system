CREATE TABLE IF NOT EXISTS `cn_expiry_run_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `inspectedCount` INT NOT NULL DEFAULT 0,
  `cancelledCount` INT NOT NULL DEFAULT 0,
  `failedCount` INT NOT NULL DEFAULT 0,
  `cancelledOrderNumbers` JSON NULL,
  `runAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `cn_expiry_run_logs_run_at_idx` (`runAt`)
);
