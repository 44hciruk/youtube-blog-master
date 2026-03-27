import express from 'express';
import cors from 'cors';
import * as trpcExpress from '@trpc/server/adapters/express';
import dotenv from 'dotenv';
import { appRouter } from './routers';
import { db, schema } from './db';
import { eq } from 'drizzle-orm';
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

// Simple login/register endpoint (for internal friend-group use)
app.post('/api/auth/login', async (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name || !name.trim()) {
    res.status(400).json({ error: '名前を入力してください' });
    return;
  }

  try {
    const trimmedName = name.trim();
    // Find or create user by name
    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.name, trimmedName))
      .limit(1);

    if (existing.length > 0) {
      res.json({ userId: existing[0].id, name: existing[0].name });
    } else {
      const openId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const [result] = await db.insert(schema.users).values({
        openId,
        name: trimmedName,
        loginMethod: 'local',
      }).returning({ id: schema.users.id });
      res.json({ userId: result.id, name: trimmedName });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'ログインに失敗しました' });
  }
});

// Mount tRPC
app.use(
  '/api/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
