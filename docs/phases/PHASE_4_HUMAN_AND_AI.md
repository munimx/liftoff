# Phase 4 — GitHub Integration
## Human Developer Guide + AI Instructions

---

# PART A: Human Developer Guide

**Prerequisite:** Phase 3 complete. Projects and Environments CRUD works.
**Goal:** Connect a GitHub repo; webhook fires on push; liftoff.yml is committed; workflow pushes to DOCR.
**Exit criteria:** Pushing to the connected branch triggers a webhook that Liftoff receives and creates a deployment record.

---

## Pre-flight Checklist

### 1. Verify GitHub Token Scopes

The GitHub OAuth token stored during login must have the required scopes for repo + webhook + workflow management. Verify by re-logging in (the scopes are requested in the Passport strategy).

```bash
# After logging in, check token has repo scope
curl -I -H "Authorization: Bearer YOUR_GITHUB_TOKEN" \
  https://api.github.com/user/repos
# Look for: X-OAuth-Scopes: repo, read:user, write:repo_hook, workflow
```

### 2. Create a Test Repository

```bash
gh repo create liftoff-test-app --public --clone
cd liftoff-test-app

cat > Dockerfile << 'DEOF'
FROM node:20-alpine
WORKDIR /app
RUN echo "const http=require('http');http.createServer((_,r)=>{r.writeHead(200);r.end(JSON.stringify({status:'ok'}))}).listen(3000)" > index.js
CMD ["node", "index.js"]
DEOF

cat > liftoff.yml << 'LEOF'
version: "1.0"
service:
  name: test-app
  type: app
  region: nyc3
runtime:
  instance_size: apps-s-1vcpu-0.5gb
  port: 3000
healthcheck:
  path: /
LEOF

git add . && git commit -m "initial commit" && git push origin main
echo "Repo URL: $(gh repo view --json url -q .url)"
```

### 3. Expose Local API for Webhooks (ngrok)

```bash
# Install ngrok: https://ngrok.com/download
ngrok config add-authtoken YOUR_NGROK_TOKEN
ngrok http 4000
# Note the HTTPS URL, e.g.: https://abc123.ngrok-free.app

# Update apps/api/.env:
# WEBHOOK_BASE_URL=https://abc123.ngrok-free.app
# Restart the API after this change
```

### 4. DOCR Login (so AI can reference the correct image URI format)

```bash
doctl registry login
# Docker is now authenticated to registry.digitalocean.com

# Image URI format for user repos:
# registry.digitalocean.com/DOCR_NAME/PROJECT/ENV:COMMIT_SHA
# Example: registry.digitalocean.com/liftoff/my-webapp/production:abc1234
```

---

## Verification

```bash
TOKEN="..."
PROJECT_ID="..."

# 1. List available GitHub repos
curl "http://localhost:4000/api/v1/projects/${PROJECT_ID}/repository/available" \
  -H "Authorization: Bearer $TOKEN"
# Expected: array of { id, name, fullName, defaultBranch }

# 2. Connect repository
curl -X POST "http://localhost:4000/api/v1/projects/${PROJECT_ID}/repository" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"githubRepoId":12345678,"fullName":"your-username/liftoff-test-app","branch":"main"}'
# Expected: 201 { id, fullName, webhookId, ... }

# 3. Verify webhook in GitHub
gh api /repos/your-username/liftoff-test-app/hooks
# Shows a hook pointing to your ngrok URL

# 4. Verify workflow was committed to the repo
gh api /repos/your-username/liftoff-test-app/contents/.github/workflows/liftoff-deploy.yml
# Returns file content

# 5. Trigger webhook by pushing
cd liftoff-test-app && echo "test" >> README.md
git add . && git commit -m "trigger webhook" && git push

# 6. Check API logs — "Webhook received from your-username/liftoff-test-app"
# 7. Check DB — a Deployment record created with status QUEUED
```

---

# PART B: GitHub Copilot CLI Instructions

**Read `.github/copilot-instructions.md` before this section. No AWS.**
**Phases 1–3 are complete.**

---

## Objective

1. GitHub API service (list repos, create/delete webhooks, commit files)
2. Repository connection flow
3. Webhook receiver (verify HMAC → create Deployment → queue job)
4. GitHub Actions workflow template generator (DOCR, not ECR)
5. Frontend: repository connection UI

---

## Backend — `apps/api/src/`

### `src/repositories/github.service.ts`

Uses `@nestjs/axios` (HttpService). Base URL: `https://api.github.com`. All calls use the user's GitHub token (decrypted from User.githubToken via EncryptionService).

