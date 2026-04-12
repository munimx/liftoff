# Phase 5 — Infrastructure Provisioning
## Human Developer Guide + AI Instructions

---

# PART A: Human Developer Guide

**Prerequisite:** Phase 4 complete. Webhooks fire on push.
**Goal:** Pulumi provisions real DigitalOcean infrastructure (App Platform app, DOCR repo) in the user's DO account.
**Exit criteria:** After connecting a repo and pushing, Pulumi creates DO resources and the environment shows a live endpoint.

---

## Pre-flight Checklist

### 1. Verify Pulumi + DO Spaces Backend

```bash
pulumi version   # v3.x.x

# Log Pulumi into DO Spaces backend
PULUMI_CONFIG_PASSPHRASE=$PULUMI_PASSPHRASE \
AWS_ACCESS_KEY_ID=$DO_SPACES_ACCESS_KEY \
AWS_SECRET_ACCESS_KEY=$DO_SPACES_SECRET_KEY \
AWS_ENDPOINT_URL_S3=$DO_SPACES_ENDPOINT \
AWS_REGION=$DO_SPACES_REGION \
  pulumi login "s3://liftoff-pulumi-state"
# Expected: Logged in to ... (s3)
```

### 2. Install @pulumi/digitalocean

```bash
cd packages/pulumi-components
pnpm add @pulumi/digitalocean@^4 @pulumi/pulumi@^3
# Verify: no @pulumi/aws in dependencies
pnpm list | grep pulumi
```

### 3. Cost Warning

Phase 5 provisions **real DO resources** billed to the user's account:
- App Platform app: ~$5–10/month while running
- DOCR: free on starter plan
- Managed PostgreSQL (if enabled): ~$15/month

**Always destroy test environments:**
```bash
# Trigger from dashboard, or manually:
DIGITALOCEAN_TOKEN=USER_DO_TOKEN \
AWS_ACCESS_KEY_ID=$DO_SPACES_ACCESS_KEY \
AWS_SECRET_ACCESS_KEY=$DO_SPACES_SECRET_KEY \
AWS_ENDPOINT_URL_S3=$DO_SPACES_ENDPOINT \
AWS_REGION=$DO_SPACES_REGION \
PULUMI_CONFIG_PASSPHRASE=$PULUMI_PASSPHRASE \
  pulumi destroy --stack liftoff/project-id/env-name
```

---

## Verification

```bash
# After pushing to a connected repo:

# 1. Watch deployment status (should progress through states)
curl "http://localhost:4000/api/v1/environments/ENV_ID/deployments" \
  -H "Authorization: Bearer $TOKEN"
# PENDING → QUEUED → PROVISIONING → DEPLOYING → SUCCESS

# 2. Check DO Console — new App Platform app appears under your test user's account

# 3. Get the live URL from the deployment
curl "http://localhost:4000/api/v1/environments/ENV_ID/deployments/DEPLOY_ID" \
  -H "Authorization: Bearer $TOKEN"
# Should include: "endpoint": "https://my-app-xxxxx.ondigitalocean.app"

# 4. Hit the endpoint
curl https://my-app-xxxxx.ondigitalocean.app/
# Should return 200 (your app's response)

# 5. DESTROY after testing
# Dashboard → Environment → Infrastructure → Destroy
```

---

# PART B: GitHub Copilot CLI Instructions

**Read `.github/copilot-instructions.md` before this section. No AWS anywhere.**
**Use @pulumi/digitalocean. Do not import @pulumi/aws or @pulumi/awsx.**

---

## Objective

1. Build all Pulumi DO component classes in `packages/pulumi-components/`
2. Build the Pulumi runner service (executes `pulumi up` as subprocess with DO Spaces state)
3. Build the infrastructure BullMQ processor
4. Stream Pulumi output to WebSocket in real time

---

## Pulumi Components — `packages/pulumi-components/src/`

**All components must:**
- Extend `pulumi.ComponentResource`
- Accept a typed `args` interface
- Apply tags `{ 'liftoff-project': projectName, 'liftoff-environment': environment, 'liftoff-managed': 'true' }`
- Export public output properties as `pulumi.Output<string>`
- Use `new digitalocean.Provider(...)` with explicit user token — never default provider

---

