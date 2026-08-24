import { describe, it, expect } from 'vitest';
import { scoreCard, __internal } from '../services/marketplace/quality.service';
import { MARKETPLACE_SPECS, allFields } from '../services/marketplace/specs';

const WB = MARKETPLACE_SPECS.WB;

/** WB uchun to'liq to'ldirilgan kartochka (yashirin maydonlarsiz) */
function fullValues() {
  const v: Record<string, string> = {};
  for (const f of allFields(WB)) {
    if (f.hidden) continue;
    if (f.key === 'title') v[f.key] = 'Erkaklar ko‘ylagi katak oq paxta klassik';
    else if (f.key === 'description') {
      v[f.key] = 'Sifatli paxta materialidan tikilgan erkaklar ko‘ylagi. '.repeat(4); // ~220 belgi
    } else if (f.type === 'number') v[f.key] = '100';
    else v[f.key] = f.options?.[0] ?? 'qiymat';
  }
  return v;
}

describe('kartochka sifat bahosi', () => {
  it("to'liq to'ldirilgan kartochka yuqori ball oladi", () => {
    const r = scoreCard(WB, fullValues(), 5);
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.grade).toBe('a‘lo');
    expect(r.topSuggestion).toBeUndefined();
  });

  it("bo'sh kartochka past ball oladi", () => {
    const r = scoreCard(WB, {}, 0);
    expect(r.score).toBeLessThan(20);
    expect(r.grade).toBe('zaif');
  });

  it('ball har doim 0–100 oralig‘ida', () => {
    for (const imgs of [0, 1, 5, 50]) {
      for (const vals of [{}, fullValues()]) {
        const r = scoreCard(WB, vals, imgs);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it('omillar yig‘indisi umumiy ballga teng', () => {
    const r = scoreCard(WB, fullValues(), 5);
    const sum = r.factors.reduce((s, f) => s + f.points, 0);
    expect(Math.min(100, sum)).toBe(r.score);
  });

  it('rasmsiz kartochka rasm omilida 0 oladi va maslahat beradi', () => {
    const r = scoreCard(WB, fullValues(), 0);
    const imgFactor = r.factors.find((f) => f.key === 'images')!;
    expect(imgFactor.points).toBe(0);
    expect(imgFactor.status).toBe('empty');
    expect(imgFactor.hint).toContain('rasm');
  });

  it("bitta rasm — qisman ball, ko'proq so'raydi", () => {
    const r = scoreCard(WB, fullValues(), 1);
    const imgFactor = r.factors.find((f) => f.key === 'images')!;
    expect(imgFactor.status).toBe('partial');
    expect(imgFactor.points).toBeGreaterThan(0);
    expect(imgFactor.points).toBeLessThan(imgFactor.max);
  });

  it("qisqa nom to'liq ball olmaydi", () => {
    const v = fullValues();
    v.title = 'Ko‘ylak';
    const full = scoreCard(WB, fullValues(), 5).factors.find((f) => f.key === 'title')!;
    const short = scoreCard(WB, v, 5).factors.find((f) => f.key === 'title')!;
    expect(short.points).toBeLessThan(full.points);
    expect(short.hint).toBeTruthy();
  });

  it('eng katta bo‘shliq topSuggestion sifatida qaytadi', () => {
    // Faqat rasm yetishmasa — u eng katta bo'shliq (25 ball)
    const r = scoreCard(WB, fullValues(), 0);
    expect(r.topSuggestion).toContain('rasm');
  });

  it('yashirin maydonlar bahoga kirmaydi', () => {
    // categoryId to'ldirilmagan bo'lsa ham to'liq kartochka a'lo bo'lishi kerak
    const v = fullValues();
    delete v.categoryId;
    delete v.typeId;
    expect(scoreCard(WB, v, 5).score).toBeGreaterThanOrEqual(90);
  });

  it("to'rttala marketplace uchun ham ishlaydi", () => {
    for (const id of ['UZUM', 'OZON', 'WB', 'YANDEX'] as const) {
      const spec = MARKETPLACE_SPECS[id];
      const v: Record<string, string> = {};
      for (const f of allFields(spec)) {
        if (f.hidden) continue;
        v[f.key] = f.type === 'number' ? '10' : f.options?.[0] ?? 'x'.repeat(60);
      }
      const r = scoreCard(spec, v, 6);
      expect(r.score, id).toBeGreaterThan(50);
    }
  });
});

describe('sifat bahosi — darajalar', () => {
  const { grade } = __internal;
  it('chegaralar to‘g‘ri', () => {
    expect(grade(95)).toBe('a‘lo');
    expect(grade(75)).toBe('yaxshi');
    expect(grade(50)).toBe('o‘rtacha');
    expect(grade(20)).toBe('zaif');
  });
});
