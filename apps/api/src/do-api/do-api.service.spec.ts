import { of, throwError } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { DoApiService } from './do-api.service';

type HttpServiceMock = {
  get: jest.Mock;
};

/**
 * Unit tests for DoApiService.
 */
describe('DoApiService', () => {
  let service: DoApiService;

  const httpServiceMock: HttpServiceMock = {
    get: jest.fn(),
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
});