```typescript
@Injectable()
export class GitHubService {

  // listRepositories(githubToken): Promise<GitHubRepo[]>
  //   GET /user/repos?sort=updated&per_page=100&type=all
  //   Map to: { id, name, fullName, private, defaultBranch, cloneUrl, htmlUrl }

  // getRepository(githubToken, fullName): Promise<GitHubRepo>
  //   GET /repos/{fullName}

  // createWebhook(githubToken, fullName, webhookUrl, secret): Promise<number>
  //   POST /repos/{fullName}/hooks
  //   Body: { name: 'web', active: true, events: ['push', 'pull_request'],
  //            config: { url: webhookUrl, content_type: 'json', secret } }
  //   Returns: hook id (integer)

  // deleteWebhook(githubToken, fullName, hookId): Promise<void>
  //   DELETE /repos/{fullName}/hooks/{hookId}

  // commitFile(githubToken, fullName, path, content, message, branch): Promise<void>
  //   GET /repos/{fullName}/contents/{path} → get sha if exists
  //   PUT /repos/{fullName}/contents/{path}
  //   content must be base64 encoded: Buffer.from(content).toString('base64')

  // verifyWebhookSignature(payload: Buffer, signature: string, secret: string): boolean
  //   HMAC-SHA256 using crypto.createHmac('sha256', secret).update(payload).digest('hex')
  //   Compare with crypto.timingSafeEqual() against signature (strip "sha256=" prefix)
  //   NEVER use === for signature comparison
}
```

### `src/repositories/workflow-generator.service.ts`

Generates the `.github/workflows/liftoff-deploy.yml` content for the user's repo.

```typescript
interface GenerateWorkflowConfig {
  projectName: string;
  environmentId: string;
  branch: string;
  docrName: string;        // DO Container Registry name (from DOCR_NAME env var)
  imageRepository: string; // path within DOCR, e.g. "my-webapp/production"
  liftoffApiUrl: string;
}
```

Generated YAML must:
```yaml
name: Liftoff Deploy

on:
  push:
    branches: [BRANCH]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install doctl
        uses: digitalocean/action-doctl@v2
        with:
          token: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}

      - name: Log in to DigitalOcean Container Registry
        run: doctl registry login --expiry-seconds 1200

      - name: Build and push Docker image
        env:
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build \
            -t registry.digitalocean.com/DOCR_NAME/IMAGE_REPO:$IMAGE_TAG \
            .
          docker push registry.digitalocean.com/DOCR_NAME/IMAGE_REPO:$IMAGE_TAG

      - name: Notify Liftoff
        env:
          IMAGE_TAG: ${{ github.sha }}
        run: |
          curl -X POST LIFTOFF_API_URL/api/v1/webhooks/deploy-complete \
            -H "X-Liftoff-Secret: ${{ secrets.LIFTOFF_DEPLOY_SECRET }}" \
            -H "Content-Type: application/json" \
            -d "{\"environmentId\":\"ENV_ID\",\"imageUri\":\"registry.digitalocean.com/DOCR_NAME/IMAGE_REPO:$IMAGE_TAG\",\"commitSha\":\"$GITHUB_SHA\"}"
```

**Required GitHub Secrets** (list these in the workflow commit message for the user):
- `DIGITALOCEAN_ACCESS_TOKEN` — user's DO token (read access to DOCR is enough for push; write access to push images)
- `LIFTOFF_DEPLOY_SECRET` — generated by Liftoff per environment, stored encrypted in DB

### `src/repositories/repositories.service.ts`

```typescript
// connect(projectId, userId, dto): Promise<Repository>
//   1. Verify OWNER/ADMIN on project
//   2. Check no repo already connected (one per project)
//   3. Get user's GitHub token (decrypt from User.githubToken)
//   4. Verify repo access via GitHubService.getRepository()
//   5. webhookSecret = crypto.randomBytes(20).toString('hex')
//   6. liftoffDeploySecret = crypto.randomBytes(20).toString('hex') (for deploy-complete endpoint)
//   7. webhookUrl = `${WEBHOOK_BASE_URL}/api/v1/webhooks/github`
//   8. Create webhook via GitHubService.createWebhook()
//   9. Save Repository (encrypt webhookSecret)
//  10. Image repo path: `${projectName}/${environmentName}` for each environment
//  11. Generate workflow via WorkflowGeneratorService (use DOCR_NAME from config)
//  12. Commit to .github/workflows/liftoff-deploy.yml via GitHubService.commitFile()

// disconnect(projectId, userId): Promise<void>
//   - Delete GitHub webhook (idempotent — don't throw if already gone)
//   - Delete Repository record

// listAvailable(projectId, userId): Promise<GitHubRepo[]>
//   - Get user's GitHub token, list repos

// findByProject(projectId, userId): Promise<Repository | null>
```

