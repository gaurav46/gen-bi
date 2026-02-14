-- CreateTable
CREATE TABLE "discovered_tables" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "schema_name" TEXT NOT NULL,
    "table_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discovered_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovered_columns" (
    "id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "column_name" TEXT NOT NULL,
    "data_type" TEXT NOT NULL,
    "is_nullable" BOOLEAN NOT NULL,
    "ordinal_position" INTEGER NOT NULL,

    CONSTRAINT "discovered_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovered_foreign_keys" (
    "id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "column_name" TEXT NOT NULL,
    "foreign_table_schema" TEXT NOT NULL,
    "foreign_table_name" TEXT NOT NULL,
    "foreign_column_name" TEXT NOT NULL,
    "constraint_name" TEXT NOT NULL,

    CONSTRAINT "discovered_foreign_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovered_indexes" (
    "id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "index_name" TEXT NOT NULL,
    "column_name" TEXT NOT NULL,
    "is_unique" BOOLEAN NOT NULL,

    CONSTRAINT "discovered_indexes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "discovered_tables_connection_id_schema_name_table_name_key" ON "discovered_tables"("connection_id", "schema_name", "table_name");

-- AddForeignKey
ALTER TABLE "discovered_columns" ADD CONSTRAINT "discovered_columns_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "discovered_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovered_foreign_keys" ADD CONSTRAINT "discovered_foreign_keys_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "discovered_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovered_indexes" ADD CONSTRAINT "discovered_indexes_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "discovered_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
