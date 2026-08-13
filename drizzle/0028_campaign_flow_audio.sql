ALTER TABLE `messenger_flow_templates`
  ADD COLUMN `audioUrl` varchar(500);

ALTER TABLE `flow_steps`
  MODIFY COLUMN `messageType` enum('text','image','video','audio','button','contact_support') NOT NULL;
