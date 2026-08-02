"use client";

import Shell from "./Shell";
import DemoSection from "../components/DemoSection";
import CTA from "../components/CTA";

export default function DemoApp() {
  return (
    <Shell>
      <DemoSection />
      <CTA />
    </Shell>
  );
}
