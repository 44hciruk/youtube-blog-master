import crypto from 'crypto';

function getKeyBuffer(): Buffer {
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be set as a 64-character hex string (32 bytes). Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return Buffer.from(ENCRYPTION_KEY, 'hex');
}

export function encryptApiKey(apiKey: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getKeyBuffer(), iv);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptApiKey(encryptedKey: string): string {
  const parts = encryptedKey.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted key format');
  }
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', getKeyBuffer(), iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 10) return '****';
  const start = apiKey.substring(0, 5);
  const end = apiKey.substring(apiKey.length - 5);
  return `${start}****...${end}`;
}
