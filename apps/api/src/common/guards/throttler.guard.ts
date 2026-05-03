import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Extended throttler guard that skips webhook routes (authenticated via HMAC)
 * and allows per-route override via @SkipThrottle().
 */
@Injectable()
export class LiftoffThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ path?: string }>();
    const path = request.path ?? '';

    if (path.includes('/webhooks')) {
      return true;
    }

    return false;
  }
}
