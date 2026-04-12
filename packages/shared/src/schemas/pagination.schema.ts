import { z } from 'zod';

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/**
 * Converts pagination query values into Prisma-compatible skip/take values.
 */
export function paginate(query: PaginationQuery): { skip: number; take: number } {
  const normalized = PaginationQuerySchema.parse(query);
  return {
    skip: (normalized.page - 1) * normalized.limit,
    take: normalized.limit,
  };
}
