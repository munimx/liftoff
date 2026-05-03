import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import { Exceptions } from '../common/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Public deployment status response for Simple Mode.
 */
export interface PublicDeploymentStatus {
  id: string;
  status: string;
  endpoint: string | null;
  createdAt: Date;
}

/**
 * Public (no-auth) deployment status endpoint for Simple Mode shareable status pages.
 */
@Controller('deployments')
@Public()
@ApiTags('Public Deployments')
export class PublicDeploymentsController {
  public constructor(private readonly prismaService: PrismaService) {}

  /**
   * Returns minimal deployment status without authentication.
   */
  @Get(':id/status')
  public async getStatus(@Param('id') id: string): Promise<PublicDeploymentStatus> {
    const deployment = await this.prismaService.deployment.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        endpoint: true,
        createdAt: true,
      },
    });

    if (!deployment) {
      throw Exceptions.notFound('Deployment not found');
    }

    return deployment;
  }
}
