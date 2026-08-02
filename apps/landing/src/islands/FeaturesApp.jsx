"use client";

import Shell from "./Shell";
import BentoFeatures from "../components/BentoFeatures";
import WorkflowStrip from "../components/WorkflowStrip";
import CTA from "../components/CTA";

export default function FeaturesApp() {
  return (
    <Shell>
      <BentoFeatures />
      <WorkflowStrip />
      <CTA />
    </Shell>
  );
}
