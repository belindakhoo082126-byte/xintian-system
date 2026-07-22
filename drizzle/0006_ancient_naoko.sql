CREATE TABLE `action_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int,
	`customer_id` int,
	`note_id` int,
	`session_id` int,
	`facebook_comment_id` varchar(200),
	`source` enum('facebook_live','facebook_post','facebook_reel','messenger','whatsapp','store_checkout','admin','customer_service') NOT NULL DEFAULT 'admin',
	`content` text NOT NULL,
	`status` enum('pending','completed') NOT NULL DEFAULT 'pending',
	`created_by` int,
	`created_by_name` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`completed_by` int,
	`completed_by_name` varchar(255),
	`completed_at` timestamp,
	CONSTRAINT `action_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `facebook_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`facebook_comment_id` varchar(200) NOT NULL,
	`facebook_post_id` varchar(200) NOT NULL,
	`session_id` int,
	`facebook_user_id` varchar(200) NOT NULL,
	`customer_id` int,
	`message_original` text NOT NULL,
	`message_normalized` text,
	`comment_created_at` timestamp,
	`keyword_detected` varchar(100),
	`quantity_detected` int,
	`processing_status` enum('pending','matched','no_match','failed','duplicate','blacklisted','out_of_stock','preorder_full') NOT NULL DEFAULT 'pending',
	`failure_reason` text,
	`order_id` int,
	`order_item_id` int,
	`processed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `facebook_comments_id` PRIMARY KEY(`id`),
	CONSTRAINT `facebook_comments_facebook_comment_id_unique` UNIQUE(`facebook_comment_id`)
);
--> statement-breakpoint
CREATE TABLE `order_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`customer_id` int,
	`note_type` enum('customer_note','internal_note','checkout_note') NOT NULL,
	`visibility` enum('customer','internal') NOT NULL DEFAULT 'internal',
	`content` text NOT NULL,
	`source` enum('facebook_live','facebook_post','facebook_reel','messenger','whatsapp','store_checkout','admin','customer_service') NOT NULL DEFAULT 'admin',
	`source_reference_id` varchar(200),
	`needs_action` boolean NOT NULL DEFAULT false,
	`created_by` int,
	`created_by_name` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_code` varchar(50) NOT NULL,
	`session_type` enum('facebook_live','facebook_post','facebook_reel') NOT NULL,
	`facebook_page_id` varchar(100),
	`facebook_post_id` varchar(200),
	`facebook_live_video_id` varchar(200),
	`title` varchar(255) NOT NULL,
	`status` enum('not_listening','comments_only','order_capture_active','paused','ended') NOT NULL DEFAULT 'not_listening',
	`comment_sync_enabled` boolean NOT NULL DEFAULT false,
	`order_capture_enabled` boolean NOT NULL DEFAULT false,
	`auto_detect_enabled` boolean NOT NULL DEFAULT true,
	`auto_sync_comments` boolean NOT NULL DEFAULT true,
	`started_at` timestamp,
	`ended_at` timestamp,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sales_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sales_sessions_session_code_unique` UNIQUE(`session_code`)
);
--> statement-breakpoint
CREATE TABLE `session_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` int NOT NULL,
	`product_id` int NOT NULL,
	`variant_id` int,
	`keyword` varchar(100) NOT NULL,
	`selling_price` decimal(10,2),
	`physical_stock_at_start` int NOT NULL DEFAULT 0,
	`physical_sold_quantity` int NOT NULL DEFAULT 0,
	`preorder_enabled` boolean NOT NULL DEFAULT false,
	`preorder_limit` int,
	`preorder_sold_quantity` int NOT NULL DEFAULT 0,
	`selling_status` enum('available','stopped') NOT NULL DEFAULT 'available',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `session_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `customers` ADD `customerId` varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `displayName` varchar(255);--> statement-breakpoint
ALTER TABLE `customers` ADD `whatsappPhone` varchar(20);--> statement-breakpoint
ALTER TABLE `customers` ADD `avatarUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `customers` ADD `overrideAvatarUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `customers` ADD `customerSource` enum('facebook_live','facebook_messenger','whatsapp','store','admin') DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `blacklistAt` timestamp;--> statement-breakpoint
ALTER TABLE `customers` ADD `blacklistBy` int;--> statement-breakpoint
ALTER TABLE `customers` ADD `unblacklistAt` timestamp;--> statement-breakpoint
ALTER TABLE `customers` ADD `unblacklistBy` int;--> statement-breakpoint
ALTER TABLE `customers` ADD `lastInteractionAt` timestamp;--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_customerId_unique` UNIQUE(`customerId`);