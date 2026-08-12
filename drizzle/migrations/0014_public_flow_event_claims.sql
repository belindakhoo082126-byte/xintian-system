-- Database-level deduplication for public Facebook / Instagram comment events.
-- This migration is additive only and does not modify existing order, chat or Flow data.
CREATE TABLE IF NOT EXISTS `ai_public_event_claims` (
  `id` int AUTO_INCREMENT NOT NULL,
  `platform` enum('facebook','instagram') NOT NULL,
  `eventType` enum('comment','mention','live_comment') NOT NULL,
  `sourceEventId` varchar(255) NOT NULL,
  `liveRoomId` int,
  `outcome` enum('processing','flow','live_order','no_reply','failed') NOT NULL DEFAULT 'processing',
  `handledBy` enum('flow','live_order','system') NOT NULL DEFAULT 'system',
  `responseSummary` text,
  `errorMessage` text,
  `completedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `ai_public_event_claims_id` PRIMARY KEY (`id`),
  CONSTRAINT `uq_ai_public_event_claim` UNIQUE (`platform`,`eventType`,`sourceEventId`)
);
