import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { saveTemplate, getTemplates, deleteTemplate } from '../helpers/templates';
import { templateSchema } from '../utils/validation';

export const templateRouter = router({
  save: protectedProcedure
    .input(templateSchema)
    .mutation(async ({ ctx, input }) => {
      const { templateId } = await saveTemplate({
        userId: ctx.userId,
        ...input,
      });
      return { success: true, templateId };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const templates = await getTemplates(ctx.userId);
    return { templates };
  }),

  delete: protectedProcedure
    .input(z.object({ templateId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteTemplate(input.templateId, ctx.userId);
      return { success: true };
    }),
});
