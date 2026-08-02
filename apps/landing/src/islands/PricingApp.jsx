"use client";

import Shell from "./Shell";
import Pricing from "../components/Pricing";
import FAQ from "../components/FAQ";
import CTA from "../components/CTA";

export default function PricingApp() {
  return (
    <Shell>
      <Pricing />
      <FAQ />
      <CTA />
    </Shell>
  );
}
