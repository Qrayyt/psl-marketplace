WITH inventory (slug, name, brand) AS (VALUES
  ('fixtile-els100', 'FIXTILE ELS100', 'FIXTILE'),
  ('fixtile-elc100', 'FIXTILE ELC100', 'FIXTILE'),
  ('dolotex-rds-finish-l', 'DOLOTEX RDS FINISH L', 'DOLOTEX')
)
INSERT INTO products (id, catalog_slug, name, brand, category, price, created_at, updated_at)
SELECT gen_random_uuid()::text, slug, name, brand, 'Без категории', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM inventory i
WHERE NOT EXISTS (
  SELECT 1 FROM products p
  WHERE p.catalog_slug = i.slug OR
    regexp_replace(lower(p.name), '[[:space:]_-]+', '', 'g') =
    regexp_replace(lower(i.name), '[[:space:]_-]+', '', 'g')
)
ON CONFLICT (catalog_slug) DO NOTHING;
