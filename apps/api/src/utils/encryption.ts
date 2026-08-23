import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/** .env.example dagi namuna qiymat — haqiqiy kalit sifatida ishlatilmasligi kerak */
const PLACEHOLDER_KEY = 'your-32-byte-encryption-key-here!!';

/** Shifrni ocha olmaslik — kalit o'zgargan degani, buni alohida ushlaymiz */
export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

export function isPlaceholderKey(): boolean {
  return (process.env.ENCRYPTION_KEY || '') === PLACEHOLDER_KEY;
}

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error('ENCRYPTION_KEY .env da bo\'lishi kerak (min 32 belgi)');
  }
  return Buffer.from(key.slice(0, 32));
}

export function encrypt(plainText: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decrypt(encryptedBase64: string): string {
  const data = Buffer.from(encryptedBase64, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    // Node "Unsupported state or unable to authenticate data" deydi — bu
    // foydalanuvchiga hech narsa anglatmaydi. Sabab har doim bitta: kalit
    // saqlangan paytdagidan boshqa.
    throw new DecryptionError(
      "API kalitni shifrdan ochib bo'lmadi — ENCRYPTION_KEY saqlangan paytdagidan boshqa. " +
        'Marketplace kalitini qaytadan kiriting.',
    );
  }
}
