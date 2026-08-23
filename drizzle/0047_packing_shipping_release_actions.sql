ALTER TABLE `special_order_actions`
  MODIFY COLUMN `actionType` ENUM(
    'notify_shortage',
    'confirm_received',
    'refund',
    'company_bear',
    'remark',
    'convert_to_credit',
    'allow_shipping_before_balance',
    'hold_shipping_before_balance'
  ) NOT NULL;
