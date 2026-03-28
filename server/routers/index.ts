import { router } from '../trpc';
import { userRouter } from './user';
import { videoRouter } from './video';
import { articleRouter } from './article';
import { templateRouter } from './template';
import { usageRouter } from './usage';

export const appRouter = router({
  user: userRouter,
  video: videoRouter,
  article: articleRouter,
  template: templateRouter,
  usage: usageRouter,
});

export type AppRouter = typeof appRouter;
