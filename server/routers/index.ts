import { router } from '../trpc';
import { userRouter } from './user';
import { videoRouter } from './video';
import { articleRouter } from './article';
import { templateRouter } from './template';

export const appRouter = router({
  user: userRouter,
  video: videoRouter,
  article: articleRouter,
  template: templateRouter,
});

export type AppRouter = typeof appRouter;
