# Phases 6–9 — Deployment, Monitoring, Rollback, Production
## Combined Human + AI Reference

---

# PHASE 6 — Container Deployment

## Human: What to prepare

1. Ensure the test repo's GitHub Secrets include:
   - `DIGITALOCEAN_ACCESS_TOKEN` — the user's DO token with DOCR push access
   - `LIFTOFF_DEPLOY_SECRET` — copy from Liftoff environment settings after connecting the repo
2. Phase 5 infrastructure must have provisioned a DO App Platform app successfully
3. DOCR must be accessible: `doctl registry get` returns your registry

## Exit criteria
After `git push`, the Docker image is in DOCR and the App Platform app is serving traffic at its `ondigitalocean.app` URL.

---

## AI: What to build

### `src/do-api/do-api.service.ts` — add deployment methods

```typescript
// getApp(doToken, appId): Promise<DOApp>
//   GET https://api.digitalocean.com/v2/apps/{appId}
//   Returns full app spec including live_url, active_deployment

// updateApp(doToken, appId, appSpec): Promise<void>
//   PUT https://api.digitalocean.com/v2/apps/{appId}
//   Updates the app spec — triggers a new deployment on DO App Platform

// createDeployment(doToken, appId): Promise<string>
//   POST https://api.digitalocean.com/v2/apps/{appId}/deployments
//   Force a new deployment — returns deploymentId

// getDeployment(doToken, appId, deploymentId): Promise<DODeployment>
//   GET https://api.digitalocean.com/v2/apps/{appId}/deployments/{deploymentId}
//   Returns: { id, phase, created_at, updated_at, progress: { success_steps, total_steps } }

// getDeploymentLogs(doToken, appId, deploymentId): Promise<string>
//   GET https://api.digitalocean.com/v2/apps/{appId}/deployments/{deploymentId}/logs?type=RUN
//   Returns log content

// waitForDeployment(doToken, appId, deploymentId, timeoutMs): Promise<'ACTIVE'|'ERROR'|'TIMEOUT'>
//   Poll getDeployment() every 10 seconds
//   ACTIVE when phase == 'ACTIVE'
//   ERROR when phase == 'ERROR' or 'CANCELED' or 'FAILED'
//   TIMEOUT after timeoutMs
```

### `src/deployments/deployments.processor.ts`

```typescript
@Processor(QUEUE_NAMES.DEPLOYMENTS)
export class DeploymentProcessor {

  @Process(JOB_NAMES.DEPLOYMENTS.DEPLOY)
  async handleDeploy(job: Job<DeployJobPayload>) {
    // Called AFTER GitHub Actions has pushed image to DOCR
    // and called /webhooks/deploy-complete with imageUri

    // 1. Fetch environment + pulumiStack outputs (appId, appUrl) + doAccount
    // 2. Decrypt user DO token
    // 3. Update deployment: DEPLOYING + broadcast
    // 4. Build new app spec with updated image URI (same spec, new image tag)
    // 5. DoApiService.updateApp(doToken, appId, newSpec)
    //    — this triggers a new deployment on App Platform
    // 6. DoApiService.createDeployment(doToken, appId) to force if needed
    // 7. Poll: DoApiService.waitForDeployment(doToken, appId, doDeploymentId)
    //    — log progress via WebSocket
    // 8a. ACTIVE:
    //     - Update deployment: SUCCESS, endpoint = appUrl
    //     - Broadcast DEPLOYMENT_COMPLETE
    // 8b. ERROR or TIMEOUT:
    //     - Update deployment: FAILED
    //     - Queue ROLLBACK if previous deployment exists
  }

  @Process(JOB_NAMES.DEPLOYMENTS.ROLLBACK)
  async handleRollback(job: Job<RollbackJobPayload>) {
    // Fetch target deployment's imageUri
    // Update App Platform app spec with old imageUri
    // Wait for deployment to become ACTIVE
    // Update deployment: ROLLED_BACK or FAILED
  }
}
```

### `src/deployments/deployments.service.ts`

