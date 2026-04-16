# Liftoff — Environment Variables Reference

**Everything is DigitalOcean. There are no AWS variables in this project.**

---

## `apps/api/.env`

Copy from `apps/api/.env.example` then fill in each value.

### Application

| Variable | Local example | Description |
|----------|-------------|-------------|
| `NODE_ENV` | `development` | `development` \| `production` \| `test` |
| `PORT` | `4000` | NestJS listen port |
| `FRONTEND_URL` | `http://localhost:3000` | Used for CORS + OAuth redirects |
| `API_PREFIX` | `api` | URL prefix (default: `api`) |
| `WEBHOOK_BASE_URL` | `https://abc.ngrok-free.app` | Public URL for GitHub webhook delivery. ngrok locally; App Platform URL in production. |

### Database — DO Managed PostgreSQL

| Variable | Local | Production |
|----------|-------|-----------|
| `DATABASE_URL` | `postgresql://liftoff:liftoff@localhost:5432/liftoff` | `postgresql://doadmin:...@db-xxx.db.ondigitalocean.com:25060/liftoff?sslmode=require` |

Copy production value from: DO Console → Database → Connection Details → URI.

### Cache / Queue — DO Managed Redis

| Variable | Local | Production |
|----------|-------|-----------|
| `REDIS_URL` | `redis://localhost:6379` | `rediss://default:...@redis-xxx.db.ondigitalocean.com:25061` |

Production uses `rediss://` (TLS). ioredis handles this from the URL scheme automatically.

### Authentication

| Variable | Example | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `<64 hex chars>` | Signs access tokens. `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | `<64 hex chars>` | Signs refresh tokens. Must differ from above. |
| `JWT_EXPIRES_IN` | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token TTL |
| `GITHUB_CLIENT_ID` | `Ov23liXXXXX` | From GitHub OAuth App |
| `GITHUB_CLIENT_SECRET` | `<40 chars>` | From GitHub OAuth App |
| `GITHUB_CALLBACK_URL` | `http://localhost:4000/api/auth/github/callback` | Must match GitHub App settings exactly |
| `GITHUB_WEBHOOK_SECRET` | `<40 hex chars>` | HMAC secret for GitHub webhooks. `openssl rand -hex 20` |

### DigitalOcean — Platform API Token

This is Liftoff's own DO account token. Used to manage platform-level DO resources (e.g., validating that a DOCR registry exists, managing the platform registry).

| Variable | Example | Description |
|----------|---------|-------------|
| `DO_API_TOKEN` | `dop_v1_XXXXXXXXX` | Liftoff's own DO Personal Access Token. Create at: DO Console → API → Tokens → Generate New Token (read+write). |

### DigitalOcean Spaces — Pulumi State Backend

DO Spaces is S3-compatible object storage. Pulumi uses it to store infrastructure state files using the S3 backend protocol.

| Variable | Example | Description |
|----------|---------|-------------|
| `DO_SPACES_ACCESS_KEY` | `DO00XXXXXXXX` | Spaces access key (NOT the same as `DO_API_TOKEN`). Create at: DO Console → API → Spaces Keys → Generate New Key. |
| `DO_SPACES_SECRET_KEY` | `<secret>` | Spaces secret key (shown once on creation) |
| `DO_SPACES_BUCKET` | `liftoff-pulumi-state` | Spaces bucket name for Pulumi state |
| `DO_SPACES_ENDPOINT` | `https://nyc3.digitaloceanspaces.com` | Spaces regional endpoint |
| `DO_SPACES_REGION` | `nyc3` | Spaces region (`nyc3`, `sfo3`, `ams3`, `sgp1`, `fra1`) |

> **Why Spaces keys are separate from the DO API token:** DO API tokens and Spaces access keys are different credential types. The API token controls your account via the REST API. Spaces keys are S3-compatible credentials scoped only to object storage. Pulumi's S3 state backend uses the S3 protocol, so it needs Spaces keys — not the API token.

### Pulumi

