BEGIN;

CREATE TABLE "brands" (
  "key" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT
);

INSERT INTO brands (key, name) VALUES
  ('dolotex', 'DOLOTEX'),
  ('fixtile', 'FIXTILE'),
  ('hiltex', 'HILTEX'),
  ('silflex', 'SILFLEX'),
  ('wiron', 'WIRON');

INSERT INTO brands (key, name)
SELECT DISTINCT ON (lower(trim(brand))) lower(trim(brand)), trim(brand)
FROM products
WHERE brand IS NOT NULL AND trim(brand) <> ''
ORDER BY lower(trim(brand)), trim(brand)
ON CONFLICT (key) DO NOTHING;

-- Product folders from the PSL inventory on Yandex Disk, without attachments.
WITH inventory (slug, name, brand, category) AS (VALUES
  ('dolotex-aqua-stopper', 'DOLOTEX AQUA STOPPER', 'DOLOTEX', 'Без категории'),
  ('dolotex-d', 'DOLOTEX D', 'DOLOTEX', 'Без категории'),
  ('dolotex-gs10', 'DOLOTEX GS10', 'DOLOTEX', 'Без категории'),
  ('dolotex-gs15-light', 'DOLOTEX GS15 LIGHT', 'DOLOTEX', 'Без категории'),
  ('dolotex-gs9', 'DOLOTEX GS9', 'DOLOTEX', 'Без категории'),
  ('dolotex-rds-base-c500', 'DOLOTEX RDS BASE C500', 'DOLOTEX', 'Без категории'),
  ('dolotex-rds-base-l50', 'DOLOTEX RDS BASE L50', 'DOLOTEX', 'Без категории'),
  ('dolotex-rds-base-l70', 'DOLOTEX RDS BASE L70', 'DOLOTEX', 'Без категории'),
  ('dolotex-rds-base-p500', 'DOLOTEX RDS BASE P500', 'DOLOTEX', 'Без категории'),
  ('dolotex-rds-base-t50', 'DOLOTEX RDS BASE T50', 'DOLOTEX', 'Без категории'),
  ('dolotex-rds-base-t70', 'DOLOTEX RDS BASE T70', 'DOLOTEX', 'Без категории'),
  ('dolotex-rds-finish-c', 'DOLOTEX RDS FINISH C', 'DOLOTEX', 'Без категории'),
  ('dolotex-rds-finish-t', 'DOLOTEX RDS FINISH T', 'DOLOTEX', 'Без категории'),
  ('dolotex-rds-hidro', 'DOLOTEX RDS HIDRO', 'DOLOTEX', 'Без категории'),
  ('fixtile-x-bond', 'FIXTILE X BOND', 'FIXTILE', 'Без категории'),
  ('fixtile-cerastatic', 'FIXTILE CERASTATIC', 'FIXTILE', 'Без категории'),
  ('fixtile-epo-clean', 'FIXTILE EPO CLEAN', 'FIXTILE', 'Без категории'),
  ('fixtile-faraday', 'FIXTILE FARADAY', 'FIXTILE', 'Без категории'),
  ('fixtile-elc10', 'FIXTILE ELC10', 'FIXTILE', 'Без категории'),
  ('fixtile-els600', 'FIXTILE ELS600', 'FIXTILE', 'Без категории'),
  ('fixtile-els700', 'FIXTILE ELS700', 'FIXTILE', 'Без категории'),
  ('fixtile-gls100', 'FIXTILE GLS100', 'FIXTILE', 'Без категории'),
  ('fixtile-gls200', 'FIXTILE GLS200', 'FIXTILE', 'Без категории'),
  ('fixtile-gls300', 'FIXTILE GLS300', 'FIXTILE', 'Без категории'),
  ('fixtile-gls400', 'FIXTILE GLS400', 'FIXTILE', 'Без категории'),
  ('fixtile-gls500', 'FIXTILE GLS500', 'FIXTILE', 'Без категории'),
  ('fixtile-p-se', 'FIXTILE P-SE', 'FIXTILE', 'Без категории'),
  ('fixtile-s5', 'FIXTILE S5', 'FIXTILE', 'Без категории'),
  ('fixtile-s7', 'FIXTILE S7', 'FIXTILE', 'Без категории'),
  ('fixtile-se', 'FIXTILE SE', 'FIXTILE', 'Без категории'),
  ('fixtile-w7', 'FIXTILE W7', 'FIXTILE', 'Без категории'),
  ('matrix-hex', 'MATRIX HEX', 'FIXTILE', 'Промышленная плитка'),
  ('matrix-square', 'MATRIX Квадрат', 'FIXTILE', 'Промышленная плитка'),
  ('matrix-rectangle', 'MATRIX Прямоугольник', 'FIXTILE', 'Промышленная плитка'),
  ('matrix-skirting', 'MATRIX Плинтус', 'FIXTILE', 'Промышленная плитка'),
  ('matrix-external-corner', 'MATRIX Уголок внешний', 'FIXTILE', 'Промышленная плитка'),
  ('matrix-internal-corner', 'MATRIX Уголок внутренний', 'FIXTILE', 'Промышленная плитка'),
  ('hiltex-ep', 'HILTEX EP', 'HILTEX', 'Без категории'),
  ('hiltex-mg', 'HILTEX MG', 'HILTEX', 'Без категории'),
  ('hiltex-sc', 'HILTEX SC', 'HILTEX', 'Без категории'),
  ('hiltex-sg', 'HILTEX SG', 'HILTEX', 'Без категории'),
  ('hiltex-spu', 'HILTEX SPU', 'HILTEX', 'Без категории'),
  ('silflex-extraelastic', 'SILFLEX EXTRAELASTIC', 'SILFLEX', 'Гидроизоляция'),
  ('silflex-s300', 'SILFLEX S300', 'SILFLEX', 'Гидроизоляция'),
  ('silflex-s500', 'SILFLEX S500', 'SILFLEX', 'Гидроизоляция'),
  ('silflex-universal', 'SILFLEX UNIVERSAL', 'SILFLEX', 'Гидроизоляция'),
  ('wiron', 'WIRON', 'WIRON', 'Защитные покрытия'),
  ('wiron-anticor', 'WIRON ANTICOR', 'WIRON', 'Без категории'),
  ('wiron-armor', 'WIRON ARMOR', 'WIRON', 'Без категории'),
  ('wiron-crystal', 'WIRON CRYSTAL', 'WIRON', 'Без категории'),
  ('wiron-egl', 'WIRON EGL', 'WIRON', 'Без категории'),
  ('wiron-ep', 'WIRON EP', 'WIRON', 'Без категории'),
  ('wiron-ep-grund', 'WIRON EP-GRUND', 'WIRON', 'Без категории'),
  ('wiron-finish', 'WIRON FINISH', 'WIRON', 'Без категории'),
  ('wiron-inject', 'WIRON INJECT', 'WIRON', 'Без категории'),
  ('wiron-isolit', 'WIRON ISOLIT', 'WIRON', 'Без категории'),
  ('wiron-np', 'WIRON NP', 'WIRON', 'Без категории'),
  ('wiron-lak', 'WIRON ЛАК', 'WIRON', 'Защитные покрытия'),
  ('quartz-sand', 'Кварцевый песок', NULL, 'Без категории')
)
INSERT INTO products (id, catalog_slug, name, brand, category, price, created_at, updated_at)
SELECT gen_random_uuid()::text, slug, name, brand, category, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM inventory i
WHERE NOT EXISTS (
  SELECT 1 FROM products p
  WHERE p.catalog_slug = i.slug OR
    regexp_replace(lower(p.name), '[[:space:]_-]+', '', 'g') =
    regexp_replace(lower(i.name), '[[:space:]_-]+', '', 'g')
)
ON CONFLICT (catalog_slug) DO NOTHING;

COMMIT;