```typescript
// trigger(environmentId, userId, dto?): Promise<Deployment>
//   - Check no active deployment
//   - Create Deployment record PENDING
//   - Add to deployments queue

// findAll(environmentId, userId, query): Promise<{ data, total }>
// findOne(deploymentId, userId): Promise<Deployment>
// rollback(targetDeploymentId, userId): Promise<Deployment>
// getDeploymentLogs(deploymentId, userId): Promise<DeploymentLog[]>
```

**`src/deployments/deployments.controller.ts`**
```typescript
@Controller('environments/:environmentId/deployments')
// GET /
// GET /:id
// GET /:id/logs
// POST / — manual trigger
// POST /:id/rollback
// POST /:id/cancel — cancel QUEUED/PENDING
```

### Frontend additions

**`app/(dashboard)/projects/[id]/environments/[envId]/deployments/[deployId]/page.tsx`**
- Status badge with pulse animation for active states
- Progress steps: Build → Push → Provision → Deploy (DO App Platform)
- Real-time log viewer: WebSocket → join `deployment:{id}` room → render logs monospace
- Deployment metadata: commit SHA, branch, triggered by, duration
- Rollback button (SUCCESS status only, when previous deployments exist)

**`components/deployments/log-viewer.tsx`** — virtual list (react-window if >5k lines), level-colored, auto-scroll with pause toggle

---

# PHASE 7 — Monitoring & Logging

## Human: What to prepare

DO App Platform provides logs and basic metrics automatically — no additional setup needed.

## Exit criteria
Users can view live application logs from the DO App Platform in the Liftoff dashboard.

---

## AI: What to build

### `src/do-api/do-api.service.ts` — add monitoring methods

```typescript
// getAppLogs(doToken, appId, deploymentId?, type?): Promise<string[]>
//   GET /v2/apps/{appId}/logs?type={type}
//   type: 'BUILD' | 'DEPLOY' | 'RUN' | 'RUN_RESTARTED'
//   Returns array of log lines

// getLiveAppLogs(doToken, appId): AsyncGenerator<string>
//   Implements polling GET /v2/apps/{appId}/logs?type=RUN&follow=true
//   Or poll every 5 seconds and yield new lines
//   Stop on AbortSignal

// getAppMetrics(doToken, appId): Promise<AppMetrics>
//   GET /v2/monitoring/metrics/apps/memory_percentage or /cpu_percentage
//   Returns: { data: { result: [{ values: [[timestamp, value]] }] } }
//   DO monitoring uses Prometheus format
```

### `src/monitoring/monitoring.service.ts`

```typescript
// getLogs(environmentId, userId, query): Promise<{ lines: string[], type: string }>
//   - Verify access
//   - Get appId from PulumiStack outputs
//   - Decrypt user DO token
//   - Fetch via DoApiService.getAppLogs()

// getMetrics(environmentId, userId, metricType): Promise<MetricDatapoint[]>
//   - metricType: 'cpu' | 'memory' | 'bandwidth'
//   - DO monitoring endpoints:
//     /v2/monitoring/metrics/apps/cpu_percentage
//     /v2/monitoring/metrics/apps/memory_percentage
//     /v2/monitoring/metrics/apps/network_bandwidth

// streamLogs(environmentId, userId, socket): Promise<void>
//   - DoApiService.getLiveAppLogs()
//   - For each line: socket.emit('log-line', { line, timestamp })
//   - Stop on socket disconnect
```

### `src/monitoring/monitoring.controller.ts`

```typescript
@Controller('environments/:environmentId')
// GET /logs?type=RUN&limit=200
// GET /metrics/cpu
// GET /metrics/memory
// GET /metrics/bandwidth
// POST /alerts — create DO monitoring alert (POST /v2/monitoring/alerts)
// GET /alerts
// DELETE /alerts/:id
```

### WebSocket log streaming

Add to EventsGateway:
```typescript
@SubscribeMessage('start:log-stream')
async handleStartLogStream(client, { environmentId }) {
  // Verify userId from client.data
  // Start DoApiService.getLiveAppLogs() in background
  // Emit each line via socket.emit('log-line', line)
  // Track streams per socket, abort on disconnect
}
```

