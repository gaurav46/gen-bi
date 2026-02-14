-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "column_embeddings" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "column_id" TEXT NOT NULL,
    "input_text" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "column_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "column_embeddings_connection_id_column_id_key" ON "column_embeddings"("connection_id", "column_id");
