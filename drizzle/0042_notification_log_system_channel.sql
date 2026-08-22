ALTER TABLE `notification_logs`
  MODIFY `channel` enum('messenger','whatsapp','email','system') NOT NULL DEFAULT 'messenger';
