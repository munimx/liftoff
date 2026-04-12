# Phase 1 — Monorepo Foundation
## GitHub Copilot CLI Instructions

**Read `.github/copilot-instructions.md` before this file. All global rules apply.**
**There is no AWS in this project. Do not import or reference any AWS SDK or provider.**

---

## Objective

Scaffold the complete monorepo skeleton. Exit condition: both dev servers run, TypeScript compiles with zero errors, API health check returns 200.

---

## Build Order

### STEP 1 — Root Config Files

**`package.json` (root)** — private monorepo, scripts: `dev/build/test/lint/format/typecheck/clean` all via turbo, devDeps: prettier, turbo, typescript, engines: node>=20, pnpm>=9

**`pnpm-workspace.yaml`**
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**`turbo.json`** — tasks: build (dependsOn ^build, outputs .next/**+dist/**), dev (cache: false, persistent: true), test (dependsOn ^build, outputs coverage/**), lint, typecheck, clean, db:migrate, db:seed (all cache: false)

**`.prettierrc`** — semi: true, singleQuote: true, trailingComma: all, printWidth: 100, tabWidth: 2

**`.prettierignore`** — node_modules, .next, dist, coverage, prisma/migrations

**`.gitignore`** — node_modules, .next, dist, coverage, .env, .env.local, .env*.local, *.log, .turbo, .DS_Store

---

### STEP 2 — Shared Config Package (`packages/config/`)

**`package.json`** — name: `@liftoff/config`, private, exports typescript/base + nestjs + nextjs tsconfig files

**`tsconfig.base.json`** — target ES2022, strict: true, noUncheckedIndexedAccess: true, esModuleInterop: true, skipLibCheck: true, forceConsistentCasingInFileNames: true, resolveJsonModule: true, declaration: true

**`tsconfig.nestjs.json`** — extends base, adds: module CommonJS, moduleResolution Node, emitDecoratorMetadata: true, experimentalDecorators: true, outDir ./dist

**`tsconfig.nextjs.json`** — extends base, adds: module ESNext, moduleResolution bundler, jsx preserve, plugins: [{name:"next"}]

---

### STEP 3 — Shared Package (`packages/shared/`)

**`package.json`** — name: `@liftoff/shared`, main ./dist/index.js, types ./dist/index.d.ts, scripts: build/dev/typecheck/clean, deps: zod@^3, devDeps: @liftoff/config, typescript

**`tsconfig.json`** — extends `@liftoff/config/typescript/nestjs` (CommonJS for Node compatibility)

**`src/constants/deployment-status.ts`** — export `DeploymentStatus` const object (PENDING, QUEUED, BUILDING, PUSHING, PROVISIONING, DEPLOYING, SUCCESS, FAILED, ROLLING_BACK, ROLLED_BACK, CANCELLED), `DeploymentStatusType`, `TERMINAL_STATUSES[]`, `ACTIVE_STATUSES[]`, `VALID_TRANSITIONS` map

**`src/constants/error-codes.ts`** — export `ErrorCodes` const object:
- AUTH_* (UNAUTHORIZED, FORBIDDEN, TOKEN_EXPIRED, INVALID_TOKEN, GITHUB_FAILED)
- USER_* (NOT_FOUND, ALREADY_EXISTS)
- DO_ACCOUNT_* (NOT_FOUND, INVALID_TOKEN, VALIDATION_FAILED, INSUFFICIENT_PERMISSIONS)
- PROJECT_* (NOT_FOUND, NAME_TAKEN, FORBIDDEN)
- ENVIRONMENT_* (NOT_FOUND, NAME_TAKEN)
- REPOSITORY_* (NOT_FOUND, ALREADY_CONNECTED, ACCESS_DENIED, WEBHOOK_CREATION_FAILED)
- CONFIG_* (INVALID_YAML, VALIDATION_FAILED, MISSING_REQUIRED_FIELDS)
- DEPLOYMENT_* (NOT_FOUND, ALREADY_RUNNING, NO_INFRA, IMAGE_NOT_FOUND, HEALTH_CHECK_FAILED, TIMEOUT)
- PULUMI_* (EXECUTION_FAILED, STATE_CORRUPTED)
- INTERNAL_ERROR, NOT_FOUND, VALIDATION_ERROR, TOO_MANY_REQUESTS

**`src/constants/roles.ts`** — export `ProjectRole = { OWNER, ADMIN, DEVELOPER, VIEWER }` and `ProjectRoleType`

**`src/constants/limits.ts`** — export `Limits` object: MAX_PROJECTS_FREE=3, MAX_ENVIRONMENTS_PER_PROJECT=3, MAX_TEAM_MEMBERS=5, DEPLOYMENT_TIMEOUT_MS=20*60*1000, DOCR_IMAGE_RETENTION_COUNT=10

**`src/constants/websocket-events.ts`** — export `WsEvents` const object with all event strings, export payload interfaces: `WsDeploymentStatusPayload`, `WsDeploymentLogPayload`, `WsDeploymentCompletePayload`, `WsInfraProgressPayload`

**`src/schemas/liftoff-yml.schema.ts`** — Zod schema for liftoff.yml:
- `version: "1.0"` (literal)
- `service.name` (string, lowercase+hyphens, max 40, regex: `/^[a-z0-9][a-z0-9-]*$/`)
- `service.type: "app"` (literal — only App Platform in MVP)
- `service.region` (string, default "nyc3", must be valid DO region slug)
- `runtime.instance_size` (string, default "apps-s-1vcpu-0.5gb", must be valid DO App Platform slug)
- `runtime.replicas` (number, min 1, max 10, default 1)
- `runtime.port` (number, min 1, max 65535)
- `env` (record of strings, optional, default {})
- `secrets` (string[], optional, default [])
- `database.enabled` (boolean, default false), `database.engine` (literal "postgres"), `database.version` (string, default "15"), `database.size` (string, default "db-s-1vcpu-1gb")
- `storage.enabled` (boolean, default false)
- `healthcheck.path` (string, starts with /, default "/health"), `healthcheck.interval` (5-300, default 30), `healthcheck.timeout` (2-60, default 5)
- `domain.name` (string, optional)
- Export: `LiftoffConfigSchema`, `LiftoffConfig` type, `parseLiftoffConfig()`, `safeParseLiftoffConfig()`

**`src/schemas/pagination.schema.ts`** — Zod schema: page (min 1, default 1), limit (min 1, max 100, default 20), export `PaginationQuery` type + `paginate(query)` → `{ skip, take }`

**`src/types/`** — create these type files:
- `user.ts` — `UserPublicDto { id, email, githubUsername, name, avatarUrl, createdAt }`
- `project.ts` — `ProjectDto`, `ProjectWithEnvironmentsDto`
- `environment.ts` — `EnvironmentDto`
- `deployment.ts` — `DeploymentDto`, `DeploymentLogDto`
- `do-account.ts` — `DOAccountDto { id, region, validatedAt, createdAt }` (never include doToken)
- `repository.ts` — `RepositoryDto`

**`src/index.ts`** — re-export everything

---

### STEP 4 — Docker Compose (root)

```yaml
version: "3.9"
services:
  postgres:
    image: postgres:15-alpine
    container_name: liftoff_postgres
    environment: { POSTGRES_DB: liftoff, POSTGRES_USER: liftoff, POSTGRES_PASSWORD: liftoff }
    ports: ["5432:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U liftoff -d liftoff"], interval: 5s, retries: 5 }
  redis:
    image: redis:7-alpine
    container_name: liftoff_redis
    ports: ["6379:6379"]
    volumes: [redis_data:/data]
    command: redis-server --appendonly yes
    healthcheck: { test: ["CMD", "redis-cli", "ping"], interval: 5s }
volumes:
  postgres_data:
  redis_data:
```

---

### STEP 5 — NestJS API (`apps/api/`)

**`package.json`** — dependencies:
- `@liftoff/shared@workspace:*`
- `@nestjs/common@^10`, `@nestjs/config@^3`, `@nestjs/core@^10`, `@nestjs/jwt@^10`
- `@nestjs/mapped-types@^2`, `@nestjs/passport@^10`, `@nestjs/platform-express@^10`
- `@nestjs/platform-socket.io@^10`, `@nestjs/swagger@^7`, `@nestjs/throttler@^6`
- `@nestjs/websockets@^10`, `@nestjs/axios@^3`
- `axios@^1`, `bcrypt@^5`, `bullmq@^5`, `class-transformer@^0.5`, `class-validator@^0.14`
- `cookie-parser@^1`, `helmet@^8`, `ioredis@^5`, `joi@^17`, `js-yaml@^4`
- `passport@^0.7`, `passport-github2@^0.1`, `passport-jwt@^4`
- `reflect-metadata@^0.2`, `rxjs@^7`, `uuid@^10`, `zod@^3`
- `@prisma/client@^5`, `@socket.io/redis-adapter@^8`
- **No `@aws-sdk/*` packages at all**

devDeps: `@liftoff/config@workspace:*`, `@nestjs/cli@^10`, `@nestjs/testing@^10`, `@types/bcrypt`, `@types/cookie-parser`, `@types/jest@^29`, `@types/js-yaml`, `@types/node@^22`, `@types/passport-github2`, `@types/passport-jwt`, `@types/uuid`, `jest@^29`, `prisma@^5`, `ts-jest@^29`, `ts-node@^10`, `typescript@^5`

Scripts: build/dev/start/lint/typecheck/test/test:cov/db:migrate/db:migrate:deploy/db:reset/db:seed/db:studio/db:generate/clean

**`tsconfig.json`** — extends `@liftoff/config/typescript/nestjs`, rootDir: src, outDir: dist, paths for `@liftoff/shared`

**`nest-cli.json`** — sourceRoot: src, deleteOutDir: true

**`.env.example`** — all vars from `docs/ENVIRONMENT.md` with placeholder values and comments. No real secrets. No AWS vars.

**`prisma/schema.prisma`** — full schema:

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql", url = env("DATABASE_URL") }

enum Role { OWNER ADMIN DEVELOPER VIEWER }
enum ServiceType { APP KUBERNETES }
enum DeploymentStatus { PENDING QUEUED BUILDING PUSHING PROVISIONING DEPLOYING SUCCESS FAILED ROLLING_BACK ROLLED_BACK CANCELLED }
enum LogLevel { DEBUG INFO WARN ERROR }

model User {
  id             String    @id @default(cuid())
  email          String    @unique
  githubId       String    @unique @map("github_id")
  githubUsername String    @map("github_username")
  githubToken    String?   @map("github_token")    // encrypted
  name           String?
  avatarUrl      String?   @map("avatar_url")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")
  deletedAt      DateTime? @map("deleted_at")
  doAccounts     DOAccount[]
  projects       Project[]
  teamMembers    TeamMember[]
  refreshTokens  RefreshToken[]
  @@map("users")
}

model RefreshToken {
  id        String    @id @default(cuid())
  userId    String    @map("user_id")
  token     String    @unique    // bcrypt hashed
  expiresAt DateTime  @map("expires_at")
  createdAt DateTime  @default(now()) @map("created_at")
  revokedAt DateTime? @map("revoked_at")
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@map("refresh_tokens")
}

model DOAccount {
  id          String    @id @default(cuid())
  userId      String    @map("user_id")
  doToken     String    @map("do_token")   // AES-256-GCM encrypted
  region      String    @default("nyc3")
  validatedAt DateTime? @map("validated_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  environments Environment[]
  @@index([userId])
  @@map("do_accounts")
}

model Project {
  id          String    @id @default(cuid())
  userId      String    @map("user_id")
  name        String
  description String?
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  deletedAt   DateTime? @map("deleted_at")
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  environments Environment[]
  teamMembers  TeamMember[]
  repository   Repository?
  @@unique([userId, name])
  @@index([userId])
  @@map("projects")
}

model TeamMember {
  id        String   @id @default(cuid())
  projectId String   @map("project_id")
  userId    String   @map("user_id")
  role      Role     @default(DEVELOPER)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([projectId, userId])
  @@map("team_members")
}

model Repository {
  id            String   @id @default(cuid())
  projectId     String   @unique @map("project_id")
  githubId      Int      @map("github_id")
  fullName      String   @map("full_name")
  cloneUrl      String   @map("clone_url")
  webhookId     Int?     @map("webhook_id")
  webhookSecret String?  @map("webhook_secret")  // encrypted
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  @@map("repositories")
}

model Environment {
  id           String      @id @default(cuid())
  projectId    String      @map("project_id")
  doAccountId  String      @map("do_account_id")
  name         String
  gitBranch    String      @map("git_branch")
  serviceType  ServiceType @default(APP) @map("service_type")
  configYaml   String?     @map("config_yaml")
  configParsed Json?       @map("config_parsed")
  createdAt    DateTime    @default(now()) @map("created_at")
  updatedAt    DateTime    @updatedAt @map("updated_at")
  deletedAt    DateTime?   @map("deleted_at")
  project      Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  doAccount    DOAccount   @relation(fields: [doAccountId], references: [id])
  deployments  Deployment[]
  pulumiStack  PulumiStack?
  resources    InfrastructureResource[]
  alerts       Alert[]
  @@unique([projectId, name])
  @@index([projectId])
  @@map("environments")
}

model Deployment {
  id            String           @id @default(cuid())
  environmentId String           @map("environment_id")
  status        DeploymentStatus @default(PENDING)
  commitSha     String?          @map("commit_sha")
  commitMessage String?          @map("commit_message")
  branch        String?
  imageUri      String?          @map("image_uri")    // DOCR image URI
  triggeredBy   String?          @map("triggered_by")
  endpoint      String?          // DO App Platform live URL
  errorMessage  String?          @map("error_message")
  startedAt     DateTime?        @map("started_at")
  completedAt   DateTime?        @map("completed_at")
  createdAt     DateTime         @default(now()) @map("created_at")
  updatedAt     DateTime         @updatedAt @map("updated_at")
  environment   Environment      @relation(fields: [environmentId], references: [id], onDelete: Cascade)
  logs          DeploymentLog[]
  @@index([environmentId])
  @@index([environmentId, createdAt(sort: Desc)])
  @@map("deployments")
}

model DeploymentLog {
  id           String     @id @default(cuid())
  deploymentId String     @map("deployment_id")
  level        LogLevel   @default(INFO)
  message      String
  source       String     @default("system")  // "build" | "pulumi" | "app-platform" | "system"
  timestamp    DateTime   @default(now())
  deployment   Deployment @relation(fields: [deploymentId], references: [id], onDelete: Cascade)
  @@index([deploymentId, timestamp])
  @@map("deployment_logs")
}

model PulumiStack {
  id            String    @id @default(cuid())
  environmentId String    @unique @map("environment_id")
  stackName     String    @map("stack_name")
  stateSpacesKey String   @map("state_spaces_key")  // DO Spaces object key
  outputs       Json?                                // stack outputs: appUrl, registryUrl, etc.
  lastUpdated   DateTime? @map("last_updated")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")
  environment   Environment @relation(fields: [environmentId], references: [id], onDelete: Cascade)
  @@map("pulumi_stacks")
}

model InfrastructureResource {
  id            String      @id @default(cuid())
  environmentId String      @map("environment_id")
  resourceType  String      @map("resource_type")   // "digitalocean:index/app:App"
  resourceName  String      @map("resource_name")
  doResourceId  String?     @map("do_resource_id")  // DO resource URN or ID
  doRegion      String      @map("do_region")
  tags          Json?
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")
  environment   Environment @relation(fields: [environmentId], references: [id], onDelete: Cascade)
  @@index([environmentId])
  @@map("infrastructure_resources")
}

model Alert {
  id              String      @id @default(cuid())
  environmentId   String      @map("environment_id")
  name            String
  type            String      // "LATENCY" | "CPU" | "MEMORY" | "BANDWIDTH" | "DOWN"
  threshold       Float
  notificationEmail String?   @map("notification_email")
  doAlertId       String?     @map("do_alert_id")
  createdAt       DateTime    @default(now()) @map("created_at")
  updatedAt       DateTime    @updatedAt @map("updated_at")
  environment     Environment @relation(fields: [environmentId], references: [id], onDelete: Cascade)
  @@map("alerts")
}
```

**`src/main.ts`** — NestJS bootstrap: helmet, CORS (frontendUrl, credentials:true), cookieParser, global prefix from config, URI versioning, ValidationPipe (whitelist+transform+forbidNonWhitelisted), global HttpExceptionFilter, global LoggingInterceptor, Swagger in non-production, listen on PORT, print startup URL

**`src/app.module.ts`** — ConfigModule (global) with Joi schema validating **exactly these variables**:
```
NODE_ENV, PORT, FRONTEND_URL, WEBHOOK_BASE_URL
DATABASE_URL, REDIS_URL
JWT_SECRET (min 32), JWT_REFRESH_SECRET (min 32), JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN
GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_CALLBACK_URL, GITHUB_WEBHOOK_SECRET
DO_API_TOKEN
DO_SPACES_ACCESS_KEY, DO_SPACES_SECRET_KEY, DO_SPACES_BUCKET, DO_SPACES_ENDPOINT, DO_SPACES_REGION
DOCR_NAME
PULUMI_PASSPHRASE
ENCRYPTION_KEY (length 64)
THROTTLE_TTL (default 60000), THROTTLE_LIMIT (default 100)
```
Then ThrottlerModule, BullModule.forRootAsync (Redis URL), feature modules.

**`src/app.controller.ts`** — `GET /health` marked `@Public()` returns `{ status: 'ok', timestamp }`

**`src/prisma/prisma.service.ts`** — extends PrismaClient, OnModuleInit+OnModuleDestroy, logs connection, `softDelete()` helper

**`src/prisma/prisma.module.ts`** — `@Global()`, provides+exports PrismaService

**`src/common/filters/http-exception.filter.ts`** — catches all exceptions, shapes to `{ statusCode, error, message, code, timestamp, path }`

**`src/common/exceptions/app.exception.ts`** — extends HttpException, takes `(message, HttpStatus, ErrorCodeType)`, export `Exceptions` factory (notFound, forbidden, badRequest, conflict, unauthorized, internalError)

**`src/common/decorators/index.ts`** — `@Public()` (IS_PUBLIC_KEY SetMetadata), `@CurrentUser()` (param decorator req.user), `@Roles(...roles)` (ROLES_KEY SetMetadata)

**`src/common/decorators/public.decorator.ts`** — re-export Public + IS_PUBLIC_KEY

**`src/common/guards/jwt-auth.guard.ts`** — extends AuthGuard('jwt'), checks IS_PUBLIC_KEY via Reflector

**`src/common/interceptors/logging.interceptor.ts`** — logs METHOD /path STATUS Xms via tap()

**`src/common/services/encryption.service.ts`** — AES-256-GCM, key from ENCRYPTION_KEY (hex→Buffer), `encrypt(plaintext)→string`, `decrypt(encrypted)→string`, `hash(value)→Promise<string>`, `compare(value, hash)→Promise<boolean>`

**`src/common/common.module.ts`** — `@Global()`, provides+exports EncryptionService

**`src/do-api/do-api.service.ts`** — DigitalOcean REST API wrapper using `@nestjs/axios`:
- `validateToken(doToken): Promise<{ email, uuid, status }>` — GET /v2/account
- `getAppDeploymentStatus(doToken, appId, deploymentId): Promise<string>` — GET /v2/apps/{appId}/deployments/{deploymentId}
- `getAppLogs(doToken, appId, deploymentId): Promise<string>` — GET /v2/apps/{appId}/deployments/{deploymentId}/logs
- All methods set `Authorization: Bearer {doToken}` header and base URL `https://api.digitalocean.com`

**`src/do-api/do-api.module.ts`** — provides DoApiService, exports DoApiService

**`src/queues/queue.constants.ts`** — QUEUE_NAMES (DEPLOYMENTS, INFRASTRUCTURE), JOB_NAMES nested, payload interfaces: `DeployJobPayload`, `RollbackJobPayload`, `InfraProvisionJobPayload`, `InfraDestroyJobPayload`

**`src/queues/queues.module.ts`** — BullModule.registerQueue for both queues, exports BullModule

**`src/events/events.gateway.ts`** — Socket.io gateway on `/deployments`, JWT auth from handshake.auth.token, room management: join/leave deployment + environment, broadcast helpers: broadcastDeploymentStatus/Log/Complete/InfraProgress

**`src/events/events.module.ts`** — JwtModule.registerAsync, provides EventsGateway, exports EventsGateway

**Stub modules** (empty module + empty service + empty controller, all must compile):
- src/auth/auth.module.ts
- src/users/users.module.ts
- src/projects/projects.module.ts
- src/environments/environments.module.ts
- src/repositories/repositories.module.ts
- src/deployments/deployments.module.ts
- src/do-accounts/do-accounts.module.ts
- src/infrastructure/infrastructure.module.ts
- src/monitoring/monitoring.module.ts
- src/webhooks/webhooks.module.ts

---

### STEP 6 — Next.js Web App (`apps/web/`)

**`package.json`** — next@14, react@^18, react-dom@^18, @liftoff/shared@workspace:*, shadcn/ui radix primitives, @tanstack/react-query@^5, axios@^1, class-variance-authority, clsx, lucide-react, react-hook-form, @hookform/resolvers, recharts, socket.io-client@^4, tailwind-merge, tailwindcss-animate, zod@^3, zustand@^5

**`next.config.js`** — transpilePackages: ['@liftoff/shared'], reactStrictMode: true, images.remotePatterns: avatars.githubusercontent.com, redirect '/' → '/dashboard'

**`tsconfig.json`** — extends `@liftoff/config/typescript/nextjs`, paths `@/*` → `./src/*`

**`tailwind.config.ts`** — full shadcn/ui config with CSS variable colors, tailwindcss-animate plugin

**`postcss.config.js`** — tailwindcss + autoprefixer

**`app/globals.css`** — Tailwind directives + CSS variables for light/dark (shadcn/ui default palette)

**`app/layout.tsx`** — root layout, Inter font, `<Providers>` wrapper, metadata

**`app/providers.tsx`** — client component: QueryClientProvider (staleTime: 30000) + Toaster

**`lib/api-client.ts`** — Axios instance:
- baseURL: `${NEXT_PUBLIC_API_URL}/api/v1`
- withCredentials: true
- Request interceptor: attach `Authorization: Bearer {accessToken}` from Zustand store
- Response interceptor: on 401 → POST /auth/refresh → retry once → else clearAuth() + redirect /login

**`lib/ws-client.ts`** — Socket.io singleton: `io(WS_URL + '/deployments', { auth: { token }, autoConnect: false })`, export `getSocket()`, `disconnectSocket()`

**`store/auth.store.ts`** — Zustand: `{ user, accessToken, isAuthenticated, isLoading, setAuth, clearAuth, setToken, setLoading }` — no localStorage, memory only

**`app/(auth)/login/page.tsx`** — "Sign in with GitHub" button → href `${NEXT_PUBLIC_API_URL}/api/auth/github`

**`app/(dashboard)/layout.tsx`** — client component, calls `useAuthRehydration()`, shows spinner while loading, sidebar + header layout

**`app/(dashboard)/dashboard/page.tsx`** — placeholder "Welcome to Liftoff" heading + CTA

---

### STEP 7 — Pulumi Components Skeleton (`packages/pulumi-components/`)

**`package.json`** — name: `@liftoff/pulumi-components`, main ./dist/index.js, deps: `@liftoff/shared@workspace:*`, `@pulumi/digitalocean@^4`, `@pulumi/pulumi@^3`, devDeps: `@liftoff/config@workspace:*`, typescript — **no @pulumi/aws**

**`tsconfig.json`** — extends nestjs config (CommonJS for Pulumi)

**`src/index.ts`** — placeholder:
```typescript
// Pulumi DO infrastructure components — implemented in Phase 5
export const LIFTOFF_PULUMI_VERSION = '0.1.0';
```

---

### STEP 8 — Initial Migration

```bash
pnpm --filter api db:generate
pnpm --filter api db:migrate
# Name the migration: initial_schema
```

**`prisma/seed.ts`** — minimal: log "Seed complete", disconnect

---

## Acceptance Tests

```bash
pnpm install           # no errors
pnpm typecheck         # zero errors across ALL packages
pnpm --filter shared build
pnpm --filter api db:migrate

# Terminal 1:
pnpm --filter api dev
curl http://localhost:4000/api/health  # {"status":"ok","timestamp":"..."}
# http://localhost:4000/api/docs  → Swagger loads

# Terminal 2:
pnpm --filter web dev
# http://localhost:3000/login  → renders
```

## Notes for Copilot

- No `@aws-sdk/*` in any package.json — fail the build if any AWS import appears
- `DOAccount` model uses `doToken` (not `roleArn` or `externalId`) — no STS
- `PulumiStack` model has `stateSpacesKey` (not `stateS3Key`) — reflects DO Spaces
- `InfrastructureResource` has `doResourceId` and `doRegion` (not AWS ARN/region fields)
- The `DO_API_TOKEN` env var is Liftoff's own token; user DO tokens come from the `DOAccount` table (encrypted)
- `EncryptionService` in `CommonModule` is `@Global()` — available everywhere without re-importing the module
- `DoApiService` in `DoApiModule` should also be exported globally or imported where needed
- All stub modules must have a valid `@Module({})` decorator — they will fail at runtime otherwise
