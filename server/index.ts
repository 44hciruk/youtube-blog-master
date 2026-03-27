import express from 'express';
import cors from 'cors';
import * as trpcExpress from '@trpc/server/adapters/express';
import dotenv from 'dotenv';
import { appRouter } from './routers';
import type { Context } from './trpc';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

// Create tRPC context from request
const createContext = ({ req }: trpcExpress.CreateExpressContextOptions): Context => {
  // For development: use x-user-id header
  // In production: replace with proper auth (e.g., session/JWT)
  const userId = Number(req.headers['x-user-id']) || 0;
  return { req, userId };
};

// Mount tRPC
app.use(
  '/api/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
