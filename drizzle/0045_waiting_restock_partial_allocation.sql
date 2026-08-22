ALTER TABLE `order_exceptions`
  ADD COLUMN `restockAllocatedQuantity` int NOT NULL DEFAULT 0 AFTER `quantity`;
