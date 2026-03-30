CREATE TABLE "column_embeddings" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"table_id" text NOT NULL,
	"column_id" text NOT NULL,
	"input_text" text NOT NULL,
	"embedding" "FLOAT"[1536] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connection_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"host" text NOT NULL,
	"port" integer DEFAULT 5432 NOT NULL,
	"database_name" text NOT NULL,
	"username" text NOT NULL,
	"encrypted_password" text NOT NULL,
	"db_type" text DEFAULT 'postgresql' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboards" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovered_columns" (
	"id" text PRIMARY KEY NOT NULL,
	"table_id" text NOT NULL,
	"column_name" text NOT NULL,
	"data_type" text NOT NULL,
	"is_nullable" boolean NOT NULL,
	"ordinal_position" integer NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovered_foreign_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"table_id" text NOT NULL,
	"constraint_name" text NOT NULL,
	"column_name" text NOT NULL,
	"foreign_table_schema" text NOT NULL,
	"foreign_table_name" text NOT NULL,
	"foreign_column_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovered_indexes" (
	"id" text PRIMARY KEY NOT NULL,
	"table_id" text NOT NULL,
	"index_name" text NOT NULL,
	"column_name" text NOT NULL,
	"is_unique" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovered_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"schema_name" text NOT NULL,
	"table_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "widgets" (
	"id" text PRIMARY KEY NOT NULL,
	"dashboard_id" text NOT NULL,
	"title" text NOT NULL,
	"chart_type" text NOT NULL,
	"sql" text NOT NULL,
	"columns" text NOT NULL,
	"legend_labels" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "column_embeddings" ADD CONSTRAINT "column_embeddings_connection_id_connection_configs_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connection_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "column_embeddings" ADD CONSTRAINT "column_embeddings_table_id_discovered_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."discovered_tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "column_embeddings" ADD CONSTRAINT "column_embeddings_column_id_discovered_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."discovered_columns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_connection_id_connection_configs_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connection_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_columns" ADD CONSTRAINT "discovered_columns_table_id_discovered_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."discovered_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_foreign_keys" ADD CONSTRAINT "discovered_foreign_keys_table_id_discovered_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."discovered_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_indexes" ADD CONSTRAINT "discovered_indexes_table_id_discovered_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."discovered_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_tables" ADD CONSTRAINT "discovered_tables_connection_id_connection_configs_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connection_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widgets" ADD CONSTRAINT "widgets_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "column_embeddings_connection_table_column_unique" ON "column_embeddings" USING btree ("connection_id","table_id","column_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discovered_tables_connection_schema_table_unique" ON "discovered_tables" USING btree ("connection_id","schema_name","table_name");