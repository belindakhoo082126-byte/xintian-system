-- 将空白正式版的默认销售单位收敛为用户确认的六项。
-- 旧默认单位仅停用，避免将来已关联资料的历史引用失效。
INSERT INTO `units` (`nameZh`, `nameEn`, `isDefault`, `sortOrder`, `isActive`)
SELECT '盆', 'Pot', true, 10, true FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `units` WHERE `nameZh` = '盆');

UPDATE `units` SET `nameEn` = 'Pot', `isDefault` = true, `sortOrder` = 10, `isActive` = true WHERE `nameZh` = '盆';
UPDATE `units` SET `nameEn` = 'Each', `isDefault` = true, `sortOrder` = 20, `isActive` = true WHERE `nameZh` = '个';
UPDATE `units` SET `nameEn` = 'Pack', `isDefault` = true, `sortOrder` = 30, `isActive` = true WHERE `nameZh` = '包';
UPDATE `units` SET `nameEn` = 'Bottle', `isDefault` = true, `sortOrder` = 40, `isActive` = true WHERE `nameZh` = '瓶';
UPDATE `units` SET `nameEn` = 'Bag', `isDefault` = true, `sortOrder` = 50, `isActive` = true WHERE `nameZh` = '袋';
UPDATE `units` SET `nameEn` = 'Group', `isDefault` = true, `sortOrder` = 60, `isActive` = true WHERE `nameZh` = '组';
UPDATE `units` SET `isDefault` = false, `isActive` = false WHERE `nameZh` IN ('件', '盒', '套', '份', '公斤');

