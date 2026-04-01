import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const key = process.env['TOKEN_ENCRYPTION_KEY'];
  if (!key) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY environment variable is required for token encryption'
    );
  }
  if (key.length < 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be at least 32 characters');
  }
  return Buffer.from(key, 'utf-8').subarray(0, KEY_LENGTH);
}

function deriveKey(password: Buffer, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH);
}

export function encryptToken(plaintext: string): string {
  const masterKey = getEncryptionKey();
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = deriveKey(masterKey, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, derivedKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf-8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Format: salt:iv:tag:encrypted (all base64)
  return [
    salt.toString('base64'),
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

export function decryptToken(ciphertext: string): string {
  const masterKey = getEncryptionKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted token format');
  }

  const [saltB64, ivB64, tagB64, encryptedB64] = parts as [string, string, string, string];
  const salt = Buffer.from(saltB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  if (tag.length !== TAG_LENGTH) {
    throw new Error('Invalid auth tag length');
  }

  const derivedKey = deriveKey(masterKey, salt);
  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf-8');
}

export interface TokenPair {
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  tokenExpiresAt: Date;
}

export function encryptTokenPair(
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
): TokenPair {
  return {
    accessTokenEncrypted: encryptToken(accessToken),
    refreshTokenEncrypted: encryptToken(refreshToken),
    tokenExpiresAt: expiresAt,
  };
}

export function decryptTokenPair(pair: TokenPair): {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
} {
  return {
    accessToken: decryptToken(pair.accessTokenEncrypted),
    refreshToken: decryptToken(pair.refreshTokenEncrypted),
    expiresAt: pair.tokenExpiresAt,
  };
}

export function isTokenExpiringSoon(expiresAt: Date, bufferMinutes = 30): boolean {
  const bufferMs = bufferMinutes * 60 * 1000;
  return Date.now() + bufferMs >= expiresAt.getTime();
}
