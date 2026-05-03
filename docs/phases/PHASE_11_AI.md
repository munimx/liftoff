# Phase 11 — Visual Pipeline Builder (n8n-style No-Code)

## Overview

Phase 10 gave non-developers a wizard. Phase 11 gives them a canvas. Users drag infrastructure and service nodes onto a board, connect them with edges, and Liftoff compiles the graph into a real Pulumi deployment. No `liftoff.yml`, no terminal, no YAML.

The mental model: **nodes are things, edges are relationships.** An edge from a `Database` node to an `App` node means "inject `DATABASE_URL` into this app." The graph is the source of truth — `liftoff.yml` becomes a compile target, not a user-facing artifact.

---

## The Core Idea

```
User builds this on a canvas:

  ┌──────────────┐        ┌─────────────────┐        ┌──────────────┐
  │  GitHub Push │───────▶│   Docker Build  │───────▶│  App: API    │
  │  (trigger)   │        │   (build step)  │        │  (Next.js)   │
  └──────────────┘        └─────────────────┘        └──────┬───────┘
                                                            │
                                                            │ needs
                                                            ▼
                                                     ┌──────────────┐
                                                     │  PostgreSQL  │
                                                     │  (database)  │
                                                     └──────────────┘

Liftoff compiles this into:
  - liftoff.yml (runtime config)
  - Pulumi stack (real DO resources)
  - GitHub Actions workflow (CI trigger)
```

---

## Key Library

**React Flow** (`@xyflow/react`) — the same open-source engine that powers n8n's canvas. It handles drag, drop, pan, zoom, edge drawing, and node selection out of the box. It has zero opinions about what your nodes do.

```bash
pnpm --filter web add @xyflow/react
```

---

## Node Types

Every node has a `type`, `data` (its config), and `position` on the canvas. Edges have a `source` node + `sourceHandle` and a `target` node + `targetHandle`.

### Trigger Nodes (left side — where pipelines start)

| Node                | What it does                                         |
| ------------------- | ---------------------------------------------------- |
| `GitHubPushTrigger` | Fires when a branch is pushed. Config: repo, branch. |
| `ManualTrigger`     | User clicks "Run" in the dashboard. No config.       |
| `ScheduleTrigger`   | Cron expression. Config: schedule string. Post-MVP.  |

### Build Nodes (middle — transform code into an image)

| Node              | What it does                                                                    |
| ----------------- | ------------------------------------------------------------------------------- |
| `DockerBuild`     | Builds a Docker image from a Dockerfile. Config: context path, Dockerfile path. |
| `AutoDetectBuild` | Liftoff picks the Dockerfile template based on detected language. No config.    |

### Infrastructure Nodes (right side — what runs in DO)

| Node               | What it does                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `AppService`       | A DO App Platform service. Config: name, instance size, replicas, port, health check path. |
| `PostgresDatabase` | DO Managed PostgreSQL. Config: size, version.                                              |
| `SpacesBucket`     | DO Spaces object storage bucket. Config: region.                                           |
| `CustomDomain`     | Attach a domain to an App node. Config: domain name.                                       |

### Config Nodes (attach to any node)

| Node      | What it does                                                                    |
| --------- | ------------------------------------------------------------------------------- |
| `EnvVars` | Key/value pairs. Edge to an App node injects them at runtime.                   |
| `Secret`  | A single secret name. Edge to an App node marks it as a DO App Platform secret. |

---

## Edge Semantics (what connections mean)

Edges are not just visual — they carry meaning that the compiler reads.

| Edge (source → target)          | Compiler action                                                  |
| ------------------------------- | ---------------------------------------------------------------- |
| `Trigger → DockerBuild`         | This trigger kicks off this build                                |
| `DockerBuild → AppService`      | This image is deployed to this app                               |
| `PostgresDatabase → AppService` | Inject `DATABASE_URL` secret into this app; create DB before app |
| `SpacesBucket → AppService`     | Inject `BUCKET_NAME`, `BUCKET_ENDPOINT`, keys into this app      |
| `EnvVars → AppService`          | Add these as `env` in liftoff config                             |
| `Secret → AppService`           | Add this name to `secrets` list in liftoff config                |
| `CustomDomain → AppService`     | Set `domain.name` in liftoff config                              |

The compiler walks edges in dependency order — database before app, build before deploy — and generates the correct Pulumi resource graph.

---

## Data Model

One new table. Everything else reuses existing models.

