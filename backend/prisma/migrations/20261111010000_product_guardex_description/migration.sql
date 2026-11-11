CREATE TABLE "product_guardex" (
  "product_id" TEXT PRIMARY KEY REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "description" TEXT
);
