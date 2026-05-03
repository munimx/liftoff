import * as digitalocean from '@pulumi/digitalocean';
import * as pulumi from '@pulumi/pulumi';

const config = new pulumi.Config();
const region = (config.get('region') ?? 'nyc3') as digitalocean.Region;

const postgres = new digitalocean.DatabaseCluster('liftoff-postgres', {
  name: 'liftoff-platform-db',
  engine: 'pg',
  version: '15',
  size: 'db-s-1vcpu-1gb' as digitalocean.DatabaseSlug,
  region,
  nodeCount: 1,
  tags: ['liftoff-platform'],
});

const redis = new digitalocean.DatabaseCluster('liftoff-redis', {
  name: 'liftoff-platform-redis',
  engine: 'redis',
  version: '7',
  size: 'db-s-1vcpu-1gb' as digitalocean.DatabaseSlug,
  region,
  nodeCount: 1,
  tags: ['liftoff-platform'],
});

const app = new digitalocean.App('liftoff-platform-app', {
  spec: {
    name: 'liftoff',
    region,
    services: [
      {
        name: 'api',
        image: {
          registry: 'liftoff',
          registryType: 'DOCR',
          repository: 'api',
          tag: 'latest',
          deployOnPushes: [{ enabled: true }],
        },
        httpPort: 4000,
        instanceCount: 2,
        instanceSizeSlug: 'apps-s-1vcpu-1gb',
        routes: [{ path: '/api' }],
        healthCheck: { httpPath: '/health' },
        envs: [
          { key: 'NODE_ENV', value: 'production', scope: 'RUN_TIME' },
          { key: 'JWT_SECRET', value: config.requireSecret('jwtSecret'), type: 'SECRET', scope: 'RUN_TIME' },
          { key: 'JWT_REFRESH_SECRET', value: config.requireSecret('jwtRefreshSecret'), type: 'SECRET', scope: 'RUN_TIME' },
          { key: 'JWT_EXPIRES_IN', value: '15m', scope: 'RUN_TIME' },
          { key: 'JWT_REFRESH_EXPIRES_IN', value: '7d', scope: 'RUN_TIME' },
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
          registry: 'liftoff',
          registryType: 'DOCR',
          repository: 'web',
          tag: 'latest',
          deployOnPushes: [{ enabled: true }],
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
      {
        clusterName: postgres.name,
        dbName: 'liftoff',
        dbUser: 'liftoff',
        engine: 'PG',
        name: 'liftoff-db',
      },
      {
        clusterName: redis.name,
        engine: 'REDIS',
        name: 'liftoff-redis',
      },
    ],
  },
});

export const appLiveUrl = app.liveUrl;
export const postgresHost = postgres.host;
export const postgresPort = postgres.port;
export const redisHost = redis.host;
export const redisPort = redis.port;
