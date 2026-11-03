-- Добавление колонки image_urls (массив URL картинок) в таблицу products.
-- Соответствует полю Product.imageUrls в schema.prisma.
ALTER TABLE "products" ADD COLUMN "image_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
