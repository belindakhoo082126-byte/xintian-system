ALTER TABLE `order_exception_items`
  ADD COLUMN `variantId` int NULL AFTER `productId`;

UPDATE `order_exception_items` AS `oei`
INNER JOIN `order_items` AS `oi` ON `oi`.`id` = `oei`.`orderItemId`
SET `oei`.`variantId` = `oi`.`variationId`
WHERE `oei`.`variantId` IS NULL;

CREATE INDEX `order_exception_items_product_variant_idx`
  ON `order_exception_items` (`productId`, `variantId`);
