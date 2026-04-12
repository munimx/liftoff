-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('APP', 'KUBERNETES');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('PENDING', 'QUEUED', 'BUILDING', 'PUSHING', 'PROVISIONING', 'DEPLOYING', 'SUCCESS', 'FAILED', 'ROLLING_BACK', 'ROLLED_BACK', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "github_id" TEXT NOT NULL,
    "github_username" TEXT NOT NULL,
    "github_token" TEXT,
    "name" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "do_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "do_token" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'nyc3',
    "validated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "do_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'DEVELOPER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repositories" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "github_id" INTEGER NOT NULL,
    "full_name" TEXT NOT NULL,
    "clone_url" TEXT NOT NULL,
    "webhook_id" INTEGER,
    "webhook_secret" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environments" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "do_account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "git_branch" TEXT NOT NULL,
    "service_type" "ServiceType" NOT NULL DEFAULT 'APP',
    "config_yaml" TEXT,
    "config_parsed" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "environments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployments" (
    "id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "status" "DeploymentStatus" NOT NULL DEFAULT 'PENDING',
    "commit_sha" TEXT,
    "commit_message" TEXT,
    "branch" TEXT,
    "image_uri" TEXT,
    "triggered_by" TEXT,
    "endpoint" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployment_logs" (
    "id" TEXT NOT NULL,
    "deployment_id" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'system',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deployment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pulumi_stacks" (
    "id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "stack_name" TEXT NOT NULL,
    "state_spaces_key" TEXT NOT NULL,
    "outputs" JSONB,
    "last_updated" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pulumi_stacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "infrastructure_resources" (
    "id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_name" TEXT NOT NULL,
    "do_resource_id" TEXT,
    "do_region" TEXT NOT NULL,
    "tags" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "infrastructure_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "environment_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "notification_email" TEXT,
    "do_alert_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_github_id_key" ON "users"("github_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "do_accounts_user_id_idx" ON "do_accounts"("user_id");

-- CreateIndex
CREATE INDEX "projects_user_id_idx" ON "projects"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_user_id_name_key" ON "projects"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_project_id_user_id_key" ON "team_members"("project_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_project_id_key" ON "repositories"("project_id");

-- CreateIndex
CREATE INDEX "environments_project_id_idx" ON "environments"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "environments_project_id_name_key" ON "environments"("project_id", "name");

-- CreateIndex
CREATE INDEX "deployments_environment_id_idx" ON "deployments"("environment_id");

-- CreateIndex
CREATE INDEX "deployments_environment_id_created_at_idx" ON "deployments"("environment_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "deployment_logs_deployment_id_timestamp_idx" ON "deployment_logs"("deployment_id", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "pulumi_stacks_environment_id_key" ON "pulumi_stacks"("environment_id");

-- CreateIndex
CREATE INDEX "infrastructure_resources_environment_id_idx" ON "infrastructure_resources"("environment_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "do_accounts" ADD CONSTRAINT "do_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environments" ADD CONSTRAINT "environments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environments" ADD CONSTRAINT "environments_do_account_id_fkey" FOREIGN KEY ("do_account_id") REFERENCES "do_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_logs" ADD CONSTRAINT "deployment_logs_deployment_id_fkey" FOREIGN KEY ("deployment_id") REFERENCES "deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pulumi_stacks" ADD CONSTRAINT "pulumi_stacks_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "infrastructure_resources" ADD CONSTRAINT "infrastructure_resources_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
