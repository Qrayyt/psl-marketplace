BEGIN;

ALTER TABLE "products" ADD COLUMN "brand" TEXT,
ADD COLUMN "catalog_slug" TEXT,
ADD COLUMN "source_url" TEXT,
ADD COLUMN "logo_only" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "products_catalog_slug_key" ON "products"("catalog_slug");

CREATE TABLE "product_documents" (
  "id" TEXT PRIMARY KEY,
  "product_id" TEXT NOT NULL REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "title" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "content" BYTEA NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "product_documents_product_id_created_at_idx" ON "product_documents"("product_id", "created_at");

-- Attach the existing storefront identifiers without replacing commercial data or foreign keys.
CREATE TEMP TABLE psl_initial_catalog (
  slug TEXT, name TEXT, brand TEXT, category TEXT, description TEXT, image TEXT,
  source_url TEXT, tags TEXT[], sizes TEXT[], details TEXT[], logo_only BOOLEAN
) ON COMMIT DROP;
INSERT INTO psl_initial_catalog VALUES
  ('wiron', 'WIRON', 'WIRON', 'Защитные покрытия', 'Двухкомпонентный защитный упрочняющий полимерный состав глубокого проникновения.', 'assets/images/wiron.webp', 'https://wiron.pro/', ARRAY['защита', 'бетон']::text[], ARRAY['Комплект А + Б']::text[], ARRAY['Двухкомпонентный состав', 'Защита и упрочнение основания', 'Для различных материалов и поверхностей']::text[], FALSE),
  ('fixtile-se', 'FIXTILE SE', 'FIXTILE', 'Клеи и затирки', 'Двухкомпонентный эпоксидный клей-затирка.', 'assets/images/fixtile-se.webp', 'https://fixtile.ru/catalog', ARRAY['эпоксидный', 'затирка']::text[], ARRAY['Уточнить фасовку']::text[], ARRAY['Эпоксидный состав', 'Два компонента', 'Клей и затирка']::text[], FALSE),
  ('silflex-s500', 'SILFLEX S500', 'SILFLEX', 'Гидроизоляция', 'Двухкомпонентная гидроизоляция — гибрид полимочевины и полиуретана.', 'assets/images/silflex-logo.png', 'https://silflex.ru/', ARRAY['гидроизоляция', 'полимер']::text[], ARRAY['Уточнить фасовку']::text[], ARRAY['Два компонента', 'Полимочевина и полиуретан', 'Гидроизоляционный состав']::text[], TRUE),
  ('matrix-hex', 'MATRIX HEX', 'FIXTILE', 'Промышленная плитка', 'Шестигранная промышленная керамическая плитка FIXTILE MATRIX. Формат 125 × 108 мм.', 'assets/images/matrix-hex.webp', 'https://matrix.fixtile.ru/', ARRAY['керамика', 'пол']::text[], ARRAY['125 × 108 мм']::text[], ARRAY['Промышленная керамика', 'Шестигранный формат', 'Для промышленных плиточных систем']::text[], FALSE),
  ('dolotex-gls500', 'DOLOTEX GLS500', 'DOLOTEX', 'Эпоксидные смолы', 'Многофункциональная двухкомпонентная эпоксидная смола.', 'assets/images/dolotex-logo.png', 'https://dolotex.ru/assets/files/DOLOTEX%20%20GLS%20500.pdf', ARRAY['смола', 'эпоксидный']::text[], ARRAY['Уточнить фасовку']::text[], ARRAY['Эпоксидная основа', 'Двухкомпонентный состав']::text[], TRUE),
  ('dolotex-gls100', 'DOLOTEX GLS100', 'DOLOTEX', 'Грунтовки', 'Двухкомпонентная эпоксидная грунтовка.', 'assets/images/dolotex-logo.png', 'https://dolotex.ru/assets/files/D%D0%9ELOTEXGLS100%20%D0%93%D1%80%D1%83%D0%BD%D1%82%D0%BE%D0%B2%D0%BA%D0%B0%20%D1%8D%D0%BF%D0%BE%D0%BA%D1%81%D0%B8%D0%B4%D0%BD%D0%B0%D1%8F.pdf', ARRAY['грунт', 'эпоксидный']::text[], ARRAY['Уточнить фасовку']::text[], ARRAY['Эпоксидная основа', 'Грунтовка']::text[], TRUE),
  ('fixtile-els700', 'FIXTILE ELS700', 'FIXTILE', 'Клеи и затирки', 'Двухкомпонентный эпоксидный клей-шпатлёвка.', 'assets/images/fixtile-els700.webp', 'https://fixtile.ru/catalog', ARRAY['эпоксидный', 'монтаж']::text[], ARRAY['Уточнить фасовку']::text[], ARRAY['Эпоксидный состав', 'Два компонента', 'Клей-шпатлёвка']::text[], FALSE),
  ('fixtile-elc10', 'FIXTILE ELC10', 'FIXTILE', 'Клеи и затирки', 'Эпоксидный токопроводящий клей-затирка.', 'assets/images/fixtile-elc10.webp', 'https://fixtile.ru/catalog', ARRAY['токопроводящий', 'эпоксидный']::text[], ARRAY['Уточнить фасовку']::text[], ARRAY['Эпоксидный состав', 'Токопроводящий клей-затирка']::text[], FALSE),
  ('matrix-square', 'MATRIX Квадрат', 'FIXTILE', 'Промышленная плитка', 'Квадратная промышленная плитка FIXTILE MATRIX. Формат 200 × 200 × 15 мм.', 'assets/images/tile-square.svg', 'https://matrix.fixtile.ru/', ARRAY['керамика', 'пол']::text[], ARRAY['200 × 200 × 15 мм']::text[], ARRAY['Промышленная керамика', 'Квадратный формат', 'Толщина 15 мм']::text[], FALSE),
  ('matrix-rectangle', 'MATRIX Прямоугольник', 'FIXTILE', 'Промышленная плитка', 'Прямоугольная промышленная плитка FIXTILE MATRIX. Формат 200 × 100 × 15 мм.', 'assets/images/tile-rectangle.svg', 'https://matrix.fixtile.ru/', ARRAY['керамика', 'пол']::text[], ARRAY['200 × 100 × 15 мм']::text[], ARRAY['Промышленная керамика', 'Прямоугольный формат', 'Толщина 15 мм']::text[], FALSE),
  ('silflex-s300', 'SILFLEX S300', 'SILFLEX', 'Гидроизоляция', 'Однокомпонентная гидроизоляция на полиуретановой основе.', 'assets/images/silflex-logo.png', 'https://silflex.ru/', ARRAY['гидроизоляция', 'полиуретан']::text[], ARRAY['Уточнить фасовку']::text[], ARRAY['Один компонент', 'Полиуретановый состав', 'Гидроизоляция']::text[], TRUE),
  ('silflex-universal', 'SILFLEX UNIVERSAL', 'SILFLEX', 'Гидроизоляция', 'Двухкомпонентная эластичная гидроизоляция на цементной основе.', 'assets/images/silflex-logo.png', 'https://silflex.ru/', ARRAY['гидроизоляция', 'цемент']::text[], ARRAY['Уточнить фасовку']::text[], ARRAY['Два компонента', 'Цементная основа', 'Эластичная гидроизоляция']::text[], TRUE),
  ('silflex-extraelastic', 'SILFLEX EXTRAELASTIC', 'SILFLEX', 'Гидроизоляция', 'Двухкомпонентная высокоэластичная гидроизоляция на цементной основе.', 'assets/images/silflex-logo.png', 'https://silflex.ru/', ARRAY['гидроизоляция', 'цемент']::text[], ARRAY['Уточнить фасовку']::text[], ARRAY['Два компонента', 'Цементная основа', 'Высокоэластичная гидроизоляция']::text[], TRUE);

WITH matches AS (
  SELECT DISTINCT ON (s.slug) s.slug, p.id
  FROM psl_initial_catalog s
  JOIN products p ON p.id = s.slug OR (
    lower(trim(p.name)) = lower(trim(s.name)) AND p.category = s.category
  )
  ORDER BY s.slug, (p.id = s.slug) DESC, p.is_active DESC, p.created_at, p.id
)
UPDATE products p SET catalog_slug = s.slug, brand = s.brand,
  source_url = COALESCE(p.source_url, s.source_url)
FROM matches m JOIN psl_initial_catalog s ON s.slug = m.slug
WHERE p.id = m.id;

INSERT INTO products (
  id, catalog_slug, name, brand, category, description, image_url, source_url,
  tags, sizes, details, logo_only, price, created_at, updated_at
)
SELECT slug, slug, name, brand, category, description, image, source_url,
  tags, sizes, details, logo_only, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM psl_initial_catalog s
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.catalog_slug = s.slug);

COMMIT;