```prisma
model PipelineGraph {
  id            String      @id @default(cuid())
  environmentId String      @unique @map("environment_id")
  nodes         Json        // ReactFlow node array: [{ id, type, data, position }]
  edges         Json        // ReactFlow edge array: [{ id, source, target, sourceHandle, targetHandle }]
  compiledYaml  String?     @map("compiled_yaml")   // last successful compile output
  isValid       Boolean     @default(false) @map("is_valid")
  validationErrors Json?    @map("validation_errors")
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")
  environment   Environment @relation(fields: [environmentId], references: [id], onDelete: Cascade)

  @@map("pipeline_graphs")
}
```

The `nodes` and `edges` columns store the exact JSON that React Flow produces. No translation layer — save what React Flow gives you, load it straight back in.

---

## The Compiler

This is the most important backend piece. It lives at `apps/api/src/pipeline/pipeline-compiler.service.ts`.

**Input:** A `PipelineGraph` (nodes + edges JSON)
**Output:** A `LiftoffConfig` object (same type as `parseLiftoffConfig()` returns)

```typescript
// Compiler steps:

// 1. Parse nodes into typed objects
//    Find AppService nodes, Database nodes, etc.

// 2. Walk edges to resolve dependencies
//    PostgresDatabase → AppService means: database.enabled = true

// 3. Build LiftoffConfig from resolved graph
//    service.name    = AppService node's `name` data field
//    runtime.port    = AppService node's `port` data field
//    database.size   = PostgresDatabase node's `size` data field
//    env             = merged from all EnvVars nodes connected to this App
//    secrets         = collected from all Secret nodes connected to this App

// 4. Validate with existing safeParseLiftoffConfig() from @liftoff/shared
//    Return validation errors with the node ID that caused each error
//    (so the canvas can highlight the broken node in red)

// 5. Serialize to YAML string and store in compiledYaml column
```

**Validation errors carry node IDs:**

```typescript
interface PipelineValidationError {
  nodeId: string; // React Flow node ID — frontend highlights this node
  field: string; // which field is wrong
  message: string; // human-readable
}
```

The frontend subscribes to validation errors and draws a red border on the offending node. The user clicks the node, fixes the config, and the canvas re-validates automatically on every change (debounced 500ms).

---

## API Endpoints

New module: `apps/api/src/pipeline/`

```
GET  /api/v1/environments/:envId/pipeline        — load graph for canvas
PUT  /api/v1/environments/:envId/pipeline        — save graph (auto-validates)
POST /api/v1/environments/:envId/pipeline/validate — validate without saving
POST /api/v1/environments/:envId/pipeline/compile  — compile to liftoff.yml + preview
POST /api/v1/environments/:envId/pipeline/deploy   — compile + trigger deployment
```

The `deploy` endpoint:

1. Runs the compiler
2. Calls `safeParseLiftoffConfig()` — rejects if invalid
3. Writes `configYaml` and `configParsed` on the `Environment` record (same fields Phase 3 uses)
4. Queues a deployment job — the exact same BullMQ job Phases 5–6 process

The pipeline canvas is just a new way to populate the `Environment.configYaml` field. Everything downstream (Pulumi, App Platform, monitoring, rollback) is untouched.

---

## Frontend

### Canvas page

