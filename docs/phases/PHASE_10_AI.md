# Phase 10 — Visual Builder (Non-Developer Interface)

## Overview

Phase 9 left Liftoff as a developer tool — users write `liftoff.yml`, connect GitHub, and understand Docker. Phase 10 adds a parallel "Simple Mode" that lets non-developers deploy apps without touching any of that. The existing developer interface is untouched.

---

## The Core Problem

Non-developers are blocked by three things:

1. **They can't write `liftoff.yml`** — they don't know what a port is
2. **They don't have a GitHub repo** — they have a folder on their desktop
3. **Deployment feedback is gibberish** — "PROVISIONING → DEPLOYING" means nothing to them

Every part of Phase 10 solves exactly one of these three problems.

---

## What Gets Built

### 10A — Visual Config Builder (replaces `liftoff.yml`)

A step-by-step wizard that generates `liftoff.yml` behind the scenes. The user never sees the file.

**Wizard steps:**

```
Step 1: What kind of app is this?
        [ Next.js ] [ Django ] [ Laravel ] [ Node/Express ] [ Other ]

Step 2: How much power does it need?
        [ Small — personal project (~$5/mo) ]
        [ Medium — small team (~$10/mo) ]
        [ Large — production traffic (~$50/mo) ]

Step 3: Does it need a database?
        [ No ] [ Yes — PostgreSQL ]

Step 4: What's the web address for your app?
        [ I'll use the free one Liftoff gives me ]
        [ I have my own domain: ______________ ]
```

Each answer maps to known `liftoff.yml` values. The wizard output is stored as `configParsed` JSON on the `Environment` model — the same field the existing system already uses. No new database columns needed.

**App type → auto-detected defaults:**

| Selection    | `runtime.port` | `healthcheck.path` | `instance_size`      |
| ------------ | -------------- | ------------------ | -------------------- |
| Next.js      | 3000           | `/api/health`      | `apps-s-1vcpu-1gb`   |
| Django       | 8000           | `/health/`         | `apps-s-1vcpu-1gb`   |
| Laravel      | 80             | `/up`              | `apps-s-1vcpu-1gb`   |
| Node/Express | 3000           | `/health`          | `apps-s-1vcpu-0.5gb` |

---

### 10B — Code Upload (replaces GitHub)

Non-developers don't have repos. They have a zip file or a local folder.

**Flow:**

```
User drops a zip file onto the upload area
         │
         ▼
Liftoff creates a private GitHub repo on their behalf
(using the GitHub token from their OAuth login — scope: repo already granted in Phase 2)
         │
         ▼
Liftoff unzips the code and pushes it to the new repo
         │
         ▼
Liftoff runs the normal Phase 4–6 webhook + deployment flow
         │
         ▼
User gets a live URL — they never saw a terminal
```

**What gets built:**

- `POST /api/v1/projects/:id/upload` — accepts `multipart/form-data` zip, max 50MB
- `UploadService` — unzips in temp dir, creates GitHub repo via `GitHubService.createRepository()`, pushes files via GitHub Contents API (for small repos) or `git` subprocess (for larger ones)
- A new `GitHubService` method: `createRepository(githubToken, repoName, private: true)`
- Frontend dropzone component using `react-dropzone`

**Auto-generated `Dockerfile` detection:**

If the uploaded zip has no `Dockerfile`, Liftoff generates one based on the wizard's app type selection:

