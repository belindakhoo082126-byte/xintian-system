-- AI大脑 Phase 1 Review Round 1
-- Adds real hit metrics for existing rules/knowledge, AI reply source metadata,
-- and maintainable reply principles. No table is replaced or recreated.

ALTER TABLE `reply_rules`
  ADD COLUMN `usageCount` INT NOT NULL DEFAULT 0,
  ADD COLUMN `lastMatchedAt` TIMESTAMP NULL;

ALTER TABLE `ai_knowledge`
  ADD COLUMN `usageCount` INT NOT NULL DEFAULT 0,
  ADD COLUMN `lastMatchedAt` TIMESTAMP NULL;

ALTER TABLE `chat_messages`
  ADD COLUMN `aiResponseSource` VARCHAR(32) NULL;

ALTER TABLE `ai_persona`
  ADD COLUMN `replyPrinciples` TEXT NULL;

-- Convert the existing English management categories to the new Chinese categories.
UPDATE `ai_knowledge`
SET `category` = CASE `category`
  WHEN 'shipping' THEN '运费'
  WHEN 'membership' THEN '会员'
  WHEN 'product' THEN '商品'
  WHEN 'faq' THEN '常见问题'
  WHEN 'payment' THEN '付款'
  WHEN 'order' THEN '发货'
  ELSE `category`
END
WHERE `category` IN ('shipping', 'membership', 'product', 'faq', 'payment', 'order');
