-- A marketing automation rule may deliver to each customer once. This guards
-- against retried Heartbeat callbacks and concurrent administrator actions.
CREATE UNIQUE INDEX `uq_marketing_rule_customer_delivery`
  ON `marketing_message_deliveries` (`automationRuleId`, `customerId`);
