CREATE TABLE `couriers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `couriers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`fieldName` varchar(100),
	`oldValue` text,
	`newValue` text,
	`operatorId` int,
	`operatorName` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`notificationType` enum('order_link','shipping_notice','payment_reminder','custom') NOT NULL,
	`messengerStatus` enum('pending','sent','failed','skipped') NOT NULL DEFAULT 'pending',
	`messengerErrorMessage` text,
	`whatsappStatus` enum('pending','sent','failed','skipped') NOT NULL DEFAULT 'pending',
	`whatsappErrorMessage` text,
	`isManualNotified` boolean NOT NULL DEFAULT false,
	`manualNotifiedAt` timestamp,
	`operatorId` int,
	`operatorName` varchar(100),
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`paymentDate` timestamp NOT NULL,
	`paymentMethod` enum('online_banking','tng','cash','shopee','bank_transfer','other') NOT NULL,
	`receiptUrl` varchar(500),
	`purpose` varchar(200),
	`operatorId` int,
	`operatorName` varchar(100),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_payments_id` PRIMARY KEY(`id`)
);
