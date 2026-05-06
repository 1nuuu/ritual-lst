"use client";

import { useEffect } from "react";

const revealSelector = [
  ".hero .fade",
  ".hiw .fade",
  ".step",
  ".section-divider",
  "footer",
].join(",");

export function ScrollMagic() {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;

    const updateScrollVars = () => {
      frame = 0;
      const scrollMax = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const progress = Math.min(1, Math.max(0, window.scrollY / scrollMax));
      const shift = Math.min(96, window.scrollY * 0.055);
      root.style.setProperty("--scroll-progress", progress.toFixed(4));
      root.style.setProperty("--scroll-shift", `${shift.toFixed(1)}px`);
    };

    const requestScrollUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateScrollVars);
    };

    updateScrollVars();
    window.addEventListener("scroll", requestScrollUpdate, { passive: true });
    window.addEventListener("resize", requestScrollUpdate);

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" },
    );

    document
      .querySelectorAll(revealSelector)
      .forEach((element) => revealObserver.observe(element));

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestScrollUpdate);
      window.removeEventListener("resize", requestScrollUpdate);
      revealObserver.disconnect();
      root.style.removeProperty("--scroll-progress");
      root.style.removeProperty("--scroll-shift");
    };
  }, []);

  return null;
}
