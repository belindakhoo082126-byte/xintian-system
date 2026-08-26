CREATE TABLE IF NOT EXISTS `shipping_config_values` (
  `id` int AUTO_INCREMENT NOT NULL,
  `configKey` varchar(64) NOT NULL,
  `config` json NOT NULL,
  `updatedBy` varchar(255),
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `shipping_config_values_id` PRIMARY KEY(`id`),
  CONSTRAINT `shipping_config_values_configKey_unique` UNIQUE(`configKey`)
);
