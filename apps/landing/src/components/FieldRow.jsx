"use client";

import { useState } from "react";

export default function FieldRow({ label, value, node }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(value).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="flex items-start justify-between gap-3.5 py-3 border-b border-line last:border-b-0">
      <div className="font-mono text-[0.74rem] uppercase tracking-wider text-muted flex-none w-[100px] pt-0.5">
        {label}
      </div>
      <div className="text-[0.92rem] flex-1 text-ink-soft">{node || value}</div>
      <button
        onClick={handleCopy}
        aria-label={`${label} nusxalash`}
        className={`flex-none w-8 h-8 rounded-lg border flex items-center justify-center transition-colors bg-panel ${
          copied ? "text-accent border-accent" : "text-muted border-line hover:text-accent hover:border-accent"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      </button>
    </div>
  );
}
