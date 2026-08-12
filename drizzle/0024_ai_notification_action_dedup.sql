ALTER TABLE `ai_notification_actions`
  ADD CONSTRAINT `uq_ai_notification_actions_log` UNIQUE (`notificationLogId`);
