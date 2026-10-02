-- BE-10: store money as exact DECIMAL(10,2) instead of DOUBLE PRECISION.
-- Existing values are rounded to 2 decimal places (piastres) during the cast.
ALTER TABLE "products"
    ALTER COLUMN "price" SET DATA TYPE DECIMAL(10,2) USING ROUND("price"::numeric, 2);

ALTER TABLE "orders"
    ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(10,2) USING ROUND("totalAmount"::numeric, 2);

ALTER TABLE "order_items"
    ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(10,2) USING ROUND("unitPrice"::numeric, 2);
