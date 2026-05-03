# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Liftoff is a Deploy-as-a-Service (DaaS) platform. Developers push code, and Liftoff builds Docker images and provisions DigitalOcean infrastructure in the user's own DO account via Pulumi + GitHub Actions. **Everything is DigitalOcean — there is no AWS anywhere in this project.**

## Commands

```bash
# Local dev setup
docker compose up -d                    # PostgreSQL 15 (:5432) + Redis 7 (:6379)
pnpm install
pnpm --filter api db:migrate            # Run Prisma migrations
pnpm dev                                # Start all apps (web :3000, api :4000)

# Build / lint / test (all via Turborepo)
pnpm build
pnpm lint                               # Runs tsc --noEmit in each app
pnpm typecheck
pnpm test                               # Jest across all packages

# Single-app commands
pnpm --filter api test                  # Run API tests only
pnpm --filter api test -- --testPathPattern=auth  # Run a specific test file
pnpm --filter web dev                   # Run only the web app
pnpm --filter api dev                   # Run only the API

# Database
pnpm --filter api db:generate           # Regenerate Prisma client after schema changes
pnpm --filter api db:studio             # Open Prisma Studio GUI
pnpm --filter api db:reset              # Reset DB (destructive)
pnpm --filter api db:seed               # Seed database

# Formatting
pnpm format                             # Prettier check
```

## Architecture

**Monorepo** managed by pnpm workspaces + Turborepo.

### Workspaces

- `apps/api` — NestJS 10 backend (port 4000). REST API at `/api/v1/`. Prisma ORM, BullMQ queues, Socket.io WebSockets, Passport JWT + GitHub OAuth auth.
- `apps/web` — Next.js 14 frontend (App Router, port 3000). Tailwind + shadcn/ui, Zustand for auth state, TanStack Query for server state, Axios with automatic JWT refresh interceptor.
- `packages/shared` — Shared TypeScript types, Zod schemas (`liftoff.yml` config), constants (error codes, deployment statuses, WebSocket events). Imported as `@liftoff/shared`.
- `packages/pulumi-components` — Reusable Pulumi components for DO infrastructure (App Platform, DOCR, Managed PostgreSQL, Spaces). These run as a child subprocess from the API.
- `packages/config` — Shared TSConfig base configs for NestJS and Next.js.

### Key Data Flow

1. User connects their DO account (token encrypted with AES-256-GCM via `EncryptionService`)
2. User creates a project and links a GitHub repo (webhooks auto-registered)
3. `git push` triggers a GitHub webhook → `WebhooksController` → BullMQ `deployments` queue
4. `DeploymentsProcessor` orchestrates: build image → push to DOCR → enqueue `infrastructure` job
5. `InfrastructureProcessor` runs Pulumi subprocess with user's decrypted DO token → provisions App Platform app in user's DO account
6. All state transitions broadcast via WebSocket (`/deployments` namespace)

### Deployment State Machine

`PENDING → QUEUED → BUILDING → PUSHING → PROVISIONING → DEPLOYING → SUCCESS | FAILED`

(Also: `ROLLING_BACK → ROLLED_BACK`, `CANCELLED`)

### BullMQ Queues

Two queues defined in `apps/api/src/queues/queue.constants.ts`:
- `deployments` — jobs: `deploy`, `rollback`
- `infrastructure` — jobs: `provision`, `destroy`

### Auth Pattern

GitHub OAuth → JWT access token (15min, in-memory via Zustand) + refresh token (7d, HTTP-only cookie). The Axios client in `apps/web/src/lib/api-client.ts` automatically retries on 401 using a shared refresh promise to deduplicate concurrent refreshes.

## Code Conventions

- **TypeScript strict mode everywhere.** No `any` types.
- **Prisma is the only ORM.** Schema at `apps/api/prisma/schema.prisma`. DB columns use `snake_case` via `@map()`, TypeScript fields use `camelCase`.
- **NestJS module pattern:** each feature has `module.ts`, `controller.ts`, `service.ts`, and `dto/` directory. Controllers use `@UseGuards(JwtAuthGuard)` unless marked `@Public()`.
- **Throw `AppException`** (from `src/common/exceptions/app.exception.ts`) with an `ErrorCode` from `@liftoff/shared` — never throw raw `HttpException`.
- **Use `Exceptions.*` factories** (`notFound`, `forbidden`, `badRequest`, `conflict`, `unauthorized`, `internalError`) for common HTTP errors.
- **BullMQ for async work** — never do long-running operations in request handlers.
- **Zod for external input validation** — `liftoff.yml` schemas, any user-supplied config.
- **class-validator decorators** on NestJS DTOs.
- **Test files live next to source** — `foo.service.ts` → `foo.service.spec.ts`. Tests use Jest.
- **DO API calls** go through `DoApiService` (`src/do-api/`), which wraps `axios` calls to `api.digitalocean.com/v2/`. There is no official DO Node SDK.
- **User DO tokens must be encrypted** before DB storage (AES-256-GCM via `EncryptionService` in `src/common/services/`).
- **Frontend HTTP calls** go through the shared Axios client at `src/lib/api-client.ts`, never raw `fetch`.
- **Frontend state:** Zustand for auth (`src/store/auth.store.ts`), TanStack Query hooks in `src/hooks/queries/`.
- **UI components:** shadcn/ui primitives in `src/components/ui/`, layout components in `src/components/layout/`.

## Env Configuration

API env validated at startup via Joi in `AppModule` (`apps/api/src/app.module.ts`). Copy `apps/api/.env.example` to `apps/api/.env`. Key vars: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `GITHUB_CLIENT_ID/SECRET`, `DO_API_TOKEN`, `DO_SPACES_*`, `ENCRYPTION_KEY` (64 hex chars), `PULUMI_PASSPHRASE`.

Web env: `NEXT_PUBLIC_API_URL` in `apps/web/.env.local`.

## Pulumi / Infrastructure

Pulumi state stored in DO Spaces (S3-compatible), not Pulumi Cloud. The API spawns Pulumi as a child process, passing the user's decrypted DO token as `DIGITALOCEAN_TOKEN` env var and Spaces credentials as `AWS_*` env vars (Spaces uses S3-compatible API). All user resources use an explicit `digitalocean.Provider({ token })` — see `packages/pulumi-components/src/stacks/app-platform-stack.ts`.
