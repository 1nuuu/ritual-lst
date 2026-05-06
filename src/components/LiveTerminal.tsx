"use client";

import { useEffect, useRef, useCallback } from "react";
import { config, terminalSlug } from "@/lib/config";

interface ScriptLine {
  type: "cmd" | "output" | "success" | "gap" | "prompt";
  text?: string;
}

const SCRIPT: ScriptLine[] = [
  { type: "cmd", text: "identity.mint()" },
  { type: "output", text: "  connecting wallet..." },
  { type: "output", text: `  ${config.sbtSymbol} issued -> identity #001` },
  { type: "success", text: "  ok access granted." },
  { type: "gap" },
  { type: "prompt" },
];

const CHAR_DELAY = 38;
const AFTER_CMD = 420;
const AFTER_OUT = 180;
const RESTART = 3200;

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

export function LiveTerminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  const runScript = useCallback(async (signal: AbortSignal) => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";

    for (const step of SCRIPT) {
      signal.throwIfAborted();

      if (step.type === "gap") {
        const gap = document.createElement("div");
        gap.style.height = ".3rem";
        container.appendChild(gap);
        await sleep(80, signal);
        continue;
      }

      if (step.type === "prompt") {
        const row = document.createElement("div");
        row.className = "lt-line cmd";
        const prompt = document.createElement("span");
        prompt.className = "lt-prompt";
        prompt.textContent = ">";
        const text = document.createElement("span");
        text.className = "lt-text";
        const cursor = document.createElement("span");
        cursor.className = "lt-cursor";
        text.appendChild(cursor);
        row.appendChild(prompt);
        row.appendChild(text);
        container.appendChild(row);
        break;
      }

      const row = document.createElement("div");
      row.className =
        "lt-line " +
        (step.type === "cmd"
          ? "cmd"
          : step.type === "success"
            ? "success"
            : "normal");
      const prompt = document.createElement("span");
      prompt.className = "lt-prompt";
      const text = document.createElement("span");
      text.className = "lt-text";
      row.appendChild(prompt);
      row.appendChild(text);
      container.appendChild(row);

      if (step.type === "cmd") {
        prompt.textContent = ">";
        await sleep(120, signal);
        for (const ch of step.text || "") {
          signal.throwIfAborted();
          text.textContent += ch;
          container.scrollTop = container.scrollHeight;
          await sleep(CHAR_DELAY, signal);
        }
        const cur = document.createElement("span");
        cur.className = "lt-cursor";
        text.appendChild(cur);
        await sleep(AFTER_CMD, signal);
        cur.remove();
      } else {
        prompt.textContent = "";
        text.textContent = step.text || "";
        await sleep(AFTER_OUT, signal);
      }
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    let abortController: AbortController | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !startedRef.current) {
            startedRef.current = true;
            observer.disconnect();
            abortController = new AbortController();
            const signal = abortController.signal;
            void (async () => {
              try {
                while (!signal.aborted) {
                  await runScript(signal);
                  await sleep(RESTART, signal);
                }
              } catch {
                // Component unmounted.
              }
            })();
          }
        });
      },
      { threshold: 0.25 },
    );
    observer.observe(container);
    return () => {
      observer.disconnect();
      abortController?.abort();
    };
  }, [runScript]);

  return (
    <div className="live-terminal">
      <div className="lt-bar">
        <span className="lt-dot lt-dot-red" />
        <span className="lt-dot lt-dot-gold" />
        <span className="lt-dot lt-dot-green" />
        <span className="lt-title">{terminalSlug} ~ terminal</span>
      </div>
      <div className="lt-body" ref={containerRef} />
    </div>
  );
}
