-- AlterTable
ALTER TABLE "environments"
ADD COLUMN "liftoff_deploy_secret" TEXT;

-- AlterTable
ALTER TABLE "repositories"
ADD COLUMN "branch" TEXT NOT NULL DEFAULT 'main';
