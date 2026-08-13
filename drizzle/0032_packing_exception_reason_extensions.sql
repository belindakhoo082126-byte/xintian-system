-- V3.3: Extend, without rewriting existing records, the item-level packing
-- exception reasons shown to the operations team.
ALTER TABLE `order_exceptions`
  MODIFY COLUMN `exceptionType` ENUM(
    'out_of_stock',
    'quality_issue',
    'overcharged_shipping',
    'delivery_delay',
    'cancelled_item',
    'other'
  ) NOT NULL;
