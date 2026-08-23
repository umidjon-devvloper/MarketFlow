import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/**
 * Shifrlash — marketplace API kalitlari shu bilan saqlanadi.
 * Kalit o'zgarganda tushunarli xato chiqishi kerak: bir marta bu joy
 * "Unsupported state or unable to authenticate data" deb, sababini
 * tushunib bo'lmaydigan xato bergan edi.
 */
describe('shifrlash', () => {
  const original = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'test-key-that-is-long-enough-32ch!!';
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = original;
  });

  it('shifrlab, qaytarib ocha oladi', async () => {
    const { encrypt, decrypt } = await import('../utils/encryption');
    const secret = 'sk_live_abc123';
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it('har safar boshqa natija beradi (IV tasodifiy)', async () => {
    const { encrypt } = await import('../utils/encryption');
    expect(encrypt('bir xil matn')).not.toBe(encrypt('bir xil matn'));
  });

  it("boshqa kalit bilan ochilmaydi va tushunarli xato beradi", async () => {
    const { encrypt, decrypt, DecryptionError } = await import('../utils/encryption');
    const enc = encrypt('sirli');

    process.env.ENCRYPTION_KEY = 'butunlay-boshqa-kalit-32-belgidan!!';
    expect(() => decrypt(enc)).toThrow(DecryptionError);
    expect(() => decrypt(enc)).toThrow(/ENCRYPTION_KEY/);
  });

  it('namuna kalitni tanib oladi', async () => {
    const { isPlaceholderKey } = await import('../utils/encryption');
    process.env.ENCRYPTION_KEY = 'your-32-byte-encryption-key-here!!';
    expect(isPlaceholderKey()).toBe(true);
    process.env.ENCRYPTION_KEY = 'haqiqiy-kalit-32-belgidan-uzunroq!!';
    expect(isPlaceholderKey()).toBe(false);
  });

  it("kalit qisqa bo'lsa ishlamaydi", async () => {
    const { encrypt } = await import('../utils/encryption');
    process.env.ENCRYPTION_KEY = 'qisqa';
    expect(() => encrypt('matn')).toThrow(/32/);
  });
});
