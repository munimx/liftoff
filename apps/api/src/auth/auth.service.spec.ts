import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { EncryptionService } from '../common/services/encryption.service';
import { PrismaService } from '../prisma/prisma.service';

type RefreshTokenRecord = {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: {
    id: string;
    email: string;
    deletedAt: Date | null;
  };
};

/**
 * Unit tests for AuthService token generation and rotation.
 */
describe('AuthService', () => {
  let service: AuthService;

  const configValues: Record<string, string> = {
    JWT_SECRET: 'access-secret',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_SECRET: 'refresh-secret',
    JWT_REFRESH_EXPIRES_IN: '7d',
  };

  const prismaServiceMock = {
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const jwtServiceMock = {
    signAsync: jest.fn(
      async (payload: { sub: string; email?: string; jti?: string }): Promise<string> => {
        if (payload.email) {
          return 'access-token';
        }

        return `refresh-token-${payload.jti}`;
      },
    ),
    decode: jest.fn((_token: string): { exp: number } => ({ exp: 2_000_000_000 })),
  };

  const configServiceMock = {
    getOrThrow: jest.fn((key: string): string => {
      const value = configValues[key];
      if (!value) {
        throw new Error(`Missing config value for ${key}`);
      }

      return value;
    }),
  };

  const encryptionServiceMock = {
    hash: jest.fn(async (_value: string): Promise<string> => 'hashed-refresh-token'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      prismaServiceMock as unknown as PrismaService,
      jwtServiceMock as unknown as JwtService,
      configServiceMock as unknown as ConfigService,
      encryptionServiceMock as unknown as EncryptionService,
    );
  });

  it('generateTokens creates DB record and returns tokens', async () => {
    prismaServiceMock.refreshToken.create.mockResolvedValue(undefined);

    const tokens = await service.generateTokens('user-123', 'dev@liftoff.dev');

    expect(tokens.accessToken).toBe('access-token');
    expect(tokens.refreshToken).toContain('refresh-token-');
    expect(prismaServiceMock.refreshToken.create).toHaveBeenCalledTimes(1);

    const createCall = prismaServiceMock.refreshToken.create.mock.calls[0]?.[0] as {
      data: {
        id: string;
        userId: string;
        token: string;
        expiresAt: Date;
      };
    };

    expect(createCall.data.userId).toBe('user-123');
    expect(createCall.data.token).toBe('hashed-refresh-token');
    expect(createCall.data.expiresAt).toEqual(new Date(2_000_000_000 * 1000));

    const refreshSignPayload = jwtServiceMock.signAsync.mock.calls[1]?.[0] as {
      jti: string;
    };
    expect(refreshSignPayload.jti).toBe(createCall.data.id);
  });

  it('refreshTokens revokes old token and returns new tokens', async () => {
    const activeToken: RefreshTokenRecord = {
      id: 'token-1',
      userId: 'user-123',
      token: 'hashed-old-token',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: {
        id: 'user-123',
        email: 'dev@liftoff.dev',
        deletedAt: null,
      },
    };

    prismaServiceMock.refreshToken.findUnique.mockResolvedValue(activeToken);
    prismaServiceMock.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    prismaServiceMock.refreshToken.create.mockResolvedValue(undefined);

    const tokens = await service.refreshTokens('user-123', 'token-1');

    expect(tokens.accessToken).toBe('access-token');
    expect(tokens.refreshToken).toContain('refresh-token-');
    expect(prismaServiceMock.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'token-1',
        userId: 'user-123',
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });

  it('refreshTokens throws if token is revoked', async () => {
    const revokedToken: RefreshTokenRecord = {
      id: 'token-1',
      userId: 'user-123',
      token: 'hashed-old-token',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      user: {
        id: 'user-123',
        email: 'dev@liftoff.dev',
        deletedAt: null,
      },
    };

    prismaServiceMock.refreshToken.findUnique.mockResolvedValue(revokedToken);

    await expect(service.refreshTokens('user-123', 'token-1')).rejects.toThrow(
      'Refresh token has been revoked',
    );
    expect(prismaServiceMock.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});
