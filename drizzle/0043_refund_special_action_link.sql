ALTER TABLE `order_refunds` ADD COLUMN `sourceSpecialActionId` int;
CREATE UNIQUE INDEX `order_refunds_source_special_action_unique` ON `order_refunds` (`sourceSpecialActionId`);
