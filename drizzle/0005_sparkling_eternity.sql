CREATE TABLE `customer_addresses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`label` varchar(50) NOT NULL,
	`recipientName` varchar(255) NOT NULL,
	`recipientPhone` varchar(20) NOT NULL,
	`address` text NOT NULL,
	`city` varchar(100),
	`state` varchar(100),
	`postalCode` varchar(20),
	`country` varchar(100) NOT NULL DEFAULT 'Malaysia',
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_addresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`fieldName` varchar(100),
	`oldValue` text,
	`newValue` text,
	`operatorId` int,
	`operatorName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_credit_ledger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`balanceAfter` decimal(10,2) NOT NULL,
	`type` enum('topup','refund','adjustment','order_deduction','manual') NOT NULL,
	`reason` text,
	`orderId` int,
	`operatorId` int,
	`operatorName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_credit_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_refunds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`orderId` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`refundMethod` enum('bank_transfer','tng','cash','store_credit','other') NOT NULL,
	`reason` text,
	`operatorId` int,
	`operatorName` varchar(255),
	`refundDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_refunds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_timeline` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`eventType` enum('order_created','order_shipped','order_completed','order_cancelled','payment_received','refund_issued','credit_topup','credit_deduction','blacklist_added','blacklist_removed','address_added','address_updated','profile_updated','messenger_message','whatsapp_message','notification_sent','notification_failed','live_comment','other') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`orderId` int,
	`paymentId` int,
	`metadata` text,
	`operatorId` int,
	`operatorName` varchar(255),
	`eventDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_timeline_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `order_items` ADD `variantId` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `orderSource` enum('facebook_live','facebook_comment','facebook_messenger','whatsapp','store','backend') DEFAULT 'backend' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `estimatedShippingFee` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `orders` ADD `actualShippingFee` decimal(10,2);--> statement-breakpoint
ALTER TABLE `orders` ADD `courierId` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `reservedAt` timestamp;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipmentDate` timestamp;--> statement-breakpoint
ALTER TABLE `orders` ADD `cancelledAt` timestamp;