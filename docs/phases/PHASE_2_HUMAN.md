# Phase 2 — Authentication
## Human Developer Guide

**Prerequisite:** Phase 1 complete and verified.  
**Goal:** GitHub OAuth login works end-to-end. User is created in the database. JWT tokens issued.  
**Exit criteria:** Clicking "Sign in with GitHub" on the login page authenticates the user and redirects to `/dashboard`.

---

## Pre-flight Checklist

### 1. Verify GitHub OAuth App Settings

Check that the OAuth App you created in Phase 1 has:
- **Authorization callback URL:** `http://localhost:4000/api/auth/github/callback`
- **Client ID** and **Client Secret** correctly set in `apps/api/.env`

```bash
# Quick check — these must not be empty
grep GITHUB_CLIENT apps/api/.env
# Should output:
# GITHUB_CLIENT_ID=Ov23li...
# GITHUB_CLIENT_SECRET=...
```

### 2. Verify Phase 1 Services Are Running

```bash
# Postgres and Redis must be healthy
docker compose ps

# API must be running
curl http://localhost:4000/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

### 3. Test OAuth Flow Manually (Optional — before handing to AI)

You can test the GitHub OAuth URL in a browser before the backend is built:
```
https://github.com/login/oauth/authorize?client_id=YOUR_CLIENT_ID&scope=read:user,user:email,repo,write:repo_hook
```

It should redirect to GitHub's authorization page. If it shows an error, your Client ID is wrong.

### 4. Prepare the Frontend Redirect URL

After GitHub OAuth, the backend will redirect the frontend with the token. Make sure `FRONTEND_URL` in `apps/api/.env` is set to `http://localhost:3000`.

---

## What to Hand to the AI Agent

```
Read .github/copilot-instructions.md and docs/phases/PHASE_2_AI.md,
then implement Phase 2 — Authentication for the Liftoff project.
Phase 1 is already complete.
```

---

## Verification — Phase 2 Complete When:

### Backend Tests
```bash
cd apps/api
pnpm test src/auth/     # auth unit tests pass
pnpm test src/users/    # users unit tests pass

# Run with coverage
pnpm test:cov
# auth module should be > 80% covered
```

### Manual End-to-End Test
1. Start both servers: `pnpm dev`
2. Open `http://localhost:3000/login`
3. Click "Sign in with GitHub"
4. Authorize the app on GitHub
5. Should redirect back to `http://localhost:3000/dashboard`
6. Dashboard should show your GitHub username/avatar

### API Tests (using curl or Swagger UI at `/api/docs`)
```bash
# After completing the OAuth flow, you'll have an access token
# Test the me endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:4000/api/v1/users/me

# Expected:
# { "id": "...", "email": "...", "githubUsername": "...", ... }

# Test token refresh (uses HTTP-only cookie)
curl -X POST http://localhost:4000/api/v1/auth/refresh \
  --cookie "refreshToken=YOUR_REFRESH_TOKEN"

# Test logout
curl -X DELETE http://localhost:4000/api/v1/auth/logout \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Database Check
```bash
# Verify user was created in the database
docker exec -it liftoff_postgres psql -U liftoff -d liftoff \
  -c "SELECT id, email, github_username, created_at FROM users LIMIT 5;"
```

---

## Common Issues

| Issue | Fix |
|-------|-----|
| `redirect_uri_mismatch` from GitHub | Callback URL in GitHub OAuth App must exactly match `GITHUB_CALLBACK_URL` in `.env` |
| `401 Unauthorized` on `/users/me` | Token expired (15min). Use refresh token flow or re-login |
| Cookie not sent on refresh | Browser must support HTTP-only cookies; ensure `withCredentials: true` on Axios client |
| `Cannot read properties of undefined (reading 'user')` | Passport strategy returning undefined; check `validate()` return value |
| `prisma.user.upsert` error | Ensure `githubId` field is present and unique in schema |
| Frontend not receiving token | Check `FRONTEND_URL` in `.env` — redirect URL must match exactly |