### `src/registry/docr-repository.ts` — `DocrRepository`

Args: `{ projectName, environmentName, docrName, provider }`

Creates:
- `digitalocean.ContainerRegistryDockerCredentials` — enables the user's account to push to the shared DOCR (or user's own DOCR)

Note: DO Container Registry is account-level. For MVP, use the Liftoff-managed DOCR (from `DOCR_NAME` env var). Each environment gets a unique repository path: `{projectName}/{environmentName}`.

Outputs: `repositoryUrl` (full `registry.digitalocean.com/{docrName}/{projectName}/{environmentName}`)

---

### `src/app-platform/app-platform-app.ts` — `AppPlatformApp`

Args:
```typescript
interface AppPlatformAppArgs {
  appName: string;            // must be globally unique in DO
  projectName: string;
  environmentName: string;
  region: string;
  imageUri: string;           // full DOCR URI with tag
  httpPort: number;
  instanceSizeSlug: string;
  instanceCount: number;
  envVars: Record<string, string>;
  secretNames: string[];       // names of secrets to inject (values set separately)
  healthCheckPath: string;
  database?: { clusterName: string; dbName: string; dbUser: string };
  provider: digitalocean.Provider;
}
```

Creates:
- `digitalocean.App` with spec:
  - `name`: must be kebab-case, max 32 chars
  - `region`: DO region slug
  - `services`: one service component:
    - `name`: service name
    - `image`: `{ registry: docrName, registryType: 'DOCR', repository: '...', tag: sha }`
    - `httpPort`, `instanceCount`, `instanceSizeSlug`
    - `healthCheck`: `{ httpPath: healthCheckPath }`
    - `envs`: map envVars to `{ key, value, scope: 'RUN_TIME', type: 'GENERAL' }`
  - `databases`: if database is provided, attach the managed database

Outputs: `appId`, `appUrl` (live URL), `defaultIngress`

---

### `src/database/managed-postgres.ts` — `ManagedPostgres` (optional)

Args: `{ name, region, size, version, provider }`

Creates:
- `digitalocean.DatabaseCluster`:
  - engine: "pg"
  - version: "15"
  - size: args.size (e.g. "db-s-1vcpu-1gb")
  - nodeCount: 1
  - region: args.region

Outputs: `clusterId`, `clusterName`, `host`, `port`, `database`, `username`, `password`, `uri`

---

### `src/storage/spaces-bucket.ts` — `SpacesBucket` (optional)

Args: `{ bucketName, region, provider }`

Creates:
- `digitalocean.SpacesBucket`:
  - region: args.region
  - acl: "private"
  - versioning: `{ enabled: true }`
- `digitalocean.SpacesBucketCorsConfiguration` — allow the user's app domain

Outputs: `bucketName`, `bucketDomainName`, `endpoint`

---

### `src/stacks/app-platform-stack.ts` — main composition

