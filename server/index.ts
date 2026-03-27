import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import * as trpcExpress from '@trpc/server/adapters/express';
import dotenv from 'dotenv';
import { appRouter } from './routers';
import { db, schema } from './db';
import { eq } from 'drizzle-orm';
import type { Context } from './trpc';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Create tRPC context from request
const createContext = ({ req }: trpcExpress.CreateExpressContextOptions): Context => {
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

// In production, serve the built frontend static files
if (process.env.NODE_ENV === 'production') {
  const clientDistPath = path.resolve(__dirname, '../client');
  app.use(express.static(clientDistPath));

  // All non-API routes return index.html (SPA fallback)
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Self-ping to prevent sleep on Render (production only)
  if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL) {
    const selfUrl = `${process.env.RENDER_EXTERNAL_URL}/health`;
    const INTERVAL = 15 * 60 * 1000; // 15 minutes

    setInterval(async () => {
      try {
        const res = await fetch(selfUrl);
        const data = await res.json();
        console.log(`[self-ping] ${new Date().toISOString()} - ${data.status}`);
      } catch (err) {
        console.error('[self-ping] failed:', err);
      }
    }, INTERVAL);

    console.log(`[self-ping] enabled: pinging ${selfUrl} every 15 minutes`);
  }
});

export default app;
