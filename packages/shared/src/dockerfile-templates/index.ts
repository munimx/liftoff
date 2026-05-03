import type { AppType } from '../constants/wizard-defaults';
import { NEXTJS_DOCKERFILE } from './nextjs';
import { DJANGO_DOCKERFILE } from './django';
import { LARAVEL_DOCKERFILE } from './laravel';
import { EXPRESS_DOCKERFILE } from './express';

export { NEXTJS_DOCKERFILE } from './nextjs';
export { DJANGO_DOCKERFILE } from './django';
export { LARAVEL_DOCKERFILE } from './laravel';
export { EXPRESS_DOCKERFILE } from './express';

const DOCKERFILE_MAP: Record<string, string> = {
  nextjs: NEXTJS_DOCKERFILE,
  django: DJANGO_DOCKERFILE,
  laravel: LARAVEL_DOCKERFILE,
  express: EXPRESS_DOCKERFILE,
};

/**
 * Returns a Dockerfile template string for the given app type, or null for unknown types.
 */
export function getDockerfileTemplate(appType: AppType): string | null {
  return DOCKERFILE_MAP[appType] ?? null;
}
