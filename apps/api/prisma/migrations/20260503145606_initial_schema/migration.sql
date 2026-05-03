-- CreateTable
CREATE TABLE "pipeline_graphs" (
    "id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "nodes" JSONB NOT NULL,
    "edges" JSONB NOT NULL,
    "compiled_yaml" TEXT,
    "is_valid" BOOLEAN NOT NULL DEFAULT false,
    "validation_errors" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_graphs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_graphs_environment_id_key" ON "pipeline_graphs"("environment_id");

-- AddForeignKey
ALTER TABLE "pipeline_graphs" ADD CONSTRAINT "pipeline_graphs_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
