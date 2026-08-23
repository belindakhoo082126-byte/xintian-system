-- 新退款号码使用RF序列。唯一约束让首次创建与多人同时退款时只会保留一条序列行。
CREATE UNIQUE INDEX `order_seq_prefix_unique` ON `order_seq` (`prefix`);
