import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

type SoftDeleteDelegate = {
  update(args: unknown): Promise<unknown>;
};

/**
 * Prisma client service lifecycle wrapper.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  public async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL via Prisma');
  }

  public async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Disconnected Prisma client');
  }

  /**
   * Applies soft deletion by setting `deletedAt` on a delegate model.
   */
  public async softDelete(
    delegate: SoftDeleteDelegate,
    where: Record<string, unknown>,
  ): Promise<unknown> {
    return delegate.update({
      where,
      data: { deletedAt: new Date() },
    });
  }
}
