import type { User } from '@prisma/client';
import { CreateDOAccountDto } from './dto/create-do-account.dto';
import { DOAccountsController } from './do-accounts.controller';
import { DOAccountsService } from './do-accounts.service';

const now = new Date('2025-01-01T00:00:00.000Z').toISOString();

const buildUser = (): User => ({
  id: 'user-1',
  email: 'dev@liftoff.dev',
  githubId: '123',
  githubUsername: 'liftoffdev',
  githubToken: null,
  name: 'Liftoff Dev',
  avatarUrl: null,
  createdAt: new Date(now),
  updatedAt: new Date(now),
  deletedAt: null,
});

/**
 * Unit tests for DOAccountsController.
 */
describe('DOAccountsController', () => {
  let controller: DOAccountsController;

  const doAccountsServiceMock = {
    create: jest.fn(),
    findAllByUser: jest.fn(),
    findOne: jest.fn(),
    validate: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new DOAccountsController(doAccountsServiceMock as unknown as DOAccountsService);
  });

  it('create delegates to service with authenticated user id', async () => {
    const dto: CreateDOAccountDto = {
      doToken: 'dop_v1_token',
      region: 'nyc3',
    };
    doAccountsServiceMock.create.mockResolvedValue({
      id: 'do-1',
      region: 'nyc3',
      validatedAt: now,
      createdAt: now,
    });

    const result = await controller.create(buildUser(), dto);

    expect(result.id).toBe('do-1');
    expect(doAccountsServiceMock.create).toHaveBeenCalledWith('user-1', dto);
  });

  it('delete delegates to service with account and user ids', async () => {
    doAccountsServiceMock.delete.mockResolvedValue(undefined);

    await controller.delete('do-1', buildUser());

    expect(doAccountsServiceMock.delete).toHaveBeenCalledWith('do-1', 'user-1');
  });
});