```typescript
export interface AppPlatformStackArgs {
  projectName: string;
  projectId: string;
  environmentName: string;
  environmentId: string;
  doRegion: string;
  doToken: string;          // decrypted user token
  docrName: string;         // Liftoff's DOCR name (from DOCR_NAME env var)
  imageUri: string;
  config: LiftoffConfig;   // from @liftoff/shared
}

export interface StackOutputs {
  appUrl: string;
  appId: string;
  repositoryUrl: string;
  dbClusterName?: string;
  dbUri?: string;           // secret output
  bucketName?: string;
  bucketEndpoint?: string;
}

export async function createAppPlatformStack(args: AppPlatformStackArgs): Promise<void> {
  // This function is the Pulumi program entrypoint
  // It must be called inside pulumi.runtime or compiled into a standalone program

  const provider = new digitalocean.Provider('user-account', {
    token: args.doToken,
  });

  // 1. DOCR credentials (so the App Platform app can pull the image)
  const registry = new DocrRepository('registry', {
    projectName: args.projectName,
    environmentName: args.environmentName,
    docrName: args.docrName,
    provider,
  }, { provider });

  // 2. Optional: Managed PostgreSQL
  let db: ManagedPostgres | undefined;
  if (args.config.database?.enabled) {
    db = new ManagedPostgres('db', {
      name: `liftoff-${args.projectName}-${args.environmentName}-db`,
      region: args.doRegion,
      size: args.config.database.size ?? 'db-s-1vcpu-1gb',
      version: args.config.database.version ?? '15',
      provider,
    }, { provider });
  }

  // 3. Optional: Spaces bucket
  let bucket: SpacesBucket | undefined;
  if (args.config.storage?.enabled) {
    bucket = new SpacesBucket('bucket', {
      bucketName: `liftoff-${args.projectName}-${args.environmentName}`,
      region: args.doRegion,
      provider,
    }, { provider });
  }

  // 4. App Platform app
  const app = new AppPlatformApp('app', {
    appName: `liftoff-${args.projectName}-${args.environmentName}`,
    projectName: args.projectName,
    environmentName: args.environmentName,
    region: args.doRegion,
    imageUri: args.imageUri,
    httpPort: args.config.runtime.port,
    instanceSizeSlug: args.config.runtime.instance_size,
    instanceCount: args.config.runtime.replicas,
    envVars: args.config.env ?? {},
    secretNames: args.config.secrets ?? [],
    healthCheckPath: args.config.healthcheck?.path ?? '/health',
    database: db ? { clusterName: db.clusterName, dbName: 'liftoff', dbUser: 'liftoff' } : undefined,
    provider,
  }, { provider });

  // 5. Export outputs — Pulumi auto-exports these as stack outputs
  exports.appUrl = app.appUrl;
  exports.appId = app.appId;
  exports.repositoryUrl = registry.repositoryUrl;
  if (db) exports.dbClusterName = db.clusterName;
  if (bucket) exports.bucketName = bucket.bucketName;
}
```

---

## Backend — `apps/api/src/infrastructure/`

### `src/infrastructure/pulumi-runner.service.ts`

Executes Pulumi CLI as a child process. The working directory is a temp folder with a generated TypeScript program.

```typescript
@Injectable()
export class PulumiRunnerService {

  // run(options: PulumiRunOptions): Promise<PulumiRunResult>
  //   1. Create temp dir: os.tmpdir() + '/' + uuid()
  //   2. Write the Pulumi program files to temp dir (see generatePulumiProgram below)
  //   3. Run: `npm install` in temp dir (to get @pulumi/digitalocean)
  //   4. Spawn: pulumi up --stack STACK_NAME --yes --json
  //   5. Child process env (CRITICAL — read carefully):
  //        PULUMI_BACKEND_URL      = 's3://DO_SPACES_BUCKET'
  //        AWS_ACCESS_KEY_ID       = DO_SPACES_ACCESS_KEY   // Spaces key for state
  //        AWS_SECRET_ACCESS_KEY   = DO_SPACES_SECRET_KEY   // Spaces secret for state
  //        AWS_ENDPOINT_URL_S3     = DO_SPACES_ENDPOINT     // Redirect to Spaces
  //        AWS_REGION              = DO_SPACES_REGION
  //        PULUMI_CONFIG_PASSPHRASE = PULUMI_PASSPHRASE
  //        DIGITALOCEAN_TOKEN      = decrypted user DO token  // For @pulumi/digitalocean
  //        PATH                    = process.env.PATH
  //   6. Stream stdout line by line → call options.onLog() for each line
  //   7. Parse JSON output → extract stack outputs
  //   8. Clean up temp dir
  //   9. Return { success, outputs, error? }

  // preview(options): Promise<PulumiPreviewResult> — same but --preview flag
  // destroy(options): Promise<void> — pulumi destroy --yes
}

interface PulumiRunOptions {
  stackName: string;     // 'liftoff/{projectId}/{envName}'
  doToken: string;       // decrypted user DO token
  args: AppPlatformStackArgs;
  onLog?: (line: string, level: 'info'|'warn'|'error') => void;
}
```

**`generatePulumiProgram(args, tempDir)`** — writes these files to tempDir:
- `package.json`: `{ dependencies: { "@pulumi/pulumi": "^3", "@pulumi/digitalocean": "^4" } }`
- `tsconfig.json`: basic CommonJS TypeScript config
- `Pulumi.yaml`: `{ name: 'liftoff-user-infra', runtime: 'nodejs' }`
- `index.ts`: imports `createAppPlatformStack` from the local component path, calls it with args, awaits result

