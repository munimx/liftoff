import { Controller, Get, VERSION_NEUTRAL, Version } from '@nestjs/common';
import { Public } from './common/decorators';

/**
 * Application root controller.
 */
@Controller()
export class AppController {
  /**
   * Returns an API health payload for readiness checks.
   */
  @Public()
  @Version(VERSION_NEUTRAL)
  @Get('health')
  public getHealth(): { status: 'ok'; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
