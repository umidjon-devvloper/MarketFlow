/**
 * Dashboard foni — landing sahifadagi "lavanda fon ustida suzuvchi oq kartalar"
 * ko'rinishi.
 *
 * Faqat mesh yetarli emas edi: uning gradientlari 0.07–0.1 shaffoflikda, oq
 * canvas ustida deyarli ko'rinmaydi. Shuning uchun ostiga to'q lavanda asos
 * qo'yilgan — kartalar aynan shu asos ustida ajralib turadi.
 *
 * Landing'dagidan farqi: sichqonchaga ergashish va zarrachalar yo'q — ish
 * panelida ular chalg'itadi.
 */
export function AppBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* Asos rang */}
      <div className="absolute inset-0 bg-[#F1EEFB] dark:bg-[#08080E]" />

      {/* Landing'dagi mesh gradient */}
      <div className="absolute inset-0 mesh-bg" />
      <div className="absolute inset-0 noise" />

      {/* Rangli dog'lar */}
      <div className="absolute -top-40 -left-32 w-[620px] h-[620px] rounded-full bg-accent/20 blur-[120px]" />
      <div className="absolute top-1/4 -right-40 w-[560px] h-[560px] rounded-full bg-electric/15 blur-[120px]" />
      <div className="absolute -bottom-52 left-1/3 w-[520px] h-[520px] rounded-full bg-indigo/15 blur-[130px]" />
    </div>
  );
}
