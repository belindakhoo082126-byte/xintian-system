CREATE TABLE `inventory_movement_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `productId` int NOT NULL,
  `variantId` int,
  `movementType` varchar(50) NOT NULL,
  `quantityChange` int NOT NULL,
  `stockBefore` int NOT NULL,
  `stockAfter` int NOT NULL,
  `referenceType` varchar(50),
  `referenceId` int,
  `reason` text,
  `operator` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inventory_movement_product_time` (`productId`, `createdAt`),
  KEY `idx_inventory_movement_variant_time` (`variantId`, `createdAt`),
  KEY `idx_inventory_movement_reference` (`referenceType`, `referenceId`)
);

-- 将既有组合包组件的库存扣减／归还记录精确带入统一流水。仅回填有明确
-- 单一组件名称的旧行，并按组合包、商品、规格、数量、前后库存和原始时间幂等去重。
INSERT INTO `inventory_movement_logs` (
  `productId`, `variantId`, `movementType`, `quantityChange`, `stockBefore`, `stockAfter`,
  `referenceType`, `referenceId`, `reason`, `operator`, `createdAt`
)
SELECT
  pbi.`productId`,
  pbi.`variantId`,
  CASE WHEN bsl.`qtyChange` < 0 THEN 'bundle_component_deduct' ELSE 'bundle_component_return' END,
  bsl.`qtyChange`,
  bsl.`stockBefore`,
  bsl.`stockAfter`,
  'product_bundle',
  bsl.`bundleId`,
  CONCAT('历史组合包库存记录回填：', COALESCE(bsl.`notes`, '')),
  COALESCE(bsl.`operator`, 'system'),
  bsl.`createdAt`
FROM `bundle_stock_logs` bsl
INNER JOIN `product_bundle_items` pbi
  ON pbi.`bundleId` = bsl.`bundleId`
 AND pbi.`productName` = bsl.`affectedProducts`
WHERE bsl.`actionType` IN ('create', 'restock', 'disassemble')
  AND bsl.`qtyChange` <> 0
  AND NOT EXISTS (
    SELECT 1
    FROM `inventory_movement_logs` iml
    WHERE iml.`referenceType` = 'product_bundle'
      AND iml.`referenceId` = bsl.`bundleId`
      AND iml.`productId` = pbi.`productId`
      AND iml.`variantId` <=> pbi.`variantId`
      AND iml.`quantityChange` = bsl.`qtyChange`
      AND iml.`stockBefore` = bsl.`stockBefore`
      AND iml.`stockAfter` = bsl.`stockAfter`
      AND iml.`createdAt` = bsl.`createdAt`
  );
