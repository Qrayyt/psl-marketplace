-- Source: PSL technical card «Техкарта FixTile EPO CLEAN».
UPDATE products
SET description = 'Готовое средство для удаления эпоксидного налёта и локальных остатков эпоксидных затирок и клеёв с облицованных поверхностей.',
    updated_at = CURRENT_TIMESTAMP
WHERE catalog_slug = 'fixtile-epo-clean'
  AND is_active
  AND NULLIF(btrim(description), '') IS NULL;