| Variable | Example | Description |
|----------|---------|-------------|
| `PULUMI_PASSPHRASE` | `<random string>` | Encrypts secrets within Pulumi state files. `openssl rand -base64 24` |

### DigitalOcean Container Registry

Container registry names for user deployments are provisioned automatically per user account (`liftoff-{randomHex}`) and do not require a static env var.

### Encryption

| Variable | Example | Description |
|----------|---------|-------------|
| `ENCRYPTION_KEY` | `<64 hex chars>` | AES-256 key for encrypting user DO tokens + webhook secrets in DB. `openssl rand -hex 32` |

### Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `THROTTLE_TTL` | `60000` | Window in ms (60 seconds) |
| `THROTTLE_LIMIT` | `100` | Max requests per window per user |

---

## `apps/web/.env.local`

| Variable | Local | Production |
|----------|-------|-----------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_WS_URL` | `http://localhost:4000` | `https://api.yourdomain.com` |

---

## How the Pulumi Subprocess Uses These Variables

When `PulumiRunnerService` spawns `pulumi up`, it sets this environment for the child process:

```
PULUMI_BACKEND_URL       = s3://liftoff-pulumi-state
AWS_ACCESS_KEY_ID        = $DO_SPACES_ACCESS_KEY     ← Spaces key (S3-compatible)
AWS_SECRET_ACCESS_KEY    = $DO_SPACES_SECRET_KEY
AWS_ENDPOINT_URL_S3      = $DO_SPACES_ENDPOINT       ← Redirects S3 calls to Spaces
AWS_REGION               = $DO_SPACES_REGION
PULUMI_CONFIG_PASSPHRASE = $PULUMI_PASSPHRASE
DIGITALOCEAN_TOKEN       = <decrypted user DO token>  ← For creating user resources
```

The user's DO token (`DIGITALOCEAN_TOKEN`) is decrypted from `DOAccount.doToken` at runtime and exists only in the subprocess environment — never written to disk or logged.

---

## Production: DO App Platform

In production, set all secrets as **APP-LEVEL ENVIRONMENT VARIABLES** in App Platform (type: SECRET for sensitive values). DO automatically injects `DATABASE_URL` and `REDIS_URL` when Managed databases are attached.

```bash
# Set a secret via doctl
doctl apps update YOUR_APP_ID --spec infra/do-app-spec.yaml
```

---

## Local Dev Quick Setup

```bash
# Generate all secrets
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 20)"
echo "PULUMI_PASSPHRASE=$(openssl rand -base64 24)"

# Verify DO API token
curl -s -H "Authorization: Bearer $DO_API_TOKEN" \
  https://api.digitalocean.com/v2/account | jq .account.email

# Verify Spaces access (using AWS CLI with endpoint override)
AWS_ACCESS_KEY_ID=$DO_SPACES_ACCESS_KEY \
AWS_SECRET_ACCESS_KEY=$DO_SPACES_SECRET_KEY \
  aws s3 ls \
    --endpoint-url $DO_SPACES_ENDPOINT \
    s3://liftoff-pulumi-state
# Returns empty (first time) or list of state files

# Start local services
docker compose up -d && docker compose ps
pnpm --filter api db:migrate
```

---

## Variable Naming Rules (for AI agent)

Use these exact names — no aliases:

| Purpose | Correct name |
|---------|-------------|
| Platform database | `DATABASE_URL` |
| Platform Redis | `REDIS_URL` |
| Platform DO token | `DO_API_TOKEN` |
| Spaces access key | `DO_SPACES_ACCESS_KEY` |
| Spaces secret | `DO_SPACES_SECRET_KEY` |
| Spaces bucket | `DO_SPACES_BUCKET` |
| Spaces endpoint | `DO_SPACES_ENDPOINT` |
| Spaces region | `DO_SPACES_REGION` |
| Pulumi passphrase | `PULUMI_PASSPHRASE` (subprocess uses `PULUMI_CONFIG_PASSPHRASE` internally) |
| Encryption key | `ENCRYPTION_KEY` |
