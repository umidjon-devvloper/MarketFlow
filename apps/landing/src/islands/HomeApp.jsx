"use client";

import Shell from "./Shell";
import Hero from "../components/Hero";
import Metrics from "../components/Metrics";
import Flow from "../components/Flow";
import FeatureTeaser from "../components/FeatureTeaser";
import Testimonials from "../components/Testimonials";
import CTA from "../components/CTA";

export default function HomeApp() {
  return (
    <Shell>
      <Hero />
      <Metrics />
      <Flow />
      <FeatureTeaser />
      <Testimonials />
      <CTA />
    </Shell>
  );
}
