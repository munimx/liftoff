# Phase 3 — Core Models & API
## GitHub Copilot CLI Instructions

**Read `.github/copilot-instructions.md` before this file. No AWS anywhere.**
**Phases 1 and 2 are complete.**

---

## Objective

Build the core CRUD layer:
1. DO Account connection (validate user's DO token via DO API)
2. Projects CRUD with ownership enforcement
3. Environments CRUD (child of Project)
4. Frontend: dashboard, project list, create project form, project detail, settings

---

## Backend — `apps/api/src/`

### DO ACCOUNTS MODULE — `src/do-accounts/`

**`src/do-accounts/do-accounts.service.ts`**

```typescript
// create(userId, dto): Promise<DOAccount>
//   - Decrypt is not needed on create — encrypt and store
//   - Validate token first: DoApiService.validateToken(dto.doToken)
//   - If invalid: throw AppException BAD_REQUEST DO_ACCOUNT_INVALID_TOKEN
//   - Encrypt doToken: EncryptionService.encrypt(dto.doToken)
//   - Create DOAccount record with encrypted token
//   - Set validatedAt = now() (we just validated it)
//   - Return account (NEVER include doToken in return value)

// findAllByUser(userId): Promise<DOAccount[]>
//   - Return all accounts for user (without doToken field)

// findOne(id, userId): Promise<DOAccount>
//   - Filter by id AND userId
//   - Throw NOT_FOUND if missing

// validate(id, userId): Promise<{ valid: boolean; email?: string; error?: string }>
//   - Fetch account, decrypt token
//   - Call DoApiService.validateToken(decryptedToken)
//   - If valid: update validatedAt = now(), return { valid: true, email }
//   - If invalid: return { valid: false, error: reason }

// delete(id, userId): Promise<void>
//   - Check no environments use this account
//   - If yes: throw 409 CONFLICT with environment names
//   - Delete record

// getDecryptedToken(id, userId): Promise<string>
//   - INTERNAL USE ONLY — for Pulumi runner
//   - Fetch account, decrypt + return token
//   - Never expose this through the controller
```

**`src/do-accounts/dto/create-do-account.dto.ts`**
```typescript
// doToken: string — @IsString, @IsNotEmpty, @MinLength(50)
//   (DO Personal Access Tokens are long strings starting with "dop_v1_")
// region: string — @IsString, @IsOptional, @IsIn(DO_REGIONS), default "nyc3"
// (DO_REGIONS constant: ['nyc1','nyc3','sfo3','ams3','sgp1','lon1','fra1','tor1','blr1','syd1'])
```

**`src/do-accounts/dto/do-account-response.dto.ts`**
```typescript
// Sanitized — NEVER includes doToken
// id, region, validatedAt, createdAt
```

**`src/do-accounts/do-accounts.controller.ts`**
```typescript
@Controller('do-accounts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('DO Accounts')
// POST /do-accounts — connect (validates immediately on create)
// GET /do-accounts — list all (no tokens)
// GET /do-accounts/:id — get one (no token)
// DELETE /do-accounts/:id — delete (check no deps)
// POST /do-accounts/:id/validate — re-validate token, update validatedAt
```

---

### PROJECTS MODULE — `src/projects/`

**`src/projects/projects.service.ts`**
```typescript
// create(userId, dto): Promise<Project>
//   - Create project
//   - Create TeamMember: { projectId, userId, role: 'OWNER' }
//   - Return project

// findAll(userId, query: PaginationQuery): Promise<{ data, total }>
//   - Where: userId = userId AND deletedAt IS NULL
//   - Include _count: { environments: true }

// findOne(id, userId): Promise<Project>
//   - Include: environments (deletedAt IS NULL), teamMembers with user
//   - Verify membership (owner or team member) — throw 403 if not

// update(id, userId, dto): Promise<Project>
//   - Verify OWNER or ADMIN role
//   - Allow: name, description only

// delete(id, userId): Promise<void>
//   - Verify OWNER only
//   - Soft delete (deletedAt = now())
```

**`src/projects/dto/create-project.dto.ts`**
```typescript
// name: @IsString, @IsNotEmpty, @MinLength(2), @MaxLength(40),
//   @Matches(/^[a-z0-9][a-z0-9-]*$/, 'Lowercase letters, numbers, hyphens only')
// description: @IsOptional, @IsString, @MaxLength(500)
```

**`src/projects/projects.controller.ts`**
```typescript
@Controller('projects')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('Projects')
// POST /projects
// GET /projects?page=1&limit=20
// GET /projects/:id
// PATCH /projects/:id
// DELETE /projects/:id
```

---

### ENVIRONMENTS MODULE — `src/environments/`

**`src/environments/environments.service.ts`**
```typescript
// create(projectId, userId, dto): Promise<Environment>
//   - Verify user is OWNER or ADMIN on project
//   - Verify doAccountId belongs to the user
//   - Check environment name unique within project
//   - Create environment

// findAll(projectId, userId): Promise<Environment[]>
//   - Verify project membership
//   - Include deployment count

// findOne(id, userId): Promise<Environment>
//   - Include: pulumiStack, most recent deployment

// update(id, userId, dto): Promise<Environment>
//   - Verify OWNER or ADMIN

// delete(id, userId): Promise<void>
//   - Verify OWNER
//   - Soft delete (does NOT destroy DO infrastructure — separate operation)

// updateConfig(id, userId, configYaml): Promise<Environment>
//   - safeParseLiftoffConfig() — throw 422 with errors if invalid
//   - Store raw YAML + parsed JSON
```

**`src/environments/dto/create-environment.dto.ts`**
```typescript
// name: @IsString, @IsNotEmpty, @MaxLength(40), @Matches(/^[a-z0-9-]+$/)
// gitBranch: @IsString, @IsNotEmpty, @MaxLength(100)
// doAccountId: @IsString, @IsNotEmpty
// serviceType: @IsEnum(['APP']), default 'APP'
```

**`src/environments/environments.controller.ts`**
```typescript
@Controller('projects/:projectId/environments')
// POST /projects/:pid/environments
// GET /projects/:pid/environments
// GET /projects/:pid/environments/:id
// PATCH /projects/:pid/environments/:id
// DELETE /projects/:pid/environments/:id
// PUT /projects/:pid/environments/:id/config
// POST /projects/:pid/environments/:id/config/validate (no DB write)
```

---

## Frontend — `apps/web/`

### Shared UI Components (shadcn/ui style)

Create in `components/ui/`:
- `button.tsx` — variants: default, destructive, outline, secondary, ghost, link; sizes: default, sm, lg
- `input.tsx`, `label.tsx`, `dialog.tsx`, `badge.tsx`, `card.tsx` (CardHeader/Content/Footer/Title/Description)
- `select.tsx`, `toast.tsx`, `toaster.tsx`, `spinner.tsx`
- `lib/utils.ts` — export `cn()` using clsx + tailwind-merge

### Layout Components

**`components/layout/sidebar.tsx`** — logo, nav items (Dashboard, Projects, Settings), user info + sign out at bottom

**`components/layout/header.tsx`** — page title + UserMenu (avatar dropdown)

### Pages

**`app/(dashboard)/dashboard/page.tsx`** — fetch projects, show EmptyState if none, ProjectGrid if any

**`app/(dashboard)/projects/page.tsx`** — projects list, "New Project" button → dialog, pagination

**`app/(dashboard)/projects/[id]/page.tsx`** — project detail: environments list (cards), "Add Environment" button

**`app/(dashboard)/projects/[id]/environments/[envId]/page.tsx`** — env detail: config section (show liftoff.yml), deployments list (empty for now), danger zone

**`app/(dashboard)/settings/page.tsx`** — profile section + DO Accounts section:
- List connected accounts with validation badge
- "Connect Account" form: doToken (password input), region select
- Validate + Delete buttons per account
- Danger zone: delete account

### TanStack Query Hooks

**`hooks/queries/use-do-accounts.ts`** — useDoAccounts, useCreateDoAccount (validates on create), useValidateDoAccount, useDeleteDoAccount

**`hooks/queries/use-projects.ts`** — useProjects, useProject, useCreateProject, useUpdateProject, useDeleteProject

**`hooks/queries/use-environments.ts`** — useEnvironments, useEnvironment, useCreateEnvironment, useUpdateEnvironment, useDeleteEnvironment, useUpdateConfig, useValidateConfig

---

## Phase 3 Acceptance Tests

```bash
pnpm --filter api test src/do-accounts/
pnpm --filter api test src/projects/
pnpm --filter api test src/environments/
pnpm typecheck

# Manual API tests:
TOKEN="..."

# Connect DO account (validates immediately)
curl -X POST http://localhost:4000/api/v1/do-accounts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"doToken":"dop_v1_REAL_TOKEN","region":"nyc3"}'
# Expected: 201 { id, region, validatedAt } (no doToken in response)

# Create project
curl -X POST http://localhost:4000/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"my-webapp"}'

# Create environment
curl -X POST "http://localhost:4000/api/v1/projects/PID/environments" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"production","gitBranch":"main","doAccountId":"ACCOUNT_ID"}'

# Validate config
curl -X POST ".../environments/EID/config/validate" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"configYaml":"version: \"1.0\"\nservice:\n  name: test\n  type: app\n  region: nyc3\nruntime:\n  port: 3000\nhealthcheck:\n  path: /health"}'
# Expected: { valid: true }
```

## Notes for Copilot

- **`doToken` must NEVER appear in any API response.** Create a response DTO that excludes it.
- The `create()` method validates the token immediately — users get instant feedback if their token is wrong
- The `getDecryptedToken()` method is internal only — never wire it to a controller endpoint
- `doAccountId` in the environment create DTO must belong to the requesting user — always verify this
- `serviceType` enum in Prisma is `APP` (uppercase) — the liftoff.yml uses `app` (lowercase). Map between them in the service.
- Config validation endpoint returns structured Zod errors so the frontend can highlight specific fields
