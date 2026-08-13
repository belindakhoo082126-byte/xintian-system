-- Persist the platform-managed project-level Heartbeat identity so only the
-- registered local-order payment expiry task can execute the scheduled check.
ALTER TABLE `system_settings` ADD COLUMN `localOrderExpiryTaskUid` VARCHAR(65) NULL;
