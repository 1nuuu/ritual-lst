"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { MintModal } from "./MintModal";
import { config, prefixedSymbol } from "@/lib/config";
import { useHasSBT } from "@/lib/hooks/useHasSBT";

export function Hero() {
  const orbARef = useRef<HTMLDivElement>(null);
  const orbBRef = useRef<HTMLDivElement>(null);
  const orbCRef = useRef<HTMLDivElement>(null);
  const [mintOpen, setMintOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { isConnected } = useAccount();
  const { hasSBT, isLoading: isCheckingSBT } = useHasSBT();
  const checkingIdentity = mounted && isConnected && isCheckingSBT;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || !isConnected || isCheckingSBT || !hasSBT) {
      return;
    }

    router.replace("/stake");
  }, [hasSBT, isCheckingSBT, isConnected, mounted, router]);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const y = window.scrollY;
          if (orbARef.current) {
            orbARef.current.style.transform = `translate(${y * 0.04}px, ${y * 0.06
              }px)`;
          }
          if (orbBRef.current) {
            orbBRef.current.style.transform = `translate(${y * -0.03}px, ${y * -0.05
              }px)`;
          }
          if (orbCRef.current) {
            orbCRef.current.style.transform = `translate(${y * 0.02}px, ${y * -0.04
              }px)`;
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll(".hero .fade");
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <section className="hero">
        <div className="orbs">
          <div className="orb orb-a" ref={orbARef} />
          <div className="orb orb-b" ref={orbBRef} />
          <div className="orb orb-c" ref={orbCRef} />
        </div>
        <div className="grid-bg" />

        <div className="status fade">
          <div className="status-dot" />
          {config.chainName} / Testnet Live
        </div>

        <h1 className="hero-h1 fade d1">
          Staked by Ritual.
          <br />
          <em>Owned by Ritual.</em>
        </h1>

        <div className="hero-rule fade d2" />

        <p className="hero-sub fade d2">
          <span>Liquid Staking Token for AI economy </span>
          <span>by Ritual. </span>
          <span>
            Stake {config.tokenSymbol}, receive {prefixedSymbol(config.lstSymbol)},
            stay liquid.
          </span>
        </p>

        <div className="cta fade d3">
          <button
            className="btn"
            onClick={() => setMintOpen(true)}
            disabled={checkingIdentity}
          >
            <span>{checkingIdentity ? "Checking Identity..." : "Mint SBT"}</span>
          </button>
        </div>
      </section>

      <MintModal isOpen={mintOpen} onClose={() => setMintOpen(false)} />
    </>
  );
}
