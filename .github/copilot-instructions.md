# GitHub Copilot — Liftoff Project Instructions

> This file is the **single source of truth** for GitHub Copilot CLI.
> Read it entirely before generating any code.

---

## Project Identity

**Liftoff** is a Deploy-as-a-Service (DaaS) platform. Developers push code — Liftoff builds the Docker image and provisions DigitalOcean infrastructure in **the user's own DigitalOcean account** via Pulumi + GitHub Actions. The developer experience is a single `liftoff.yml` config file + `git push`.

**Everything is DigitalOcean.** The Liftoff platform (NestJS API + Next.js web) runs on DO App Platform. Platform storage is DO Managed PostgreSQL + Managed Redis. Pulumi state is in DO Spaces. Container images are in DOCR. User apps also deploy to DigitalOcean — into the user's own DO account.

**There is no AWS in this project.** Do not reference, import, or configure any AWS SDK, AWS provider, ECR, ECS, EKS, RDS (AWS), S3 (AWS), CloudWatch, STS, or IAM anywhere in this codebase.

**This is a greenfield monorepo.** Build everything from scratch unless a file already exists.

---

## Non-Negotiable Rules

1. **TypeScript everywhere** — No plain `.js` files. Strict mode on.
2. **Never use `any`** — Use proper types or generics.
3. **Never store user DO tokens in plaintext** — Encrypt with AES-256-GCM via `EncryptionService` before writing to DB.
4. **Never log secrets** — Sanitize all error messages before they reach the user.
5. **Prisma is the ORM** — Never write raw SQL outside a parameterized `$queryRaw`.
6. **BullMQ for all async jobs** — Never do long-running work in an HTTP request handler.
7. **Every public API endpoint needs a guard** — `@UseGuards(JwtAuthGuard)` or `@Public()`.
8. **Zod for all external input validation** — `liftoff.yml` schemas, API bodies, env vars.
9. **Test files live next to source** — `foo.service.ts` → `foo.service.spec.ts`.
10. **Write JSDoc on all exported functions and classes.**
11. **No AWS anywhere** — Not in imports, not in env vars, not in comments. This is a DO-only project.

---

## Tech Stack (Do Not Deviate)

### Platform vs User Infrastructure

