# Liftoff — Phase Index

This project is built in **9 phases**. Each phase has documents for the human developer and for GitHub Copilot CLI.

Complete phases **strictly in order**. Never start Phase N+1 until Phase N passes its checklist.

---

## Phase Map

| Phase | Name | Doc | Milestone |
|-------|------|-----|-----------|
| 1 | Monorepo Foundation | [PHASE_1_HUMAN.md](./PHASE_1_HUMAN.md) + [PHASE_1_AI.md](./PHASE_1_AI.md) | Dev servers start, health check 200 |
| 2 | Authentication | [PHASE_2_HUMAN.md](./PHASE_2_HUMAN.md) + [PHASE_2_AI.md](./PHASE_2_AI.md) | GitHub OAuth login works end-to-end |
| 3 | Core Models & API | [PHASE_3_HUMAN.md](./PHASE_3_HUMAN.md) + [PHASE_3_AI.md](./PHASE_3_AI.md) | Projects/Environments CRUD + dashboard |
| 4 | GitHub Integration | [PHASE_4_HUMAN_AND_AI.md](./PHASE_4_HUMAN_AND_AI.md) | Repo connected, webhook fires, workflow committed |
| 5 | Infrastructure Provisioning | [PHASE_5_HUMAN_AND_AI.md](./PHASE_5_HUMAN_AND_AI.md) | Pulumi provisions DO App Platform app in user account |
| 6 | Container Deployment | [PHASES_6_9_HUMAN_AND_AI.md](./PHASES_6_9_HUMAN_AND_AI.md) | App live at HTTPS URL after git push |
| 7 | Monitoring & Logging | (in PHASES_6_9 doc) | Live logs stream to dashboard |
| 8 | Rollback & Management | (in PHASES_6_9 doc) | One-click rollback works |
| 9 | Polish & Production | (in PHASES_6_9 doc) | Platform deployed, E2E tests pass |

---

## Stack Summary

| Layer | Technology |
|-------|-----------|
| Platform hosting | DigitalOcean App Platform |
| Platform database | DO Managed PostgreSQL |
| Platform queue/cache | DO Managed Redis |
| Platform images | DO Container Registry (DOCR) |
| Pulumi state | DO Spaces (S3-compatible) |
| User app hosting | DO App Platform (in user's DO account) |
| User images | DO Container Registry (in user's DO account) |
| User database | DO Managed PostgreSQL (optional) |
| User storage | DO Spaces (optional) |
| NO AWS | Anywhere — not even for STS |

---

## How to Use These Docs

### Human Developer
1. Read `PHASE_N_HUMAN.md` completely
2. Complete all pre-flight checklist items
3. Hand off to AI with the prompt shown in the doc
4. Run the verification commands at the end

### GitHub Copilot CLI
1. Always read `.github/copilot-instructions.md` first (master context)
2. Read the phase AI doc
3. Build in the exact file order listed
4. Run verification commands after each module
5. Never add AWS imports, dependencies, or references

---

## Quick Copilot CLI Usage

```bash
# Start a Copilot session for a phase
gh copilot suggest "implement the DO accounts module per docs/phases/PHASE_3_AI.md"

# Build a specific file
gh copilot suggest "create apps/api/src/do-accounts/do-accounts.service.ts following .github/copilot-instructions.md"
```
