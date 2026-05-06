"use client";

import { useEffect } from "react";
import { LiveTerminal } from "./LiveTerminal";
import { config, prefixedSymbol } from "@/lib/config";

const STEPS = [
  {
    idx: "01 / 04",
    locked: false,
    terminal: [
      { prefix: ">", text: "identity.mint()", cls: "t-g" },
      { prefix: "", text: "// soul-bound token", cls: "t-d" },
      { prefix: "ok", text: `${config.sbtSymbol} issued`, cls: "t-g" },
    ],
    title: "Mint Your SBT",
    desc: `Secure your Soul Bound Token (SBT) today. This is the permanent credential you need to access ${config.protocolName}.`,
    tag: "Access Pass",
  },
  {
    idx: "02 / 04",
    locked: true,
    terminal: [
      { prefix: ">", text: `vault.deposit(${config.tokenSymbol})`, cls: "t-g" },
      { prefix: "", text: "// delegate to validators", cls: "t-d" },
      { prefix: "ok", text: "stake confirmed", cls: "t-g" },
    ],
    title: `Deposit ${config.tokenSymbol}`,
    desc: `Deposit testnet ${config.tokenSymbol} into the ${config.protocolName} staking vault. Assets are delegated to verified validators on ${config.chainName}.`,
    tag: "Staking Vault",
  },
  {
    idx: "03 / 04",
    locked: true,
    terminal: [
      {
        prefix: ">",
        text: `token.mint(${prefixedSymbol(config.lstSymbol)})`,
        cls: "t-g",
      },
      { prefix: "", text: "// ratio 1:1", cls: "t-d" },
      { prefix: "ok", text: "liquid position", cls: "t-g" },
    ],
    title: `Receive ${prefixedSymbol(config.lstSymbol)}`,
    desc: `Get ${prefixedSymbol(config.lstSymbol)} minted 1:1 to your deposit. These liquid tokens represent your staked position and can be used freely.`,
    tag: "LST Token",
  },
  {
    idx: "04 / 04",
    locked: true,
    terminal: [
      {
        prefix: ">",
        text: `token.burn(${prefixedSymbol(config.lstSymbol)})`,
        cls: "t-g",
      },
      { prefix: "", text: "// ~10 min queue", cls: "t-d" },
      { prefix: "ok", text: `${config.tokenSymbol} returned`, cls: "t-g" },
    ],
    title: "Redeem Anytime",
    desc: `Burn ${prefixedSymbol(config.lstSymbol)} to initiate withdrawal. After the ~10 min unbonding queue, claim ${config.tokenSymbol} back to your wallet.`,
    tag: "Withdrawal Queue",
  },
];

export function HowItWorks() {
  useEffect(() => {
    const fades = document.querySelectorAll(".hiw .fade");
    const steps = document.querySelectorAll(".step");

    const fadeIO = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            fadeIO.unobserve(entry.target);
          }
        }),
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
    );

    const stepIO = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            stepIO.unobserve(entry.target);
          }
        }),
      { threshold: 0.12, rootMargin: "0px 0px -30px 0px" },
    );

    fades.forEach((el) => fadeIO.observe(el));
    steps.forEach((el) => stepIO.observe(el));

    return () => {
      fadeIO.disconnect();
      stepIO.disconnect();
    };
  }, []);

  return (
    <section className="hiw" id="how-it-works">
      <div className="hiw-header">
        <div>
          <div className="section-label">Protocol</div>
          <h2 className="hiw-h2 fade">How {config.protocolName} Works</h2>
          <p className="hiw-desc fade d1">
            <span>A transparent liquid staking mechanism </span>
            <span>built natively on {config.chainName}</span>
          </p>
        </div>
        <div className="fade d2">
          <LiveTerminal />
        </div>
      </div>

      <div className="steps fade d2">
        {STEPS.map((step) => (
          <div
            key={step.idx}
            className={`step${step.locked ? " locked" : ""}`}
          >
            <div className="step-idx">{step.idx}</div>
            <div className="terminal">
              {step.terminal.map((line, j) => (
                <div key={j}>
                  <span className={line.cls}>{line.prefix}</span>
                  {line.prefix ? " " : ""}
                  {line.text}
                </div>
              ))}
            </div>
            <div className="step-h">{step.title}</div>
            <p className="step-p">{step.desc}</p>
            <span className="tag">{step.tag}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
