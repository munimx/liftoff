# Phase 3 — Core Models & API
## Human Developer Guide

**Prerequisite:** Phase 2 complete. GitHub OAuth login works.
**Goal:** DO account connection, Projects/Environments CRUD, frontend dashboard.
**Exit criteria:** User can connect their DO account, create a project, and add environments.

---

## Pre-flight Checklist

### 1. Get a Real DO API Token for Testing

You need an actual DO Personal Access Token to test the account connection flow:

```bash
# Check your token works
curl -s -H "Authorization: Bearer YOUR_DO_TOKEN" \
  https://api.digitalocean.com/v2/account | jq .account.email
# Should print your DO account email
```

### 2. Verify Phase 2 Login Works

```bash
pnpm dev
# Open http://localhost:3000/login → sign in → reaches /dashboard
```

---

## Hand Off to AI

```
Read .github/copilot-instructions.md and docs/phases/PHASE_3_AI.md,
then implement Phase 3 — Core Models & API.
Phases 1 and 2 are complete. Everything is DigitalOcean — no AWS.
```

---

## Verification

```bash
TOKEN="your_jwt_token"

# Connect DO account (validate happens immediately on create)
curl -X POST http://localhost:4000/api/v1/do-accounts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"doToken":"dop_v1_YOUR_REAL_TOKEN","region":"nyc3"}'
# Expected: 201 — { id, region, validatedAt, createdAt } (no doToken in response!)

# Create project
curl -X POST http://localhost:4000/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"my-webapp","description":"test"}'
# Expected: 201

# Frontend: /settings → Connect DO Account → green badge after save
# Frontend: /projects → New Project → project appears in list
# Frontend: /projects/{id} → Add Environment → environment created
```

---

## Common Issues

| Issue | Fix |
|-------|-----|
| `DO_ACCOUNT_INVALID_TOKEN` on connect | Token must start with `dop_v1_` and have read+write scope |
| `doToken` appears in API response | The response DTO is wrong — check it excludes `doToken` |
| 403 on environment endpoints | Ensure the doAccountId belongs to the requesting user |
| Config validation returns 500 | Zod schema import from `@liftoff/shared` — make sure `pnpm --filter shared build` ran |
