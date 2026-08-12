-- Marketing automation Heartbeat ownership and idempotent callback lookup.
-- The callback task UID is persisted on the business rule and never read from
-- the request body, so retries cannot invoke another rule.
ALTER TABLE `marketing_automation_rules`
  ADD COLUMN `scheduleCronTaskUid` varchar(65) NULL;

CREATE UNIQUE INDEX `uq_marketing_automation_schedule_task`
  ON `marketing_automation_rules` (`scheduleCronTaskUid`);
