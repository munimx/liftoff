import type { User } from '@prisma/client';
import { EncryptionService } from '../common/services/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubProfile, UsersService } from './users.service';

const now = new Date('2025-01-01T00:00:00.000Z');

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'dev@liftoff.dev',
  githubId: '12345',
  githubUsername: 'liftoffdev',
  githubToken: 'encrypted-token',
  name: 'Liftoff Dev',
  avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  ...overrides,
});

/**
 * Unit tests for UsersService GitHub upsert behavior.
 */
describe('UsersService', () => {
  let service: UsersService;

  const prismaServiceMock = {
    user: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const encryptionServiceMock = {
    encrypt: jest.fn((_value: string): string => 'encrypted-token'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(
      prismaServiceMock as unknown as PrismaService,
      encryptionServiceMock as unknown as EncryptionService,
    );
  });

  it('findOrCreateFromGitHub creates user on first call', async () => {
    const githubProfile: GitHubProfile = {
      githubId: '12345',
      email: 'dev@liftoff.dev',
      githubUsername: 'liftoffdev',
      name: 'Liftoff Dev',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
      githubAccessToken: 'github-access-token',
    };
    const createdUser = buildUser();
    prismaServiceMock.user.upsert.mockResolvedValue(createdUser);

    const result = await service.findOrCreateFromGitHub(githubProfile);

    expect(result).toEqual(createdUser);
    expect(encryptionServiceMock.encrypt).toHaveBeenCalledWith('github-access-token');

    const upsertCall = prismaServiceMock.user.upsert.mock.calls[0]?.[0] as {
      where: { githubId: string };
      create: {
        email: string;
        githubId: string;
        githubUsername: string;
        githubToken: string;
      };
    };

    expect(upsertCall.where).toEqual({ githubId: '12345' });
    expect(upsertCall.create).toMatchObject({
      email: 'dev@liftoff.dev',
      githubId: '12345',
      githubUsername: 'liftoffdev',
      githubToken: 'encrypted-token',
    });
  });

  it('findOrCreateFromGitHub updates user on subsequent calls', async () => {
    const githubProfile: GitHubProfile = {
      githubId: '12345',
      email: 'updated@liftoff.dev',
      githubUsername: 'liftoff-updated',
      name: 'Updated Liftoff Dev',
      avatarUrl: 'https://avatars.githubusercontent.com/u/2?v=4',
      githubAccessToken: 'updated-github-access-token',
    };
    const updatedUser = buildUser({
      email: githubProfile.email,
      githubUsername: githubProfile.githubUsername,
      name: githubProfile.name,
      avatarUrl: githubProfile.avatarUrl,
    });
    prismaServiceMock.user.upsert.mockResolvedValue(updatedUser);

    const result = await service.findOrCreateFromGitHub(githubProfile);

    expect(result).toEqual(updatedUser);

    const upsertCall = prismaServiceMock.user.upsert.mock.calls[0]?.[0] as {
      update: {
        email: string;
        githubUsername: string;
        name: string | null;
        avatarUrl: string | null;
        githubToken: string;
      };
    };

    expect(upsertCall.update).toMatchObject({
      email: 'updated@liftoff.dev',
      githubUsername: 'liftoff-updated',
      name: 'Updated Liftoff Dev',
      avatarUrl: 'https://avatars.githubusercontent.com/u/2?v=4',
      githubToken: 'encrypted-token',
    });
  });
});
