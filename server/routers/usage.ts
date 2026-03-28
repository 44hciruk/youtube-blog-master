import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { getUsageSummary } from '../helpers/usageLogs';

export const usageRouter = router({
  // Get usage summary (cost dashboard)
  summary: protectedProcedure
    .input(
      z.object({
        daysBack: z.number().min(1).max(365).default(30),
      }).default({}),
    )
    .query(async ({ ctx, input }) => {
      return getUsageSummary(ctx.userId, input.daysBack);
    }),
});
