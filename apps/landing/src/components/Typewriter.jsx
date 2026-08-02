"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Types out `text` character-by-character when mounted/visible.
 * Restart by changing the `key` of this component.
 */
export default function Typewriter({ text = "", speed = 22, className = "", caret = true }) {
  const [out, setOut] = useState("");
  const [done, setDone] = useState(false);
  const iRef = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setOut(text);
      setDone(true);
      return;
    }
    iRef.current = 0;
    setOut("");
    setDone(false);
    const id = setInterval(() => {
      iRef.current += 1;
      setOut(text.slice(0, iRef.current));
      if (iRef.current >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return (
    <span className={className}>
      {out}
      {caret && !done && (
        <span className="inline-block w-[2px] h-[1em] -mb-[2px] ml-0.5 bg-accent animate-pulse align-middle" />
      )}
    </span>
  );
}
