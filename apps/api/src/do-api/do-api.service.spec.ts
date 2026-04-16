import { of, throwError } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { DoApiService } from './do-api.service';

type HttpServiceMock = {
  get: jest.Mock;
  post: jest.Mock;
};

/**
 * Unit tests for DoApiService.
 */
describe('DoApiService', () => {
  let service: DoApiService;

  const httpServiceMock: HttpServiceMock = {
    get: jest.fn(),
    post: jest.fn(),
  };

  const prismaServiceMock = {
    dOAccount: {
      updateMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DoApiService(httpServiceMock as never, prismaServiceMock as unknown as PrismaService);
  });

  it('invalidates a DO account when DigitalOcean responds with 401', async () => {
    const unauthorizedError = { response: { status: 401 } };
    httpServiceMock.get.mockReturnValue(throwError(() => unauthorizedError));
    prismaServiceMock.dOAccount.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.getAppDeploymentStatus('dop_v1_token', 'app-1', 'dep-1', 'do-account-1'),
    ).rejects.toBe(unauthorizedError);

    expect(prismaServiceMock.dOAccount.updateMany).toHaveBeenCalledWith({
      where: { id: 'do-account-1' },
      data: { validatedAt: null },
    });
  });

  it('keeps invalidation idempotent when account is already missing or invalidated', async () => {
    const unauthorizedError = { response: { status: 401 } };
    httpServiceMock.get.mockReturnValue(throwError(() => unauthorizedError));
    prismaServiceMock.dOAccount.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.getAppLogs('dop_v1_token', 'app-1', 'dep-1', 'missing-account')).rejects.toBe(
      unauthorizedError,
    );

    expect(prismaServiceMock.dOAccount.updateMany).toHaveBeenCalledWith({
      where: { id: 'missing-account' },
      data: { validatedAt: null },
    });
  });

  it('does not invalidate account for non-401 failures', async () => {
    const forbiddenError = { response: { status: 403 } };
    httpServiceMock.get.mockReturnValue(throwError(() => forbiddenError));

    await expect(
      service.getAppDeploymentStatus('dop_v1_token', 'app-1', 'dep-1', 'do-account-1'),
    ).rejects.toBe(forbiddenError);

    expect(prismaServiceMock.dOAccount.updateMany).not.toHaveBeenCalled();
  });

  it('returns deployment phase on successful request', async () => {
    const response = {
      data: { deployment: { phase: 'ACTIVE' } },
    };
    httpServiceMock.get.mockReturnValue(of(response));

    const phase = await service.getAppDeploymentStatus('dop_v1_token', 'app-1', 'dep-1', 'do-account-1');

    expect(phase).toBe('ACTIVE');
    expect(prismaServiceMock.dOAccount.updateMany).not.toHaveBeenCalled();
  });

  it('returns existing registry name when user already has a registry', async () => {
    httpServiceMock.get.mockReturnValue(
      of({
        data: {
          registry: {
            name: 'existing-registry',
          },
        },
      }),
    );

    const registryName = await service.getOrCreateContainerRegistryName('dop_v1_token', 'do-account-1');

    expect(registryName).toBe('existing-registry');
    expect(httpServiceMock.post).not.toHaveBeenCalled();
  });

  it('creates a registry when GET /v2/registry returns 404', async () => {
    httpServiceMock.get.mockReturnValue(throwError(() => ({ response: { status: 404 } })));
    httpServiceMock.post.mockReturnValue(
      of({
        data: {
          registry: {
            name: 'liftoff-abc123',
          },
        },
      }),
    );

    const registryName = await service.getOrCreateContainerRegistryName('dop_v1_token', 'do-account-1');

    expect(registryName).toBe('liftoff-abc123');
    expect(httpServiceMock.post).toHaveBeenCalledWith(
      'https://api.digitalocean.com/v2/registry',
      expect.objectContaining({
        name: expect.stringMatching(/^liftoff-[a-f0-9]{10}$/),
        subscription_tier_slug: 'starter',
      }),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer dop_v1_token',
        },
      }),
    );
  });

  it('retries registry creation on 422 name collisions', async () => {
    httpServiceMock.get.mockReturnValue(throwError(() => ({ response: { status: 404 } })));
    httpServiceMock.post
      .mockReturnValueOnce(throwError(() => ({ response: { status: 422 } })))
      .mockReturnValueOnce(
        of({
          data: {
            registry: {
              name: 'liftoff-final',
            },
          },
        }),
      );

    const registryName = await service.getOrCreateContainerRegistryName('dop_v1_token');

    expect(registryName).toBe('liftoff-final');
    expect(httpServiceMock.post).toHaveBeenCalledTimes(2);
  });
});
