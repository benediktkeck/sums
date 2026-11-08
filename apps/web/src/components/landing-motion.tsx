"use client";

import { useEffect } from "react";

/**
 * Scroll and pointer motion for the landing page. Marks `[data-reveal]` elements
 * with `data-shown` as they scroll in (CSS plays the entrance), and feeds the
 * pointer position to the feature cards' spotlight. Without JS, or with reduced
 * motion, everything simply stays visible.
 */
export function LandingMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".lp");
    if (!root) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-shown", "");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    for (const el of root.querySelectorAll<HTMLElement>("[data-reveal]")) {
      // Whatever is already on screen stays as it is; only what comes later animates in.
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) el.setAttribute("data-shown", "");
      else io.observe(el);
    }
    root.setAttribute("data-motion", "");

    const onMove = (ev: PointerEvent) => {
      const card = (ev.target as Element | null)?.closest<HTMLElement>(".lp-card");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${ev.clientX - r.left}px`);
      card.style.setProperty("--my", `${ev.clientY - r.top}px`);
    };
    root.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      io.disconnect();
      root.removeEventListener("pointermove", onMove);
      root.removeAttribute("data-motion");
    };
  }, []);
  return null;
}
