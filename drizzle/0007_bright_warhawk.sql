CREATE TABLE `ai_chat_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int,
	`customer_name` text,
	`platform` enum('messenger','whatsapp','facebook_comment','internal'),
	`status` enum('active','transferred','closed') NOT NULL DEFAULT 'active',
	`message_count` int NOT NULL DEFAULT 0,
	`last_message_at` timestamp,
	`transferred_at` timestamp,
	`transferred_to` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_chat_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_reply_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int,
	`customer_name` text,
	`platform` enum('messenger','whatsapp','facebook_comment','internal'),
	`ai_module` enum('order','parcel','plant_diagnostic','faq','knowledge','payment','content','unknown'),
	`user_message` text,
	`ai_reply` text,
	`flow_used` text,
	`faq_used` text,
	`knowledge_used` text,
	`confidence_score` decimal(5,2),
	`transferred_to_human` boolean NOT NULL DEFAULT false,
	`human_reply` text,
	`human_replied_at` timestamp,
	`human_replied_by` text,
	`chat_session_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_reply_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_review_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reply_log_id` int,
	`customer_question` text NOT NULL,
	`human_reply` text,
	`ai_suggestion` text NOT NULL,
	`suggestion_type` enum('faq','knowledge','flow'),
	`suggested_category` text,
	`suggested_content` text,
	`status` enum('pending','approved','rejected','modified','ignored') NOT NULL DEFAULT 'pending',
	`admin_note` text,
	`reviewed_by` text,
	`reviewed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_review_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auto_reply_enabled` boolean NOT NULL DEFAULT true,
	`learning_mode` enum('suggestion','draft','disabled') NOT NULL DEFAULT 'suggestion',
	`min_confidence_threshold` decimal(5,2) NOT NULL DEFAULT '70.00',
	`messenger_ai_enabled` boolean NOT NULL DEFAULT true,
	`whatsapp_ai_enabled` boolean NOT NULL DEFAULT true,
	`facebook_comments_order_only` boolean NOT NULL DEFAULT false,
	`plant_diagnostic_force_human` boolean NOT NULL DEFAULT true,
	`payment_requires_human_confirm` boolean NOT NULL DEFAULT true,
	`parcel_anomaly_days` int NOT NULL DEFAULT 5,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updated_by` text,
	CONSTRAINT `ai_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `faq_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` varchar(100) NOT NULL,
	`keywords` text,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`image_url` text,
	`video_url` text,
	`pdf_url` text,
	`product_id` int,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `faq_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int,
	`topic` varchar(200) NOT NULL,
	`content` text NOT NULL,
	`image_url` text,
	`video_url` text,
	`pdf_url` text,
	`tags` text,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledge_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plant_diagnostic_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int,
	`customer_name` text,
	`platform` enum('messenger','whatsapp','internal'),
	`placement` varchar(50),
	`lighting_hours` text,
	`watering_frequency` text,
	`soil_dry_days` text,
	`recent_fertilized` boolean,
	`fertilizer_type` text,
	`recent_repotted` boolean,
	`recent_sprayed` boolean,
	`has_pests` boolean,
	`leaf_condition` text,
	`branch_condition` text,
	`root_condition` text,
	`photo_urls` text,
	`status` enum('collecting','pending_human','in_progress','resolved','closed') NOT NULL DEFAULT 'collecting',
	`assigned_to` text,
	`human_reply` text,
	`resolved_at` timestamp,
	`resolved_by` text,
	`chat_session_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plant_diagnostic_tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session_product_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` int NOT NULL,
	`session_product_id` int NOT NULL,
	`product_id` int NOT NULL,
	`variant_id` int NOT NULL,
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
	CONSTRAINT `session_product_variants_id` PRIMARY KEY(`id`)
);
