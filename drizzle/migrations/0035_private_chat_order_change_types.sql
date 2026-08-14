-- Private-chat AI may submit these requests, but only a staff approval can
-- execute them. Extend the existing enum without altering historical rows.
ALTER TABLE order_change_requests
  MODIFY COLUMN requestType ENUM(
    'add_item',
    'remove_item',
    'change_quantity',
    'change_address',
    'change_phone',
    'change_variant',
    'cancel_item',
    'cancel_order',
    'other'
  ) NOT NULL;
