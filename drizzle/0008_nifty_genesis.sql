CREATE TABLE `inventory_ledger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`variant_id` int,
	`lot_id` int,
	`transaction_type` enum('purchase','sale','adjustment','transfer','return') NOT NULL,
	`reference_type` varchar(50),
	`reference_id` int,
	`quantity_change` int NOT NULL,
	`balance_after` int NOT NULL,
	`unit_cost` decimal(10,2),
	`created_by` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_lots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lot_no` varchar(30) NOT NULL,
	`purchase_order_id` int NOT NULL,
	`supplier_id` int NOT NULL,
	`product_id` int NOT NULL,
	`variant_id` int,
	`original_quantity` int NOT NULL,
	`remaining_quantity` int NOT NULL,
	`unit_cost` decimal(10,2) NOT NULL,
	`purchase_date` timestamp NOT NULL,
	`status` enum('active','exhausted','cancelled') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_lots_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_lots_lot_no_unique` UNIQUE(`lot_no`)
);
--> statement-breakpoint
ALTER TABLE `purchase_orders` MODIFY COLUMN `status` enum('draft','ordered','received','cancelled','confirmed') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `ai_review_items` ADD `modified_reply` text;--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `variant_id` int;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `purchase_order_no` varchar(30);--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `supplier_document_no` varchar(100);--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `purchase_date` timestamp;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `total_quantity` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `remark` text;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `confirmed_at` timestamp;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `confirmed_by` varchar(100);--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `created_by` varchar(100);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `supplier_code` varchar(20);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `bank_name` varchar(100);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `bank_account_name` varchar(100);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `bank_account_number` varchar(50);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `remark` text;--> statement-breakpoint
ALTER TABLE `suppliers` ADD `status` enum('active','inactive') DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `suppliers` ADD `created_by` varchar(100);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `updated_by` varchar(100);--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_purchase_order_no_unique` UNIQUE(`purchase_order_no`);--> statement-breakpoint
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_supplier_code_unique` UNIQUE(`supplier_code`);