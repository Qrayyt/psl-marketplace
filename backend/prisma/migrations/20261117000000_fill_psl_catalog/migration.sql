-- Retail prices and pack sizes from the PSL handbook catalog, checked 2026-11-17.
-- Descriptions are transcribed in summary form from the product pages or PSL technical sheets.
-- The handbook index and product pages show different prices for SILFLEX Extraelastic
-- (12500 vs 11000 RUB) and DOLOTEX RDS Base L70 (1580 vs 1375 RUB).
-- The remaining products have no verified retail price in the catalog.
-- Images marked /assets/images/catalog/ are package illustrations from the PSL handbook and technical sheets.
-- Existing prices, authored descriptions and product galleries take precedence.

WITH source (slug, retail_price, package_size, photo, category, description) AS (VALUES
  ('wiron', 13810, '10 л', NULL, 'Защитные покрытия', 'Защитное полимерное покрытие глубокого проникновения для упрочнения, обеспыливания и защиты оснований.'), -- handbook page 36945943
  ('wiron-crystal', 18460, '10 л', '/assets/images/catalog/wiron-crystal.webp', 'Защитные покрытия', 'Декоративное глянцевое полимерное покрытие глубокого проникновения для упрочнения и защиты оснований.'), -- handbook page 37050543
  ('wiron-lak', 18460, '10 л', '/assets/images/catalog/wiron-lak.webp', 'Защитные покрытия', 'Бесцветное прозрачное полуматовое покрытие глубокого проникновения для защитных и декоративных работ.'), -- handbook page 37056584
  ('wiron-isolit', 16730, '13 кг', '/assets/images/catalog/wiron-isolit.webp', 'Гидроизоляция', 'Двухкомпонентное химически стойкое гидроизоляционное покрытие на основе гибрида полиуретана и полимочевины.'), -- handbook page 61729507
  ('wiron-ep-grund', 16155, '9 кг', NULL, 'Эпоксидные смолы', 'Двухкомпонентная эпоксидная смола для устройства высокопрочных покрытий полов.'), -- handbook page 52223139
  ('wiron-finish', 19850, '10 кг', '/assets/images/catalog/wiron-finish.webp', 'Защитные покрытия', 'Двухкомпонентное матовое полиуретановое покрытие для финишного слоя по WIRON. Колеруется по RAL.'), -- handbook page 37057295
  ('wiron-ep', 14390, '10 кг', '/assets/images/catalog/wiron-ep.webp', 'Защитные покрытия', 'Двухкомпонентное эпоксидное финишное покрытие с химической стойкостью. Предусмотрено нанесение по FIXTILE GLS100; доступна колеровка по RAL.'), -- handbook page 37057972
  ('wiron-inject', 16900, '9 кг', NULL, 'Гидроизоляция', 'Эластичная инъекционная полиуретановая смола низкой вязкости.'), -- handbook page 52223267
  ('wiron-egl', 8420, '4 кг', NULL, 'Гидроизоляция', 'Двухкомпонентный полиуретановый литьевой герметик.'), -- handbook page 56985973
  ('dolotex-gs9', 1980, '25 кг', '/assets/images/catalog/dolotex-gs9.webp', 'Клеи и затирки', 'Высокоэластичный цементный клей для керамики, керамогранита, клинкера и ряда видов камня. Подходит для сложных и деформирующихся оснований; применение по мрамору исключено.'), -- handbook page 37225372
  ('dolotex-gs15-light', 2340, '15 кг', '/assets/images/catalog/dolotex-gs15-light.webp', 'Клеи и затирки', 'Облегчённый высокоэластичный цементный клей для керамической плитки, мозаики, тонкого керамогранита и камня, устойчивого к влаге.'), -- handbook page 37225937
  ('fixtile-se', 4226, '3 кг', NULL, 'Клеи и затирки', 'Двухкомпонентный эпоксидный клей-затирка для укладки плитки и мозаики и заполнения швов на стенах и полах.'), -- handbook page 37029016
  ('fixtile-p-se', 7200, '3 кг', '/assets/images/catalog/fixtile-p-se.webp', 'Клеи и затирки', 'Двухкомпонентная эпоксидная паста для приготовления клея или затирки с добавлением кварцевого наполнителя.'), -- handbook page 37164830
  ('fixtile-els600', 3450, '3 кг', '/assets/images/catalog/fixtile-els600.webp', 'Клеи и затирки', 'Эпоксидный ремонтно-монтажный клей-паста для крепления, анкеровки, восстановления бетона и фиксации уплотнительных лент.'), -- handbook page 37031199
  ('fixtile-els700', 3450, '3 кг', NULL, 'Клеи и затирки', 'Эпоксидный клей-шпатлёвка для монтажа, анкеровки, ремонта и выравнивания декоративных и фасадных элементов.'), -- handbook page 37058364
  ('fixtile-elc10', 7200, '3 кг', NULL, 'Клеи и затирки', 'Двухкомпонентный токопроводящий эпоксидный клей-затирка для облицовки объектов с требованиями к отводу статического электричества.'), -- handbook page 37164093
  ('fixtile-s7', 4680, '3 кг', NULL, 'Клеи и затирки', 'Двухкомпонентный полиуретановый монтажный клей для строительных конструкций, фасадных элементов, швов и примыканий.'), -- handbook page 37196014
  ('fixtile-gls100', 9900, '9 кг', '/assets/images/catalog/fixtile-gls100.webp', 'Грунтовки', 'Двухкомпонентная эпоксидная грунтовка для впитывающих и невпитывающих оснований внутри и снаружи помещений.'), -- handbook page 37109556
  ('fixtile-elc100', 14900, '9 кг', '/assets/images/catalog/fixtile-elc100.webp', 'Грунтовки', 'Двухкомпонентная токопроводящая эпоксидная грунтовка.'), -- handbook page 52223873
  ('fixtile-gls400', 15550, '9 кг', '/assets/images/catalog/fixtile-gls400.webp', 'Эпоксидные смолы', 'Многофункциональная строительная эпоксидная смола низкой вязкости с повышенной химической стойкостью.'), -- handbook page 37113337
  ('fixtile-gls500', 16150, '9 кг', '/assets/images/catalog/fixtile-gls500.webp', 'Эпоксидные смолы', 'Прозрачная эпоксидная смола низкой вязкости для декоративных и отделочных работ.'), -- handbook page 37112491
  ('silflex-universal', 7500, '30 кг', NULL, 'Гидроизоляция', 'Двухкомпонентная цементная гидроизоляция для конструкций в условиях постоянного контакта с водой.'), -- handbook page 37196726
  ('silflex-extraelastic', NULL, '20 кг', NULL, 'Гидроизоляция', 'Высокоэластичная быстросхватывающаяся двухкомпонентная цементная гидроизоляция для стен, фундаментов и плиточных поверхностей.'), -- handbook page 37197159
  ('dolotex-d', 2394, '25 кг', '/assets/images/catalog/dolotex-d.webp', 'Гидроизоляция', 'Однокомпонентный цементный состав с гидрофобизирующими добавками для гидроизоляции бетонных оснований.'), -- handbook page 37226308
  ('dolotex-rds-hidro', 3096, '25 кг', '/assets/images/catalog/dolotex-rds-hidro.webp', 'Гидроизоляция', 'Цементный ремонтный состав для гидроизоляции статичных трещин, швов, стыков и вводов коммуникаций.'), -- handbook page 37216320
  ('dolotex-aqua-stopper', 660, '5 кг', '/assets/images/catalog/dolotex-aqua-stopper.webp', 'Гидроизоляция', 'Гидропломба для остановки течей в бетоне и каменной кладке, в том числе при поступлении воды под давлением.'), -- handbook page 37242519
  ('dolotex-rds-base-t50', 1740, '25 кг', '/assets/images/catalog/dolotex-rds-base-t50.webp', 'Ремонт бетона', 'Тиксотропная цементная ремонтная смесь для восстановления бетонных конструкций.'), -- handbook page 37201488
  ('dolotex-rds-base-l50', 1728, '25 кг', '/assets/images/catalog/dolotex-rds-base-l50.webp', 'Ремонт бетона', 'Литьевой цементный состав для ремонта бетона методом заливки слоем от 10 до 50 мм.'), -- handbook page 37200154
  ('dolotex-rds-base-c500', 2040, '25 кг', '/assets/images/catalog/dolotex-rds-base-c500.webp', 'Ремонт бетона', 'Тиксотропный цементный ремонтный состав с целлюлозными микроволокнами и адгезией к стали и бетону.'), -- handbook page 37215286
  ('dolotex-rds-base-p500', 2040, '25 кг', '/assets/images/catalog/dolotex-rds-base-p500.webp', 'Ремонт бетона', 'Тиксотропная цементная смесь с полипропиленовыми волокнами для восстановления бетонных конструкций.'), -- handbook page 37215448
  ('dolotex-rds-finish-t', 1272, '25 кг', '/assets/images/catalog/dolotex-rds-finish-t.webp', 'Ремонт бетона', 'Тиксотропная цементная шпаклёвка для чистовой отделки и восстановления горизонтальных и вертикальных бетонных поверхностей.'), -- handbook page 37215959
  ('dolotex-rds-finish-l', 1728, '25 кг', '/assets/images/catalog/dolotex-rds-finish-l.webp', 'Ремонт бетона', 'Литьевая цементная шпаклёвка для чистовой отделки и восстановления бетона слоем от 1 до 10 мм.'), -- handbook page 37215683
  ('dolotex-rds-finish-c', 2208, '25 кг', '/assets/images/catalog/dolotex-rds-finish-c.webp', 'Ремонт бетона', 'Тиксотропная цементная шпаклёвка с целлюлозными микроволокнами для отделки бетона слоем от 1 до 10 мм.'), -- handbook page 37216050
  ('dolotex-rds-base-l70', NULL, '25 кг', '/assets/images/catalog/dolotex-rds-base-l70.webp', 'Ремонт бетона', 'Литьевой цементный ремонтный состав для восстановления бетона методом заливки слоем от 10 до 50 мм.'), -- handbook page 37201325
  ('hiltex-ep', 14250, '15 кг', '/assets/images/catalog/hiltex-ep.webp', 'Грунтовки', 'Двухкомпонентная эпоксидная грунтовка для впитывающих и невпитывающих оснований внутри и снаружи помещений.'), -- handbook page 37198299
  ('dolotex-gs10', NULL, NULL, '/assets/images/catalog/dolotex-gs10.webp', 'Клеи и затирки', 'Клей для укладки мрамора, светлого известняка, других светлых пород камня и стеклянной мозаики.'),
  ('dolotex-rds-base-t70', NULL, NULL, '/assets/images/catalog/dolotex-rds-base-t70.webp', 'Ремонт бетона', 'Тиксотропный цементный ремонтный состав для восстановления бетонных конструкций.'),
  ('fixtile-els100', NULL, NULL, NULL, 'Защитные покрытия', 'Двухкомпонентный токопроводящий эпоксидный состав для антистатических наливных полов.'),
  ('fixtile-gls200', NULL, NULL, NULL, 'Эпоксидные смолы', 'Паропроницаемая эпоксидная смола низкой вязкости на водной основе.'),
  ('fixtile-gls300', NULL, NULL, '/assets/images/catalog/fixtile-gls300.webp', 'Эпоксидные смолы', 'Многофункциональная тиксотропная эпоксидная смола.'),
  ('fixtile-s5', NULL, NULL, NULL, 'Клеи и затирки', 'Двухкомпонентный полиуретановый клей для восстановления геометрии бетонных конструкций.'),
  ('fixtile-w7', NULL, NULL, NULL, 'Клеи и затирки', 'Двухкомпонентный полиуретановый клей для укладки паркета с повышенной прочностью клеевого шва.'),
  ('hiltex-mg', NULL, '5 кг', '/assets/images/catalog/hiltex-mg.webp', 'Клеи и затирки', 'Двухкомпонентный эпоксидный монтажный клей для склеивания и анкеровки строительных материалов и ремонта бетонных конструкций.'),
  ('hiltex-sc', NULL, '5 кг', '/assets/images/catalog/hiltex-sc.webp', 'Клеи и затирки', 'Цветной двухкомпонентный эпоксидный клей-затирка для крепления плитки и мозаики и заполнения швов.'),
  ('hiltex-sg', NULL, '5 кг', '/assets/images/catalog/hiltex-sg.webp', 'Клеи и затирки', 'Серый двухкомпонентный эпоксидный клей-затирка для крепления плитки и мозаики и заполнения швов.'),
  ('hiltex-spu', NULL, '13 кг', '/assets/images/catalog/hiltex-spu.webp', 'Гидроизоляция', 'Двухкомпонентная полиуретановая гидроизоляция для эластичной защиты бетонных и стальных конструкций от воды.'),
  ('wiron-anticor', NULL, NULL, NULL, 'Защитные покрытия', 'Двухкомпонентный полимерный состав для антикоррозионной защиты.'),
  ('wiron-armor', NULL, NULL, NULL, 'Защитные покрытия', 'Двухкомпонентное гибридное покрытие на основе полимочевины для ручного нанесения.'),
  ('wiron-np', NULL, NULL, NULL, 'Защитные покрытия', 'Самовыравнивающийся эпоксидный состав с минеральным наполнителем для наливных полов.'),
  ('matrix-skirting', NULL, NULL, NULL, 'Промышленная плитка', 'Плинтус плиточной системы FIXTILE MATRIX для примыкания пола к стене.'),
  ('matrix-external-corner', NULL, NULL, NULL, 'Промышленная плитка', 'Внешний угловой элемент плиточной системы FIXTILE MATRIX.'),
  ('matrix-internal-corner', NULL, NULL, NULL, 'Промышленная плитка', 'Внутренний угловой элемент плиточной системы FIXTILE MATRIX.'),
  ('quartz-sand', NULL, NULL, NULL, NULL, 'Кварцевый песок для использования в качестве минерального наполнителя при приготовлении клеевых и затирочных составов.'),
  ('fixtile-x-bond', NULL, NULL, NULL, NULL, 'Щелочестойкая стеклотканевая сетка с полимерной пропиткой для армирования клеевых и гидроизоляционных слоёв промышленных полов FIXTILE.')
),
updates AS (
  SELECT p.id, s.*,
    p.price <= 0 AND s.retail_price IS NOT NULL
      AND (cardinality(p.sizes) = 0
        OR p.sizes IN (ARRAY['Уточнить фасовку'], ARRAY[s.package_size])) AS set_price,
    s.package_size IS NOT NULL
      AND (cardinality(p.sizes) = 0
        OR (p.price <= 0 AND p.sizes = ARRAY['Уточнить фасовку'])) AS set_size,
    s.photo IS NOT NULL
      AND (p.logo_only OR (NULLIF(btrim(p.image_url), '') IS NULL AND cardinality(p.image_urls) = 0)) AS set_photo,
    s.description IS NOT NULL AND NULLIF(btrim(p.description), '') IS NULL AS set_description,
    s.category IS NOT NULL AND btrim(p.category) IN ('', 'Без категории') AS set_category
  FROM products p
  JOIN source s ON s.slug = p.catalog_slug
  WHERE p.is_active
)
UPDATE products AS p
SET price = CASE WHEN u.set_price THEN u.retail_price ELSE p.price END,
    sizes = CASE WHEN u.set_size THEN ARRAY[u.package_size] ELSE p.sizes END,
    image_url = CASE WHEN u.set_photo THEN u.photo ELSE p.image_url END,
    image_urls = CASE WHEN u.set_photo
      THEN ARRAY[u.photo] || array_remove(array_remove(p.image_urls, p.image_url), u.photo)
      ELSE p.image_urls END,
    logo_only = CASE WHEN u.set_photo THEN false ELSE p.logo_only END,
    description = CASE WHEN u.set_description THEN u.description ELSE p.description END,
    category = CASE WHEN u.set_category THEN u.category ELSE p.category END,
    updated_at = CURRENT_TIMESTAMP
FROM updates u
WHERE p.id = u.id
  AND (u.set_price OR u.set_size OR u.set_photo OR u.set_description OR u.set_category);
