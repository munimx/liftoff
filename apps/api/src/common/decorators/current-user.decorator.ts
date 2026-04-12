import { createParamDecorator, ExecutionContext } from '@nestjs/common';

type RequestWithUser = {
  user?: unknown;
};

/**
 * Returns the authenticated request user.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): unknown => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