| Concern | DigitalOcean Service | Notes |
|---------|---------------------|-------|
| Liftoff API hosting | App Platform (Docker) | NestJS container |
| Liftoff Web hosting | App Platform (Docker) | Next.js container |
| Platform database | Managed PostgreSQL | Liftoff's own data |
| Platform cache/queue | Managed Redis | BullMQ + sessions |
| Platform container images | Container Registry (DOCR) | `registry.digitalocean.com/liftoff/...` |
| Pulumi state storage | Spaces (S3-compatible) | State files for all user stacks |
| User app containers | App Platform (user's DO account) | Provisioned by Pulumi |
| User container images | DOCR (user's DO account) | Built by GitHub Actions |
| User database | Managed PostgreSQL (user's DO account) | Optional, provisioned by Pulumi |
| User file storage | Spaces (user's DO account) | Optional, provisioned by Pulumi |

---

### Frontend — `apps/web`
- **Framework:** Next.js 14 with App Router (`app/` directory)
- **Language:** TypeScript 5.x, strict mode
- **Styling:** Tailwind CSS v3 + shadcn/ui
- **State:** Zustand (global) + TanStack Query (server state)
- **Forms:** React Hook Form + Zod resolvers
- **Real-time:** Socket.io client
- **HTTP client:** Axios with auth interceptors
- **Icons:** Lucide React

### Backend — `apps/api`
- **Framework:** NestJS 10 with TypeScript
- **Runtime:** Node.js 20 LTS
- **ORM:** Prisma 5 with PostgreSQL
- **Auth:** Passport.js (`passport-jwt` + `passport-github2`); JWT access tokens (15min) + refresh tokens (7d, HTTP-only cookie)
- **Queues:** BullMQ + Redis (ioredis)
- **WebSockets:** `@nestjs/platform-socket.io`
- **HTTP client:** `@nestjs/axios` for GitHub API + DigitalOcean API calls
- **DO SDK:** `axios` calls to `https://api.digitalocean.com/v2/` — DO does not have an official Node SDK; use the REST API directly via `@nestjs/axios`
- **Docs:** `@nestjs/swagger`
- **Config:** `@nestjs/config` with Joi startup validation

### User Infrastructure — `packages/pulumi-components`
- **IaC tool:** Pulumi 3.x with TypeScript — runs as a **child subprocess** inside the API
- **DO provider:** `@pulumi/digitalocean` — all user resources go into the user's DO account
- **Pulumi state backend:** DO Spaces (S3-compatible) — `s3://liftoff-pulumi-state` with Spaces endpoint
- **User credentials:** User's DO API token (encrypted in DB) → passed to `new digitalocean.Provider({ token })` inside the Pulumi program
- **Resources provisioned (in user's DO account):** App Platform app, DOCR repository, Managed PostgreSQL (optional), Spaces bucket (optional)

### Platform Infrastructure — `infra/`
- Pulumi program provisioning the Liftoff platform itself on DigitalOcean
- Uses `@pulumi/digitalocean` (not any other provider)
- Creates: DO App Platform app spec, Managed PostgreSQL, Managed Redis, Spaces bucket, Container Registry

### Shared — `packages/shared`
- TypeScript types shared across frontend and backend
- Zod schemas for `liftoff.yml` configuration
- Constants (error codes, limits, WebSocket events)

### Database
- **Local dev:** PostgreSQL 15 via Docker
- **Production:** DO Managed PostgreSQL

### Cache / Queue
- **Local dev:** Redis 7 via Docker
- **Production:** DO Managed Redis (`rediss://` TLS URL)

### CI/CD
- GitHub Actions — builds and pushes images to DOCR, then triggers DO App Platform deploy
- Platform image target: `registry.digitalocean.com/liftoff/api`, `.../web`
- User image target: `registry.digitalocean.com/USER_REGISTRY/PROJECT/ENV:SHA`

---

## Directory Structure

```
apps/api/src/
├── auth/                    # Auth module: JWT, GitHub OAuth, refresh tokens
├── users/                   # Users module: profile CRUD
├── projects/                # Projects module
├── environments/            # Environments module
├── deployments/             # Deployments module
├── infrastructure/          # Pulumi runner + DO infra service
├── repositories/            # GitHub repo integration
├── monitoring/              # DO App Platform logs + metrics
├── webhooks/                # GitHub webhook receiver + deploy-complete callback
├── do-accounts/             # User DO account connection + validation
├── config/                  # liftoff.yml parsing + validation
├── queues/                  # BullMQ queue definitions + processors
├── events/                  # WebSocket gateway
├── do-api/                  # DigitalOcean API client service (REST wrapper)
├── common/                  # Guards, interceptors, decorators, filters, exceptions
├── prisma/                  # PrismaService, migrations, seed
└── main.ts

packages/pulumi-components/src/
├── app-platform/            # DO App Platform app component
├── registry/                # DO Container Registry component
├── database/                # DO Managed PostgreSQL component
├── storage/                 # DO Spaces bucket component
├── stacks/                  # Full stack compositions (app-platform-stack.ts)
└── index.ts

apps/web/app/
├── (auth)/                  # Login page, auth callback
├── (dashboard)/             # Authenticated pages
│   ├── dashboard/
│   ├── projects/
│   ├── projects/[id]/
│   ├── projects/[id]/environments/[envId]/
│   └── settings/
└── providers.tsx
```

---

## NestJS Patterns

### Module structure (every feature module must have):
```
feature/
├── feature.module.ts
├── feature.controller.ts   (@ApiTags, @ApiBearerAuth, @UseGuards(JwtAuthGuard))
├── feature.service.ts
├── feature.controller.spec.ts
├── feature.service.spec.ts
└── dto/
    ├── create-feature.dto.ts
    └── update-feature.dto.ts
```

### DTO pattern
```typescript
export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[a-z0-9][a-z0-9-]*$/, { message: 'Lowercase letters, numbers, hyphens only' })
  @ApiProperty({ example: 'my-webapp' })
  name: string;
}
```

### Queue job pattern
```typescript
// Enqueue
await this.deploymentsQueue.add('deploy', { deploymentId }, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
});

// Processor
@Processor('deployments')
export class DeploymentProcessor {
  @Process('deploy')
  async handleDeploy(job: Job<{ deploymentId: string }>) { ... }
}
```

---

## Pulumi Credential Pattern

The Pulumi subprocess needs two separate credential sets:

| Purpose | Env var name | Value source |
|---------|-------------|-------------|
| State backend (Spaces) | `AWS_ACCESS_KEY_ID` | `DO_SPACES_ACCESS_KEY` |
| State backend (Spaces) | `AWS_SECRET_ACCESS_KEY` | `DO_SPACES_SECRET_KEY` |
| State backend endpoint | `AWS_ENDPOINT_URL_S3` | `DO_SPACES_ENDPOINT` |
| State backend region | `AWS_REGION` | `DO_SPACES_REGION` |
| User infra (DO API) | `DIGITALOCEAN_TOKEN` | Decrypted user DO token |

The `DIGITALOCEAN_TOKEN` env var is read by `@pulumi/digitalocean` automatically. The Pulumi program also uses an explicit provider for clarity:

```typescript
// packages/pulumi-components/src/stacks/app-platform-stack.ts
const userProvider = new digitalocean.Provider('user', {
  token: args.doToken, // decrypted from DOAccount.doToken
});
// All resources pass: { provider: userProvider }
```

---

## Authentication Flow

```
1. User visits /login → clicks "Sign in with GitHub"
2. Redirect to GitHub OAuth → callback to /api/auth/github/callback
3. Backend: upsert User, issue JWT access token (15min) + refresh token (7d, HTTP-only cookie)
4. Frontend: store access token in Zustand (memory only, never localStorage)
5. Axios interceptor: attach Bearer token to every request
6. On 401: call /api/auth/refresh (uses cookie) → get new access token, retry once
7. On refresh fail: clearAuth() + redirect to /login
```

---

## Deployment State Machine

```
PENDING → QUEUED → BUILDING → PUSHING → PROVISIONING → DEPLOYING → SUCCESS
                                                                   → FAILED
                                                       → ROLLING_BACK → ROLLED_BACK
```

Every state transition: persist to DB + broadcast via WebSocket.

---

## WebSocket Events (namespace `/deployments`)

| Event | Direction | Payload |
|-------|-----------|---------|
| `deployment:status` | server→client | `{ deploymentId, status, timestamp }` |
| `deployment:log` | server→client | `{ deploymentId, line, timestamp, level, source }` |
| `deployment:complete` | server→client | `{ deploymentId, status, endpoint? }` |
| `infrastructure:progress` | server→client | `{ deploymentId, resourceType, resourceName, action, status }` |
| `join:deployment` | client→server | `{ deploymentId }` |
| `join:environment` | client→server | `{ environmentId }` |

---

## Error Response Format

```json
{
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Human-readable message safe to display",
  "code": "PROJECT_NAME_TAKEN",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "path": "/api/v1/projects"
}
```

Use `AppException` from `src/common/exceptions/app.exception.ts` for all thrown errors.

---

## Environment Variables (Quick Reference)

See `docs/ENVIRONMENT.md` for full details.

**`apps/api/.env` key vars:**
```
DATABASE_URL=postgresql://liftoff:liftoff@localhost:5432/liftoff
REDIS_URL=redis://localhost:6379
JWT_SECRET=<64 hex chars>
JWT_REFRESH_SECRET=<64 hex chars>
GITHUB_CLIENT_ID=<OAuth App>
GITHUB_CLIENT_SECRET=<OAuth App>
GITHUB_CALLBACK_URL=http://localhost:4000/api/auth/github/callback
GITHUB_WEBHOOK_SECRET=<40 hex chars>
DO_API_TOKEN=<Liftoff's own DO token>
DO_SPACES_ACCESS_KEY=<Spaces key>
DO_SPACES_SECRET_KEY=<Spaces secret>
DO_SPACES_BUCKET=liftoff-pulumi-state
DO_SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
DO_SPACES_REGION=nyc3
DOCR_NAME=liftoff
PULUMI_PASSPHRASE=<random>
ENCRYPTION_KEY=<64 hex chars>
WEBHOOK_BASE_URL=http://localhost:4000
```

---

## Phase Build Order

Build strictly in this order:

1. **Monorepo Foundation** — skeleton, shared packages, docker-compose, Prisma schema, API + web stubs
2. **Authentication** — GitHub OAuth, JWT, refresh tokens, frontend login
3. **Core Models & API** — DO account connection, Projects, Environments CRUD, dashboard UI
4. **GitHub Integration** — repo connection, webhook receiver, workflow generator (DOCR not ECR)
5. **Infrastructure Provisioning** — `@pulumi/digitalocean` components, Pulumi runner subprocess, DO Spaces state
6. **Container Deployment** — DOCR service, App Platform deploy service, deployment processor
7. **Monitoring & Logging** — DO App Platform logs + metrics API, WebSocket streaming
8. **Rollback & Management** — rollback to previous App Platform deployment, history UI
9. **Polish & Production** — Dockerfiles, `infra/` Pulumi stack for platform, GitHub Actions CI/CD

---

## Do Not

- Do NOT import, reference, or configure anything from `@aws-sdk/*` — there is no AWS
- Do NOT use `aws-sdk`, `@pulumi/aws`, `@pulumi/awsx`, or any AWS provider
- Do NOT mention ECR, ECS, EKS, RDS (AWS), CloudWatch, STS, IAM, ALB, VPC in user infrastructure
- Do NOT use `create-next-app` defaults — follow the structure above exactly
- Do NOT use `express` or `fastify` — this is NestJS
- Do NOT use `mongoose` or `typeorm` — this is Prisma
- Do NOT use `redux` — use Zustand
- Do NOT use `fetch` directly in components — use the shared Axios client
- Do NOT use Pulumi Cloud for state — use DO Spaces
- Do NOT store user DO tokens in plaintext — always encrypt via `EncryptionService`
- Do NOT expose user DO tokens in any API response