### Frontend

**`app/(dashboard)/projects/[id]/environments/[envId]/logs/page.tsx`**
- Log type tabs: Build / Deploy / Run / Run (restarted)
- Search/filter input
- Log display: monospace, timestamp, message
- "Live tail" toggle → WebSocket mode
- Export as .txt

**`app/(dashboard)/projects/[id]/environments/[envId]/metrics/page.tsx`**
- CPU % line chart (recharts LineChart)
- Memory % line chart
- Network bandwidth chart
- Auto-refresh every 60s

---

# PHASE 8 — Rollback & Deployment Management

## Exit criteria
Clicking "Rollback" on a deployment restores the previous App Platform deployment within 3 minutes.

---

## AI: What to build

Rollback is already scaffolded in Phase 6. Phase 8 adds the history UI and refines the rollback flow.

### Enhanced rollback flow

DO App Platform keeps its own deployment history. To roll back:
1. Find the target Liftoff Deployment record (status = SUCCESS, has imageUri)
2. Update the App Platform app spec with the old imageUri
3. Trigger a new DO App Platform deployment
4. Wait for ACTIVE status
5. Update Liftoff Deployment record: ROLLED_BACK

```typescript
// In deployments.service.ts
// rollback(targetDeploymentId, userId): Promise<Deployment>
//   - target must have status SUCCESS and non-null imageUri
//   - Check no active deployment running
//   - Create new Deployment { imageUri: target.imageUri, commitSha: target.commitSha,
//       triggeredBy: userId, commitMessage: `Rollback to ${sha.slice(0,7)}`, status: PENDING }
//   - Queue ROLLBACK job { deploymentId: newId, targetDeploymentId }
```

### Deployment history page

**`app/(dashboard)/projects/[id]/environments/[envId]/history/page.tsx`**
- Table: status badge, commit SHA (truncated, linked to GitHub), branch, triggered by, duration, timestamp
- Status icons: ✓ SUCCESS, ✗ FAILED, ↩ ROLLED_BACK, ⟳ active (animated)
- Per row: "View Logs" link, "Rollback to this version" button (only for SUCCESS)
- Rollback confirmation dialog: "Deploy image from commit {sha}? Current deployment will be replaced."
- Pagination: 20 per page

---

# PHASE 9 — Polish & Production

## Human: What to prepare

1. **DO account** with billing enabled and appropriate resource limits
2. **DO Container Registry** already created: `doctl registry create liftoff --region nyc3`
3. **Domain name** added to DO: Networking → Domains
4. **GitHub OAuth App for production** — separate from local dev. Callback URL: `https://api.yourdomain.com/api/auth/github/callback`
5. **Pulumi configured** for DO Spaces backend — see docs/DIGITALOCEAN_SETUP.md

## Exit criteria
Liftoff platform deployed to DO App Platform. Accessible at custom domain over HTTPS. Managed PostgreSQL + Redis attached.

---

## AI: What to build

### Dockerfiles

**`apps/api/Dockerfile`** — multi-stage, monorepo-aware:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile
COPY packages/ packages/
COPY apps/api/ apps/api/
RUN pnpm --filter shared build
RUN pnpm --filter api build

FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm
COPY --from=builder /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/main"]
```

**`apps/web/Dockerfile`** — standalone Next.js build:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ packages/
COPY apps/web/ apps/web/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter shared build
RUN pnpm --filter web build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

Add `output: 'standalone'` to `apps/web/next.config.js`.

---

### Platform Infrastructure — `infra/`

Pulumi program that deploys the **Liftoff platform itself** to DigitalOcean. Uses `@pulumi/digitalocean` only.

**`infra/package.json`**:
```json
{
  "name": "@liftoff/infra",
  "private": true,
  "dependencies": {
    "@pulumi/digitalocean": "^4.29.0",
    "@pulumi/pulumi": "^3.130.0"
  },
  "devDependencies": { "typescript": "^5.5.4" }
}
```

**`infra/Pulumi.yaml`**:
```yaml
name: liftoff-platform
runtime: nodejs
description: Liftoff platform infrastructure on DigitalOcean
```

**`infra/index.ts`**:
```typescript
import * as digitalocean from '@pulumi/digitalocean';
import * as pulumi from '@pulumi/pulumi';

