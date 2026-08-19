-- 为独立空白正式版补齐商品管理的基础销售单位主数据。
-- 每条语句只在同名单位尚不存在时插入，避免重跑时产生重复选项。
INSERT INTO `units` (`nameZh`, `nameEn`, `isDefault`, `sortOrder`, `isActive`)
SELECT '个', 'Each', true, 10, true FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `units` WHERE `nameZh` = '个');
INSERT INTO `units` (`nameZh`, `nameEn`, `isDefault`, `sortOrder`, `isActive`)
SELECT '件', 'Piece', true, 20, true FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `units` WHERE `nameZh` = '件');
INSERT INTO `units` (`nameZh`, `nameEn`, `isDefault`, `sortOrder`, `isActive`)
SELECT '包', 'Pack', true, 30, true FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `units` WHERE `nameZh` = '包');
INSERT INTO `units` (`nameZh`, `nameEn`, `isDefault`, `sortOrder`, `isActive`)
SELECT '盒', 'Box', true, 40, true FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `units` WHERE `nameZh` = '盒');
INSERT INTO `units` (`nameZh`, `nameEn`, `isDefault`, `sortOrder`, `isActive`)
SELECT '瓶', 'Bottle', true, 50, true FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `units` WHERE `nameZh` = '瓶');
INSERT INTO `units` (`nameZh`, `nameEn`, `isDefault`, `sortOrder`, `isActive`)
SELECT '袋', 'Bag', true, 60, true FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `units` WHERE `nameZh` = '袋');
INSERT INTO `units` (`nameZh`, `nameEn`, `isDefault`, `sortOrder`, `isActive`)
SELECT '套', 'Set', true, 70, true FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `units` WHERE `nameZh` = '套');
INSERT INTO `units` (`nameZh`, `nameEn`, `isDefault`, `sortOrder`, `isActive`)
SELECT '组', 'Group', true, 80, true FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `units` WHERE `nameZh` = '组');
INSERT INTO `units` (`nameZh`, `nameEn`, `isDefault`, `sortOrder`, `isActive`)
SELECT '份', 'Portion', true, 90, true FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `units` WHERE `nameZh` = '份');
INSERT INTO `units` (`nameZh`, `nameEn`, `isDefault`, `sortOrder`, `isActive`)
SELECT '公斤', 'Kilogram', true, 100, true FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `units` WHERE `nameZh` = '公斤');