```dockerfile
# Auto-generated for Next.js apps by Liftoff
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

These templates live in `packages/shared/src/dockerfile-templates/` as plain strings — one per app type.

---

### 10C — Plain English Status Page (replaces the technical dashboard)

The existing deployment detail page shows `PROVISIONING → DEPLOYING` with raw Pulumi logs. Non-developers see this and panic.

Simple Mode gets a completely separate status page at `/deploy/:deploymentId/status` with no auth required (shareable link):

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   🔨  Building your app...                          │
│       Usually takes 2–3 minutes                     │
│                                                     │
│   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  Step 2/4   │
│                                                     │
│   ✅  Code uploaded                                  │
│   ⏳  Setting up your server                        │
│   ○   Making it live                                │
│   ○   Almost done                                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Status → plain English mapping:**

| `DeploymentStatus` | Simple Mode text                             |
| ------------------ | -------------------------------------------- |
| `PENDING`          | Getting ready...                             |
| `BUILDING`         | Building your app (step 1/4)                 |
| `PUSHING`          | Packaging your app (step 2/4)                |
| `PROVISIONING`     | Setting up your server (step 3/4)            |
| `DEPLOYING`        | Making it live (step 4/4)                    |
| `SUCCESS`          | 🎉 Your app is live!                         |
| `FAILED`           | Something went wrong — we'll help you fix it |

The mapping lives in `packages/shared/src/constants/deployment-status.ts` as a new `DEPLOYMENT_STATUS_LABELS` export alongside the existing constants.

**On `SUCCESS`:** show the live URL as a big button — "Open My App →"

**On `FAILED`:** show a mailto link pre-filled with the `deploymentId` so the user can report it without knowing anything technical.

---

### 10D — Template Gallery (starting point for non-developers)

A gallery of one-click starter templates at `/templates`:

```
[ Blog with Next.js ]   [ Portfolio site ]   [ REST API with Express ]
[ Django web app    ]   [ Laravel app    ]   [ Static HTML site      ]
```

Each template is a small zip file stored in DO Spaces at `liftoff-templates/{slug}.zip`. Clicking one runs the same upload flow from 10B — Liftoff pulls the zip from Spaces, creates a repo, deploys it.

**Template manifest** — `packages/shared/src/constants/templates.ts`:

```typescript
export const TEMPLATES = [
  {
    slug: 'nextjs-blog',
    name: 'Blog with Next.js',
    description: 'A simple blog. Customize the content and deploy.',
    appType: 'nextjs',
    spacesKey: 'liftoff-templates/nextjs-blog.zip',
  },
  // ...
] as const;
```

New API endpoint: `POST /api/v1/projects/:id/deploy-template` — body: `{ templateSlug }`. Internally calls the same `UploadService` that 10B uses, just pulling from Spaces instead of a user upload.

---

## What Does NOT Change

- The existing developer dashboard, `liftoff.yml` flow, and GitHub integration are untouched
- The `Deployment`, `Environment`, `PulumiStack` models are unchanged
- Pulumi components are unchanged — Simple Mode still deploys real DO App Platform apps
- All Phase 1–9 code continues to work exactly as before

Simple Mode is purely a frontend + thin API layer that feeds into the existing Phase 5–6 pipeline.

---

## File Map

```
apps/web/app/
├── (simple)/                        # NEW — Simple Mode layout (no sidebar)
│   ├── layout.tsx                   # Minimal layout: logo + "Switch to Developer Mode"
│   ├── deploy/
│   │   └── page.tsx                 # Main entry: wizard + upload
│   ├── deploy/[deploymentId]/
│   │   └── status/page.tsx          # Plain English status page (no auth)
│   └── templates/
│       └── page.tsx                 # Template gallery

apps/web/components/simple/
├── deployment-wizard.tsx            # 4-step wizard
├── code-upload-dropzone.tsx         # Drag-and-drop zip upload
├── plain-status.tsx                 # Friendly status display
└── template-card.tsx               # Template gallery card

apps/api/src/
├── upload/
│   ├── upload.module.ts
│   ├── upload.service.ts            # Unzip → GitHub repo → trigger deploy
│   └── upload.controller.ts        # POST /upload, POST /deploy-template
└── repositories/
    └── github.service.ts            # Add: createRepository(), pushFiles()

packages/shared/src/
├── constants/deployment-status.ts  # Add: DEPLOYMENT_STATUS_LABELS
├── constants/templates.ts          # NEW: template manifest
└── dockerfile-templates/           # NEW: one string per app type
    ├── nextjs.ts
    ├── django.ts
    ├── laravel.ts
    └── express.ts
```

---

## Build Order

Complete these in order. Each step is independently testable.

| Step    | What                                  | Done when                                                        |
| ------- | ------------------------------------- | ---------------------------------------------------------------- |
| **10A** | Wizard UI + `configParsed` generation | Wizard produces valid `liftoff.yml` JSON, visible in DB          |
| **10B** | Zip upload → GitHub repo → deploy     | Uploading a zip creates a repo and a live deployment             |
| **10C** | Plain English status page             | `/deploy/:id/status` loads without login and shows friendly text |
| **10D** | Template gallery                      | Clicking a template deploys a working starter app                |

---
