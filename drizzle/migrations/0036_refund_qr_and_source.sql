-- Unified refund enhancements: keep customer payment QR distinct from issue
-- attachments, and persist the structured origin/reason from packing workbench.
ALTER TABLE order_refunds
  ADD COLUMN customerRefundQrUrl VARCHAR(500) NULL,
  ADD COLUMN refundReasonCode VARCHAR(50) NULL,
  ADD COLUMN refundSource VARCHAR(20) NOT NULL DEFAULT 'manual';