const config = new pulumi.Config();
const region = config.get('region') ?? 'nyc3';

// 1. Managed PostgreSQL for Liftoff's own database
const postgres = new digitalocean.DatabaseCluster('liftoff-postgres', {
  name: 'liftoff-platform-db',
  engine: 'pg', version: '15',
  size: 'db-s-1vcpu-1gb', region, nodeCount: 1,
  tags: ['liftoff-platform'],
});

// 2. Managed Redis for BullMQ + sessions
const redis = new digitalocean.DatabaseCluster('liftoff-redis', {
  name: 'liftoff-platform-redis',
  engine: 'redis', version: '7',
  size: 'db-s-1vcpu-1gb', region, nodeCount: 1,
  tags: ['liftoff-platform'],
});

// 3. App Platform — API + Web from DOCR
const app = new digitalocean.App('liftoff-platform-app', {
  spec: {
    name: 'liftoff',
    region,
    services: [
      {
        name: 'api',
        image: {
          registry: 'liftoff', registryType: 'DOCR',
          repository: 'api', tag: 'latest',
          deployOnPush: [{ enabled: true }],
        },
        httpPort: 4000,
        instanceCount: 2,
        instanceSizeSlug: 'apps-s-1vcpu-1gb',
        routes: [{ path: '/api' }],
        healthCheck: { httpPath: '/api/health' },
        envs: [
          { key: 'NODE_ENV', value: 'production', scope: 'RUN_TIME' },
          { key: 'JWT_SECRET', value: config.requireSecret('jwtSecret'), type: 'SECRET', scope: 'RUN_TIME' },
          { key: 'JWT_REFRESH_SECRET', value: config.requireSecret('jwtRefreshSecret'), type: 'SECRET', scope: 'RUN_TIME' },
          { key: 'ENCRYPTION_KEY', value: config.requireSecret('encryptionKey'), type: 'SECRET', scope: 'RUN_TIME' },
          { key: 'GITHUB_CLIENT_ID', value: config.require('githubClientId'), scope: 'RUN_TIME' },
          { key: 'GITHUB_CLIENT_SECRET', value: config.requireSecret('githubClientSecret'), type: 'SECRET', scope: 'RUN_TIME' },
          { key: 'GITHUB_CALLBACK_URL', value: config.require('githubCallbackUrl'), scope: 'RUN_TIME' },
          { key: 'GITHUB_WEBHOOK_SECRET', value: config.requireSecret('githubWebhookSecret'), type: 'SECRET', scope: 'RUN_TIME' },
          { key: 'FRONTEND_URL', value: config.require('frontendUrl'), scope: 'RUN_TIME' },
          { key: 'WEBHOOK_BASE_URL', value: config.require('apiUrl'), scope: 'RUN_TIME' },
          { key: 'DO_API_TOKEN', value: config.requireSecret('doApiToken'), type: 'SECRET', scope: 'RUN_TIME' },
          { key: 'DO_SPACES_ACCESS_KEY', value: config.requireSecret('spacesAccessKey'), type: 'SECRET', scope: 'RUN_TIME' },
          { key: 'DO_SPACES_SECRET_KEY', value: config.requireSecret('spacesSecretKey'), type: 'SECRET', scope: 'RUN_TIME' },
          { key: 'DO_SPACES_BUCKET', value: config.require('spacesBucket'), scope: 'RUN_TIME' },
          { key: 'DO_SPACES_ENDPOINT', value: config.require('spacesEndpoint'), scope: 'RUN_TIME' },
          { key: 'DO_SPACES_REGION', value: config.require('spacesRegion'), scope: 'RUN_TIME' },
          { key: 'DOCR_NAME', value: config.require('docrName'), scope: 'RUN_TIME' },
          { key: 'PULUMI_PASSPHRASE', value: config.requireSecret('pulumiPassphrase'), type: 'SECRET', scope: 'RUN_TIME' },
        ],
      },
      {
        name: 'web',
        image: {
          registry: 'liftoff', registryType: 'DOCR',
          repository: 'web', tag: 'latest',
          deployOnPush: [{ enabled: true }],
        },
        httpPort: 3000,
        instanceCount: 1,
        instanceSizeSlug: 'apps-s-1vcpu-0.5gb',
        routes: [{ path: '/' }],
        envs: [
          { key: 'NEXT_PUBLIC_API_URL', value: config.require('apiUrl'), scope: 'RUN_AND_BUILD_TIME' },
          { key: 'NEXT_PUBLIC_WS_URL', value: config.require('apiUrl'), scope: 'RUN_AND_BUILD_TIME' },
        ],
      },
    ],
    databases: [
      { clusterName: postgres.name, dbName: 'liftoff', dbUser: 'liftoff', engine: 'PG', name: 'liftoff-db' },
      { clusterName: redis.name, engine: 'REDIS', name: 'liftoff-redis' },
    ],
  },
});

