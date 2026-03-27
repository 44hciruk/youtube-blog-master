import { eq, and } from 'drizzle-orm';
import { db, schema } from '../db';
import { encryptApiKey, decryptApiKey, maskApiKey } from '../utils/encryption';

export async function saveUserApiKey(
  userId: number,
  keyType: 'openai' | 'youtube',
  apiKey: string,
) {
  const encrypted = encryptApiKey(apiKey);

  await db
    .insert(schema.userApiKeys)
    .values({
      userId,
      keyType,
      encryptedKey: encrypted,
    })
    .onDuplicateKeyUpdate({
      set: {
        encryptedKey: encrypted,
        updatedAt: new Date(),
      },
    });
}

export async function getUserApiKeys(userId: number) {
  const keys = await db
    .select()
    .from(schema.userApiKeys)
    .where(eq(schema.userApiKeys.userId, userId));

  return keys.map((key) => ({
    id: key.id,
    keyType: key.keyType,
    maskedKey: maskApiKey(decryptApiKey(key.encryptedKey)),
    createdAt: key.createdAt,
    updatedAt: key.updatedAt,
  }));
}

export async function getDecryptedApiKey(
  userId: number,
  keyType: 'openai' | 'youtube',
): Promise<string | null> {
  const [key] = await db
    .select()
    .from(schema.userApiKeys)
    .where(
      and(
        eq(schema.userApiKeys.userId, userId),
        eq(schema.userApiKeys.keyType, keyType),
      ),
    )
    .limit(1);

  if (!key) return null;
  return decryptApiKey(key.encryptedKey);
}

export async function deleteUserApiKey(
  userId: number,
  keyType: 'openai' | 'youtube',
) {
  await db
    .delete(schema.userApiKeys)
    .where(
      and(
        eq(schema.userApiKeys.userId, userId),
        eq(schema.userApiKeys.keyType, keyType),
      ),
    );
}