**`app/(dashboard)/projects/[id]/environments/[envId]/pipeline/page.tsx`**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Toolbar:  [ Add Node ▾ ]   [ Validate ]   [ Deploy → ]            │
├────────────────────┬────────────────────────────────────────────────┤
│                    │                                                │
│   Node Panel       │              Canvas (React Flow)               │
│                    │                                                │
│  TRIGGERS          │    ┌──────────┐        ┌──────────────┐       │
│  ○ GitHub Push     │    │ GH Push  │───────▶│ Docker Build │       │
│  ○ Manual          │    └──────────┘        └──────┬───────┘       │
│                    │                               │               │
│  BUILD             │                               ▼               │
│  ○ Docker Build    │                        ┌──────────────┐       │
│  ○ Auto-detect     │                        │  App: API    │◀──┐   │
│                    │                        └──────────────┘   │   │
│  SERVICES          │                                            │   │
│  ○ App Service     │                        ┌──────────────┐   │   │
│  ○ PostgreSQL      │                        │  PostgreSQL  │───┘   │
│  ○ Spaces Bucket   │                        └──────────────┘       │
│                    │                                                │
│  CONFIG            │                                                │
│  ○ Env Vars        │                                                │
│  ○ Secret          │                                                │
│                    │                                                │
└────────────────────┴────────────────────────────────────────────────┘
│  Status bar:  ✅ Graph is valid  ·  Last saved 2 seconds ago        │
└─────────────────────────────────────────────────────────────────────┘
```

### Node config panel

Clicking any node opens a slide-out panel (not a modal — the canvas stays visible):

```
┌─────────────────────────┐
│  App Service            │  ← node type label
│  ─────────────────────  │
│  Name:    [ my-api    ] │
│  Port:    [ 3000      ] │
│  Size:    [ Small ▾   ] │
│  Replicas:[ 1         ] │
│  Health:  [ /health   ] │
│  ─────────────────────  │
│  ✅ Node is valid        │
└─────────────────────────┘
```

Changes are saved to the graph JSON immediately (React state) and auto-saved to the API after 500ms debounce.

### Key frontend components

```
apps/web/components/pipeline/
├── pipeline-canvas.tsx          # React Flow wrapper, loads/saves graph
├── node-panel.tsx               # Left sidebar with draggable node types
├── config-panel.tsx             # Right slide-out for selected node config
├── status-bar.tsx               # Bottom bar: valid/invalid + last saved
├── toolbar.tsx                  # Top bar: validate + deploy buttons
├── nodes/
│   ├── github-push-trigger.tsx
│   ├── manual-trigger.tsx
│   ├── docker-build.tsx
│   ├── app-service.tsx          # Largest node — most config fields
│   ├── postgres-database.tsx
│   ├── spaces-bucket.tsx
│   ├── custom-domain.tsx
│   ├── env-vars.tsx
│   └── secret.tsx
└── edges/
    └── labeled-edge.tsx         # Shows edge label on hover (e.g. "injects DATABASE_URL")
```

---

## Template Graphs

Pre-built graphs that users can load as starting points. Same concept as Phase 10D templates, but now they're graphs instead of zip files.

Stored in `packages/shared/src/constants/pipeline-templates.ts` as plain JSON objects (React Flow node + edge arrays):

| Template           | Nodes included                                                    |
| ------------------ | ----------------------------------------------------------------- |
| Simple web app     | `GitHubPushTrigger → DockerBuild → AppService`                    |
| Web app + database | Above + `PostgresDatabase → AppService`                           |
| Full stack         | Above + `SpacesBucket → AppService` + `CustomDomain → AppService` |
| API only           | `ManualTrigger → DockerBuild → AppService`                        |

Loading a template populates the canvas. The user then edits node configs (name, port, etc.) before deploying.

---

## File Map

```
apps/api/src/pipeline/
├── pipeline.module.ts
├── pipeline.controller.ts       # GET/PUT/POST endpoints
├── pipeline.service.ts          # Save, load, validate graph
├── pipeline-compiler.service.ts # Graph → LiftoffConfig
└── pipeline.service.spec.ts
└── pipeline-compiler.service.spec.ts

apps/web/app/(dashboard)/projects/[id]/environments/[envId]/
└── pipeline/
    └── page.tsx                 # Canvas page

apps/web/components/pipeline/
└── (all components listed above)

packages/shared/src/
├── constants/pipeline-templates.ts   # Pre-built graph JSON
└── types/pipeline.ts                 # Node/edge type interfaces

prisma/migrations/
└── YYYYMMDDHHMMSS_add_pipeline_graph/
    └── migration.sql
```

---

## Build Order

| Step    | What                              | Done when                                                         |
| ------- | --------------------------------- | ----------------------------------------------------------------- |
| **11A** | `PipelineGraph` model + migration | Table exists, `GET/PUT /pipeline` endpoints return 200            |
| **11B** | Compiler service + tests          | `compile()` turns a valid graph into correct `LiftoffConfig` JSON |
| **11C** | Canvas page + node panel          | Can drag nodes onto canvas and save to DB                         |
| **11D** | Node config panels + validation   | Clicking a node opens config; invalid nodes show red border       |
| **11E** | Edge semantics wired to compiler  | Database → App edge injects `database.enabled: true`              |
| **11F** | Deploy button                     | "Deploy" button compiles graph and queues a real deployment       |
| **11G** | Template graphs                   | Template picker populates canvas with starter graph               |

---

## What Does NOT Change

- Phases 1–10 are untouched
- Developers can still write `liftoff.yml` directly — the pipeline canvas is an alternative editor for the same `Environment.configYaml` field
- All Pulumi components, DO App Platform integration, monitoring, rollback — unchanged
- The `PipelineGraph` is just metadata; the actual deployment still runs through the existing Phase 5–6 BullMQ processors

---
