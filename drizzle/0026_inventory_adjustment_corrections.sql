-- Allow an inventory correction to reference the historical adjustment it corrects.
-- The original row is retained for audit; stock changes are represented by the
-- correction row's signed quantity and cost impact.
ALTER TABLE `inventory_adjustments`
  ADD COLUMN `correctsAdjustmentId` int NULL AFTER `orderExceptionId`;

CREATE INDEX `idx_inventory_adjustments_corrects_adjustment`
  ON `inventory_adjustments` (`correctsAdjustmentId`);
