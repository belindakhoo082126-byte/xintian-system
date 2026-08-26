ALTER TABLE `virtual_delivery_products`
  MODIFY COLUMN `deliveryType` ENUM('membership', 'course', 'resource', 'material_kit') NOT NULL;

ALTER TABLE `virtual_delivery_tasks`
  MODIFY COLUMN `deliveryType` ENUM('membership', 'course', 'resource', 'material_kit') NOT NULL;