export const appLiveUrl = app.liveUrl;
export const postgresHost = postgres.host;
```

**`infra/Pulumi.production.yaml`** — non-secret config values:
```yaml
config:
  liftoff-platform:region: nyc3
  liftoff-platform:spacesBucket: liftoff-pulumi-state
  liftoff-platform:spacesEndpoint: https://nyc3.digitaloceanspaces.com
  liftoff-platform:spacesRegion: nyc3
  liftoff-platform:docrName: liftoff
```

Set secrets via `pulumi config set --secret`:
```bash
pulumi config set --secret jwtSecret $(openssl rand -hex 32)
pulumi config set --secret jwtRefreshSecret $(openssl rand -hex 32)
pulumi config set --secret encryptionKey $(openssl rand -hex 32)
pulumi config set --secret githubClientSecret YOUR_SECRET
# ... etc
```

---

### GitHub Actions — Platform CI/CD

**`.github/workflows/deploy-platform.yml`**:
```yaml
name: Deploy Liftoff Platform to DigitalOcean

on:
  push:
    branches: [main]
    paths:
      - 'apps/api/**'
      - 'apps/web/**'
      - 'packages/**'

env:
  REGISTRY: registry.digitalocean.com/liftoff

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install doctl
        uses: digitalocean/action-doctl@v2
        with:
          token: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}

      - name: Log in to DOCR
        run: doctl registry login --expiry-seconds 1200

      - name: Build and push API
        run: |
          docker build -f apps/api/Dockerfile \
            -t $REGISTRY/api:${{ github.sha }} \
            -t $REGISTRY/api:latest \
            .
          docker push $REGISTRY/api:${{ github.sha }}
          docker push $REGISTRY/api:latest

      - name: Build and push Web
        run: |
          docker build -f apps/web/Dockerfile \
            --build-arg NEXT_PUBLIC_API_URL=${{ secrets.NEXT_PUBLIC_API_URL }} \
            --build-arg NEXT_PUBLIC_WS_URL=${{ secrets.NEXT_PUBLIC_API_URL }} \
            -t $REGISTRY/web:${{ github.sha }} \
            -t $REGISTRY/web:latest \
            .
          docker push $REGISTRY/web:${{ github.sha }}
          docker push $REGISTRY/web:latest

      - name: Trigger App Platform deploy
        run: doctl apps create-deployment ${{ secrets.DO_APP_ID }}
```

**GitHub Secrets required:**
- `DIGITALOCEAN_ACCESS_TOKEN` — Liftoff's DO API token
- `DO_APP_ID` — get from `doctl apps list` after first deploy
- `NEXT_PUBLIC_API_URL` — e.g., `https://api.liftoff.dev`

---

### Security Hardening

