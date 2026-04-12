import { PrismaClient } from '@prisma/client';
import { createCipheriv, randomBytes } from 'crypto';

const DEFAULT_ENVIRONMENT_ID = 'cmnu5v7pg0003g51hsyutf7be';
const AES_256_GCM = 'aes-256-gcm';
const IV_LENGTH = 16;

const prisma = new PrismaClient();

function getArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function encryptDeploySecret(secret: string, encryptionKeyHex: string): string {
  const encryptionKey = Buffer.from(encryptionKeyHex, 'hex');
  if (encryptionKey.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 64-char hex string (32 bytes)');
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(AES_256_GCM, encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

async function main(): Promise<void> {
  const environmentId =
    getArgValue('--environment-id') ?? getArgValue('--environmentId') ?? DEFAULT_ENVIRONMENT_ID;
  const plainSecret = getArgValue('--secret') ?? randomBytes(20).toString('hex');
  const encryptionKeyHex = getRequiredEnvironmentVariable('ENCRYPTION_KEY');

  const environment = await prisma.environment.findUnique({
    where: {
      id: environmentId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!environment) {
    throw new Error(`Environment "${environmentId}" was not found`);
  }

  const encryptedSecret = encryptDeploySecret(plainSecret, encryptionKeyHex);
  await prisma.environment.update({
    where: {
      id: environmentId,
    },
    data: {
      liftoffDeploySecret: encryptedSecret,
    },
  });

  console.log(`Updated liftoffDeploySecret for environment ${environment.id} (${environment.name})`);
  console.log(`LIFTOFF_DEPLOY_SECRET=${plainSecret}`);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to set deploy secret: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
