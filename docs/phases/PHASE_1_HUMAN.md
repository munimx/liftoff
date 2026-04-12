# Phase 1 — Monorepo Foundation
## Human Developer Guide

**Goal:** Get the skeleton monorepo running with both dev servers healthy.
**Exit criteria:** `GET http://localhost:4000/api/health` returns `{"status":"ok"}` and `http://localhost:3000` renders.

---

## Pre-flight Checklist

### 1. Install Tools

```bash
# Node.js 20 LTS
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install 20 && nvm use 20
node --version   # v20.x.x

# pnpm 9
npm install -g pnpm@9
pnpm --version   # 9.x.x

# Pulumi CLI
curl -fsSL https://get.pulumi.com | sh
pulumi version   # v3.x.x

# doctl (DigitalOcean CLI)
brew install doctl            # macOS
# Linux: https://docs.digitalocean.com/reference/doctl/how-to/install/
doctl version                 # doctl version 1.x.x

# GitHub CLI
brew install gh               # macOS
gh --version

# Docker Desktop — download from docker.com
docker --version              # 27.x.x
docker compose version        # v2.x.x
```

### 2. Create a DigitalOcean Account + API Token

1. Sign up at https://cloud.digitalocean.com
2. **API → Tokens → Generate New Token**
   - Name: `liftoff-platform`
   - Expiration: No expiry
   - Scopes: Full Access (read+write)
3. Copy the token (shown once only)

```bash
# Authenticate doctl
doctl auth init
# Paste your token when prompted

doctl account get
# Should print your email and account info
```

### 3. Create a DO Spaces Bucket (Pulumi State)

```bash
# Create bucket in your chosen region (nyc3 recommended)
doctl spaces create liftoff-pulumi-state --region nyc3

# Create a Spaces Access Key (separate from DO API token)
# DO Console → API → Spaces Keys → Generate New Key
# Name: liftoff-pulumi
# Save: Access Key and Secret Key
```

Verify access:
```bash
AWS_ACCESS_KEY_ID=YOUR_SPACES_KEY \
AWS_SECRET_ACCESS_KEY=YOUR_SPACES_SECRET \
  aws s3 ls \
    --endpoint-url https://nyc3.digitaloceanspaces.com \
    s3://liftoff-pulumi-state
# Returns empty list — that's fine, bucket is ready
```

### 4. Create a DO Container Registry

```bash
doctl registry create liftoff --region nyc3 --subscription-tier starter
doctl registry get
# Should show: liftoff  registry.digitalocean.com/liftoff  nyc3
```

### 5. Create a GitHub OAuth App

1. GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App**
2. Fill in:
   - Application name: `Liftoff (dev)`
   - Homepage URL: `http://localhost:3000`
   - Callback URL: `http://localhost:4000/api/auth/github/callback`
3. Register → copy **Client ID** + generate **Client Secret**

### 6. Create the Git Repository

```bash
mkdir liftoff && cd liftoff
git init && git checkout -b main
gh repo create liftoff --private --source=. --remote=origin
```

### 7. Generate Secrets

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 20)"
echo "PULUMI_PASSPHRASE=$(openssl rand -base64 24)"
```

### 8. Create Environment Files

**`apps/api/.env`**
```env
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000
WEBHOOK_BASE_URL=http://localhost:4000

DATABASE_URL=postgresql://liftoff:liftoff@localhost:5432/liftoff
REDIS_URL=redis://localhost:6379

JWT_SECRET=<from step 7>
JWT_REFRESH_SECRET=<from step 7>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

GITHUB_CLIENT_ID=<from step 5>
GITHUB_CLIENT_SECRET=<from step 5>
GITHUB_CALLBACK_URL=http://localhost:4000/api/auth/github/callback
GITHUB_WEBHOOK_SECRET=<from step 7>

DO_API_TOKEN=<your DO token from step 2>

DO_SPACES_ACCESS_KEY=<Spaces key from step 3>
DO_SPACES_SECRET_KEY=<Spaces secret from step 3>
DO_SPACES_BUCKET=liftoff-pulumi-state
DO_SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
DO_SPACES_REGION=nyc3

DOCR_NAME=liftoff

PULUMI_PASSPHRASE=<from step 7>
ENCRYPTION_KEY=<from step 7>

THROTTLE_TTL=60000
THROTTLE_LIMIT=100
```

**`apps/web/.env.local`**
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=http://localhost:4000
```

### 9. Start Docker Services

```bash
docker compose up -d
docker compose ps
# liftoff_postgres — healthy
# liftoff_redis    — healthy
```

---

## Hand Off to AI Agent

```
Read .github/copilot-instructions.md and docs/phases/PHASE_1_AI.md,
then build Phase 1 of the Liftoff project.
Everything runs on DigitalOcean. There is no AWS in this project.
```

---

## Verification

```bash
pnpm install            # no errors
pnpm typecheck          # zero errors
pnpm --filter api db:migrate

# Terminal 1
pnpm --filter api dev
# Prints: 🚀 Liftoff API running on http://localhost:4000/api
curl http://localhost:4000/api/health
# {"status":"ok","timestamp":"..."}
# Open http://localhost:4000/api/docs — Swagger UI loads

# Terminal 2
pnpm --filter web dev
# Open http://localhost:3000/login — renders without errors
```

---

## Common Issues

| Issue | Fix |
|-------|-----|
| `pnpm install` fails on shared package | `pnpm --filter shared build` first |
| Postgres refused | `docker compose up -d`, wait 15s |
| `ENCRYPTION_KEY must be 64 chars` | `openssl rand -hex 32` gives exactly 64 hex chars |
| `doctl auth init` fails | Check you pasted the full DO API token |
| Spaces bucket already exists | Use `doctl spaces list` — pick a unique name |
| DOCR create fails `already exists` | Registry is account-wide — `doctl registry get` to verify it exists |
