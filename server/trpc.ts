import { initTRPC, TRPCError } from '@trpc/server';
import type { Request } from 'express';

export interface Context {
  req: Request;
  userId: number;
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Authenticated procedure - ensures userId is present
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  // For now, use a header-based userId (to be replaced with proper auth)
  const userId = ctx.userId;
  if (!userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: '認証が必要です',
    });
  }
  return next({ ctx: { ...ctx, userId } });
});
