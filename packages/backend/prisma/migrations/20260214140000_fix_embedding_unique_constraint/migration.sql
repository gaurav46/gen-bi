-- DropIndex
DROP INDEX IF EXISTS "column_embeddings_connection_id_column_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "column_embeddings_connection_id_table_id_column_id_key" ON "column_embeddings"("connection_id", "table_id", "column_id");