**`src/repositories/repositories.controller.ts`**
```typescript
@Controller('projects/:projectId/repository')
// GET /available — list user's GitHub repos
// GET / — get connected repo (or 404)
// POST / — connect repo
// DELETE / — disconnect
```

**`src/repositories/repositories.module.ts`** — provides GitHubService, WorkflowGeneratorService, RepositoriesService, RepositoriesController

### `src/webhooks/webhooks.service.ts`

```typescript
// handleGitHubPush(payload: GitHubPushPayload, signature, rawBody): Promise<void>
//   1. Find Repository by payload.repository.full_name
//   2. Decrypt webhookSecret
//   3. Verify HMAC — throw 401 AppException if invalid
//   4. Extract branch: payload.ref.replace('refs/heads/', '')
//   5. Find Environment where gitBranch = branch AND deletedAt IS NULL
//   6. If no matching env: log and return (not an error)
//   7. Check no ACTIVE deployment (ACTIVE_STATUSES) for this environment
//   8. Create Deployment { environmentId, status: PENDING, commitSha, commitMessage, branch, triggeredBy: 'webhook' }
//   9. Add to deployments queue: { deploymentId, environmentId, commitSha }
//  10. Return immediately (respond fast)

// handleDeployComplete(body, secret): Promise<void>
//   - body: { environmentId, imageUri, commitSha }
//   - Verify X-Liftoff-Secret header matches per-environment liftoffDeploySecret
//   - Find Deployment for this environment with status PUSHING
//   - Update: imageUri, status = PROVISIONING
//   - Add to infrastructure queue: { deploymentId, environmentId, imageUri, configYaml }
```

**`src/webhooks/webhooks.controller.ts`**
```typescript
@Controller('webhooks')
export class WebhooksController {
  // POST /webhooks/github — @Public(), use raw body for HMAC
  //   Extract X-Hub-Signature-256 header
  //   Pass rawBody Buffer to service
  //   Return 200 fast

  // POST /webhooks/deploy-complete — @Public()
  //   Extract X-Liftoff-Secret header
  //   Pass body to service
  //   Return 200
}
```

**Raw body setup in `main.ts`:**
```typescript
// Before the global JSON parser, add raw body preservation for webhooks
app.use('/api/v1/webhooks/github', express.raw({ type: 'application/json' }));
```

---

## Frontend — `apps/web/`

**`app/(dashboard)/projects/[id]/repository/page.tsx`**
- Not connected: "Connect Repository" panel
  - GitHub repo dropdown (fetched from `/repository/available`)
  - Branch text input
  - Connect button
  - Info box: "Liftoff will create a webhook and commit a GitHub Actions workflow to your repo. Add your DO token as `DIGITALOCEAN_ACCESS_TOKEN` in GitHub Secrets."
- Connected: show repo name, branch, webhook status badge, "View Workflow" link, "Disconnect" button

**`hooks/queries/use-repositories.ts`** — useAvailableRepos, useConnectedRepo, useConnectRepo, useDisconnectRepo

---

## Phase 4 Acceptance Tests

```bash
pnpm --filter api test src/repositories/
pnpm --filter api test src/webhooks/
pnpm typecheck

# Manual (see human guide for ngrok setup):
# 1. List repos → your GitHub repos appear
# 2. Connect repo → webhook appears in GitHub → workflow file committed
# 3. Push to connected branch → API logs show webhook received
# 4. DB: Deployment record with status QUEUED
```

## Notes for Copilot

- **NEVER use === for HMAC comparison** — use `crypto.timingSafeEqual()`
- Image URI format for DOCR: `registry.digitalocean.com/{DOCR_NAME}/{projectName}/{envName}:{sha}`
- The generated workflow uses `digitalocean/action-doctl@v2` — not any AWS action
- `DOCR_NAME` comes from the `DOCR_NAME` env var on the Liftoff API — inject it into WorkflowGeneratorService via ConfigService
- The `connect()` flow is transactional — if webhook creation succeeds but DB save fails, delete the webhook in the catch block
- The `liftoffDeploySecret` (for the deploy-complete endpoint) is different from `webhookSecret` (for GitHub push events) — store both, encrypted
- Webhook must respond within 10 seconds — queue everything, do nothing heavy in the handler
