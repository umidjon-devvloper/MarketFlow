import { describe, it, expect } from 'vitest';
import { inspectToken } from '../services/marketplace/wb-api.service';

/** Test uchun WB tokeniga o'xshash JWT yasash (imzo tekshirilmaydi) */
function fakeToken(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.imzo`;
}

const future = Math.floor(Date.now() / 1000) + 86400;
const past = Math.floor(Date.now() / 1000) - 86400;

describe('WB token tekshiruvi', () => {
  it('sandbox tokenini tanib oladi (t: true)', () => {
    const problems = inspectToken(fakeToken({ s: 3, t: true, exp: future }));
    expect(problems.some((p) => p.code === 'sandbox')).toBe(true);
    expect(problems.find((p) => p.code === 'sandbox')!.message).toContain('Тестовый контур');
  });

  it("bo'sh ruxsatlarni tanib oladi (s: 0)", () => {
    const problems = inspectToken(fakeToken({ s: 0, t: false, exp: future }));
    expect(problems.some((p) => p.code === 'no_scopes')).toBe(true);
  });

  it('ikkala muammoni birga qaytaradi', () => {
    const problems = inspectToken(fakeToken({ s: 0, t: true, exp: future }));
    expect(problems.map((p) => p.code).sort()).toEqual(['no_scopes', 'sandbox']);
  });

  it('muddati tugagan tokenni tanib oladi', () => {
    const problems = inspectToken(fakeToken({ s: 3, t: false, exp: past }));
    expect(problems.some((p) => p.code === 'expired')).toBe(true);
  });

  it('JWT bo\'lmagan matnni rad etadi', () => {
    expect(inspectToken('shunchaki-matn')[0].code).toBe('not_jwt');
  });

  it("to'g'ri tokenda muammo yo'q", () => {
    expect(inspectToken(fakeToken({ s: 3, t: false, exp: future }))).toHaveLength(0);
  });
});
