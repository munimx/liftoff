import { SetMetadata } from '@nestjs/common';
import { ProjectRoleType } from '@liftoff/shared';

export const ROLES_KEY = 'roles';

/**
 * Sets project role metadata for role-based authorization checks.
 */
export const Roles = (...roles: ProjectRoleType[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
