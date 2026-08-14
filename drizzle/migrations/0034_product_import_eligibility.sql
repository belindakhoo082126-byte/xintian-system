-- Keep the primary sales mode separate from eligibility to be a local accessory
-- in a China-import (XTC) order. Existing flowerpots and fertilizer categories
-- retain their already permitted behaviour after this migration.
ALTER TABLE products
  ADD COLUMN allowImportOrder BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE products p
LEFT JOIN product_categories c ON c.id = p.categoryId
SET p.allowImportOrder = TRUE
WHERE p.orderCategory = 'local'
  AND (p.isPot = TRUE OR c.name IN ('肥料', '花盆', '盆器'));
