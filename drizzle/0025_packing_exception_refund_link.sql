ALTER TABLE `order_exceptions` ADD COLUMN `refundId` int NULL;
ALTER TABLE `order_refunds` ADD COLUMN `sourceExceptionId` int NULL;
CREATE UNIQUE INDEX `order_refunds_sourceExceptionId_unique` ON `order_refunds` (`sourceExceptionId`);
CREATE INDEX `order_exceptions_refundId_index` ON `order_exceptions` (`refundId`);