**Stack name format:** `liftoff/{projectId}/{environmentName}` — consistent across runs so Pulumi updates existing infra.

### `src/infrastructure/infrastructure.processor.ts`

```typescript
@Processor(QUEUE_NAMES.INFRASTRUCTURE)
export class InfrastructureProcessor {

  @Process(JOB_NAMES.INFRASTRUCTURE.PROVISION)
  async handleProvision(job: Job<InfraProvisionJobPayload>) {
    // 1. Fetch environment + project + doAccount
    // 2. Parse liftoff config from configYaml
    // 3. Decrypt user DO token: EncryptionService.decrypt(doAccount.doToken)
    // 4. Update deployment: PROVISIONING + broadcast
    // 5. Run pulumi up via PulumiRunnerService:
    //    - onLog: save to DeploymentLog + broadcast DEPLOYMENT_LOG
    //    - resource changes: broadcast INFRA_PROGRESS
    // 6. On success:
    //    - Save PulumiStack: { stackName, stateSpacesKey, outputs: { appUrl, appId, ... } }
    //    - Save InfrastructureResource records (type: 'digitalocean:index/app:App', doResourceId: appId)
    //    - Update deployment: DEPLOYING, endpoint = outputs.appUrl
    //    - Add deployments queue job to poll App Platform until active
    // 7. On failure:
    //    - Update deployment: FAILED, errorMessage
    //    - Broadcast DEPLOYMENT_ERROR
  }

  @Process(JOB_NAMES.INFRASTRUCTURE.DESTROY)
  async handleDestroy(job: Job<InfraDestroyJobPayload>) {
    // Decrypt user token, run pulumi destroy
    // Delete InfrastructureResource records
    // Update PulumiStack (clear outputs)
  }
}
```

### `src/infrastructure/infrastructure.service.ts`

```typescript
// previewInfra(environmentId, userId): Promise<PulumiPreviewResult>
// destroyInfra(environmentId, userId): Promise<void> — queue destroy job
// getResources(environmentId, userId): Promise<InfrastructureResource[]>
```

**`src/infrastructure/infrastructure.controller.ts`**
```typescript
@Controller('environments/:environmentId/infrastructure')
// POST /preview
// DELETE / — queue destroy
// GET /resources
```

---

## Phase 5 Acceptance Tests

```bash
pnpm --filter pulumi-components build   # TypeScript compile — no AWS imports
pnpm --filter api test src/infrastructure/

# Integration (costs money — test carefully):
# 1. Connect repo with valid liftoff.yml
# 2. Push commit → watch dashboard
# 3. After ~3-5 min: environment shows ondigitalocean.app endpoint
# 4. curl https://YOUR_APP.ondigitalocean.app/ → 200
# 5. Check DO Console → App Platform → new app visible
# 6. DESTROY: POST /environments/ENV_ID/infrastructure with DELETE
# 7. DO Console → App should be gone
```

## Notes for Copilot

- **No @pulumi/aws anywhere.** The only Pulumi providers used are `@pulumi/pulumi` and `@pulumi/digitalocean`.
- The `AWS_*` env vars in the subprocess are for DO Spaces (S3-compatible state). They have nothing to do with AWS infrastructure.
- `DIGITALOCEAN_TOKEN` in the subprocess env is the user's token (decrypted). This is what `@pulumi/digitalocean` uses automatically.
- DO App Platform app names must be globally unique per DO account, max 32 chars. Use: `liftoff-{projectName}-{envName}`, truncated if needed.
- The image URI passed to App Platform must be a full DOCR path: `registry.digitalocean.com/{docrName}/{repo}:{tag}`
- DO App Platform takes 2–5 minutes for initial deploys. Set job timeout to 15 minutes minimum.
- Stack name format `liftoff/{projectId}/{environmentName}` — same name = update, different = new stack.
- `stateSpacesKey` in PulumiStack is the Spaces object key path, e.g. `.pulumi/stacks/liftoff/project-id/production.json`
- The `digitalocean.App` resource in the Pulumi program is a complete app spec — updating it in-place (changing imageUri) triggers a new App Platform deployment automatically.
- DO Managed PostgreSQL takes 3–5 minutes to provision. Inform users with a clear progress log line.
