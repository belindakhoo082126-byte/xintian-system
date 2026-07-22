CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nameZh` varchar(100) NOT NULL,
	`nameEn` varchar(100) NOT NULL,
	`descZh` text,
	`descEn` text,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`showInStore` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`imageUrl` varchar(500),
	`iconUrl` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `member_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`token` varchar(64) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `member_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `member_links_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `product_attributes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`attributeName` varchar(100) NOT NULL,
	`attributeValue` varchar(255) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isFilterable` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_attributes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`url` varchar(500) NOT NULL,
	`fileKey` varchar(300) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isMain` boolean NOT NULL DEFAULT false,
	`altText` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`url` varchar(500) NOT NULL,
	`fileKey` varchar(300) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isMain` boolean NOT NULL DEFAULT false,
	`thumbnailUrl` varchar(500),
	`duration` int,
	`altText` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_videos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `units` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nameZh` varchar(20) NOT NULL,
	`nameEn` varchar(20) NOT NULL,
	`isDefault` boolean NOT NULL DEFAULT false,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	CONSTRAINT `units_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`keyword` varchar(50) NOT NULL,
	`sku` varchar(30) NOT NULL,
	`sellingPrice` decimal(10,2),
	`compareAtPrice` decimal(10,2),
	`memberPrice` decimal(10,2),
	`estimatedCost` decimal(10,2),
	`currentCost` decimal(10,2),
	`weight` decimal(8,2),
	`dimensions` json,
	`status` enum('active','inactive','hidden') NOT NULL DEFAULT 'active',
	`visibility` enum('public','link_only','hidden') NOT NULL DEFAULT 'public',
	`sortOrder` int NOT NULL DEFAULT 0,
	`imageUrl` varchar(500),
	`stockQuantity` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `variants_sku_unique` UNIQUE(`sku`)
);
--> statement-breakpoint
ALTER TABLE `products` MODIFY COLUMN `name` varchar(200) NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `productMode` enum('simple','variant') DEFAULT 'simple' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `unitId` int;--> statement-breakpoint
ALTER TABLE `products` ADD `keyword` varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `sku` varchar(30) NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `status` enum('draft','active','inactive','out_of_stock') DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `visibility` enum('public','link_only','hidden') DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `priceVisibility` enum('show','hide','member_link') DEFAULT 'show' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `shortDescZh` text;--> statement-breakpoint
ALTER TABLE `products` ADD `shortDescEn` text;--> statement-breakpoint
ALTER TABLE `products` ADD `fullDescZh` text;--> statement-breakpoint
ALTER TABLE `products` ADD `fullDescEn` text;--> statement-breakpoint
ALTER TABLE `products` ADD `careZh` text;--> statement-breakpoint
ALTER TABLE `products` ADD `careEn` text;--> statement-breakpoint
ALTER TABLE `products` ADD `sellingPrice` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `compareAtPrice` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `estimatedCost` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `currentCost` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `dimensions` json;--> statement-breakpoint
ALTER TABLE `products` ADD `isFeatured` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `featuredSortOrder` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `seoTitle` varchar(200);--> statement-breakpoint
ALTER TABLE `products` ADD `seoDesc` text;--> statement-breakpoint
ALTER TABLE `products` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_keyword_unique` UNIQUE(`keyword`);--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_sku_unique` UNIQUE(`sku`);