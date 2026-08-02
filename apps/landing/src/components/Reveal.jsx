"use client";

import { useEffect, useRef, useState } from "react";

export default function Reveal({ children, className = "", style, ...rest }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={style}
      className={`transition-all duration-700 ease-[cubic-bezier(.16,.84,.32,1)] ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[18px]"
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
