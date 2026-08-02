"use client";

// Umumiy qobiq: LangProvider (i18n konteksti), fon, Header, Footer.
// Har bir sahifa island'i shu qobiqdan foydalanadi.
import { LangProvider } from "../components/LangProvider";
import Background from "../components/Background";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function Shell({ children }) {
  return (
    <LangProvider>
      <Background />
      <Header />
      <main>{children}</main>
      <Footer />
    </LangProvider>
  );
}
