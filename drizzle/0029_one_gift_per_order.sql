-- New gift rows receive giftSlot=1. The nullable slot leaves legacy history intact,
-- while this partial application-level rule prevents another active gift per order.
ALTER TABLE `order_items` ADD COLUMN `giftSlot` INT NULL;
CREATE UNIQUE INDEX `order_items_one_gift_per_order` ON `order_items` (`orderId`, `giftSlot`);