**`src/common/guards/throttler.guard.ts`** — skip `/webhooks/*` routes (they use HMAC auth)

Tighter limits for specific endpoints:
- Auth endpoints: 5 req/min per IP
- Deployment trigger: 10 req/min per user

### Health Check Enhancement

```typescript
// GET /health — fast (always 200 if server running)
// GET /health/detailed — check DB + Redis
//   Returns: { status, database: 'ok'|'error', redis: 'ok'|'error', timestamp }
//   App Platform health check uses /health (fast version)
```

### Playwright E2E Tests

**`tests/e2e/auth.spec.ts`** — can navigate to login, login button redirects to GitHub, auth user sees dashboard, unauth user redirected

**`tests/e2e/projects.spec.ts`** — can create project, appears in list, can delete

**`tests/e2e/do-accounts.spec.ts`** — can connect DO account, validation badge appears, can delete

---

## Phase 9 Acceptance Tests

```bash
# All unit tests
pnpm test   # >80% API coverage

# E2E
pnpm test:e2e

# Docker builds
docker build -f apps/api/Dockerfile -t liftoff-api:test .
docker build -f apps/web/Dockerfile -t liftoff-web:test .

# Test API image
docker run --rm \
  -e DATABASE_URL=postgresql://liftoff:liftoff@host.docker.internal:5432/liftoff \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  -e JWT_SECRET=testsecretatleast32characterslongfortesting \
  -e JWT_REFRESH_SECRET=testrefreshatleast32characterslongtest \
  -e ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000 \
  -e GITHUB_CLIENT_ID=test -e GITHUB_CLIENT_SECRET=test \
  -e GITHUB_CALLBACK_URL=http://localhost:4000/api/auth/github/callback \
  -e GITHUB_WEBHOOK_SECRET=test \
  -e FRONTEND_URL=http://localhost:3000 \
  -e WEBHOOK_BASE_URL=http://localhost:4000 \
  -e DO_API_TOKEN=test \
  -e DO_SPACES_ACCESS_KEY=test -e DO_SPACES_SECRET_KEY=test \
  -e DO_SPACES_BUCKET=test -e DO_SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com \
  -e DO_SPACES_REGION=nyc3 -e DOCR_NAME=liftoff -e PULUMI_PASSPHRASE=test \
  -p 4000:4000 liftoff-api:test
curl http://localhost:4000/api/health   # {"status":"ok"}

# TypeScript
pnpm typecheck   # zero errors

# Security
pnpm audit --audit-level=high   # no high/critical

# Production deploy
cd infra && pulumi stack select production && pulumi up
```

---

## Final Checklist Before Public Launch

- [ ] All 9 phases pass their exit criteria
- [ ] `pnpm test` green, >80% API coverage
- [ ] `pnpm typecheck` zero errors (no AWS imports found)
- [ ] `pnpm lint` zero errors
- [ ] `grep -r "@aws-sdk\|@pulumi/aws\|@pulumi/awsx" apps/ packages/` returns **empty** (no AWS anywhere)
- [ ] Docker builds for both apps succeed locally
- [ ] Images pushed to DOCR: `registry.digitalocean.com/liftoff/api` + `.../web`
- [ ] App Platform app running — health check green in DO console
- [ ] Managed PostgreSQL attached — migrations applied
- [ ] Managed Redis attached — BullMQ queues functional
- [ ] Custom domain configured (DO App Platform → Domains)
- [ ] GitHub OAuth App production callback URL updated
- [ ] All secrets set as SECRET type in App Platform env vars (not GENERAL)
- [ ] `PULUMI_PASSPHRASE` in App Platform env — never in git
- [ ] User DO token encrypted in DB — verified by checking raw DB value is not a valid DO token
- [ ] DO Spaces bucket versioning enabled (for state file recovery)
- [ ] At least 3 end-to-end test deployments of a real app into a test DO account
- [ ] `docs/DO_ACCOUNT_SETUP.md` accurate and tested by a fresh user
- [ ] `docs/LIFTOFF_YML.md` schema reference complete and accurate
