"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import type { Connector } from "wagmi";
import { useAccount, useConnect } from "wagmi";
import { config } from "@/lib/config";
import { useHasSBT } from "@/lib/hooks/useHasSBT";
import { SBT_CONTRACT } from "@/lib/sbt";

type AccessGateProps = {
  children: ReactNode;
};

type TerminalLineProps = {
  command?: string;
  label?: string;
  output: string;
  delay?: number;
  checking?: boolean;
  tone?: "ok" | "warn" | "error";
};

const TYPE_INTERVAL_MS = 52;
const INITIAL_PROMPT_DELAY_MS = 260;
const OUTPUT_DELAY_MS = 320;
const LINE_SETTLE_MS = 500;
const CHECKING_HOLD_MS = 1200;
const LINE_GAP_MS = 300;
const ACCESS_GRANTED_REVEAL_MS = 5200;
const ACCESS_SCAN_SESSION_PREFIX = "ritual-lst:access-scan:v1";

type ScanSessionStatus = "checking" | "fresh" | "complete";

const getAccessScanSessionKey = (
  wallet: string | undefined,
  contract: `0x${string}` | undefined,
) => {
  if (!wallet || !contract) {
    return null;
  }

  return `${ACCESS_SCAN_SESSION_PREFIX}:${contract.toLowerCase()}:${wallet.toLowerCase()}`;
};

const getShortAddress = (wallet: string | undefined) =>
  wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "undefined";

const getConnectorLabel = (connector: Connector) => {
  if (connector.id === "injected") {
    return connector.name || "Browser Wallet";
  }

  if (connector.id === "walletConnect") {
    return "WalletConnect";
  }

  if (
    connector.id === "coinbaseWallet" ||
    connector.id === "coinbaseWalletSDK"
  ) {
    return "Coinbase Wallet";
  }

  return connector.name;
};

const getLineStyle = (delay: number) =>
  ({
    "--line-delay": `${delay}ms`,
  }) as CSSProperties;

const getProgressStyle = (delay: number, windowMs: number) =>
  ({
    "--line-delay": `${delay}ms`,
    "--progress-window": `${windowMs}ms`,
  }) as CSSProperties;

const getOutputDelay = (command: string | undefined, delay: number) =>
  command
    ? delay + command.length * TYPE_INTERVAL_MS + OUTPUT_DELAY_MS
    : delay;

const getStepEndDelay = (step: TerminalLineProps, delay: number) =>
  getOutputDelay(step.command, delay) +
  (step.checking ? CHECKING_HOLD_MS : LINE_SETTLE_MS);

const withTerminalTiming = (steps: Omit<TerminalLineProps, "delay">[]) => {
  let nextDelay = INITIAL_PROMPT_DELAY_MS;

  const timedSteps = steps.map((step) => {
    const delay = nextDelay;
    nextDelay = getStepEndDelay(step, delay) + LINE_GAP_MS;

    return {
      ...step,
      delay,
    };
  });

  return {
    timedSteps,
    finalPromptDelay: nextDelay,
  };
};

const useTypedText = (text: string, delay: number) => {
  const [typedText, setTypedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!text) {
      setTypedText("");
      setIsTyping(false);
      return undefined;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTypedText(text);
      setIsTyping(false);
      return undefined;
    }

    let index = 0;
    let intervalId: number | undefined;
    setTypedText("");
    setIsTyping(false);

    const timeoutId = window.setTimeout(() => {
      setIsTyping(true);
      intervalId = window.setInterval(() => {
        index += 1;
        setTypedText(text.slice(0, index));

        if (index >= text.length && intervalId !== undefined) {
          window.clearInterval(intervalId);
          setIsTyping(false);
        }
      }, TYPE_INTERVAL_MS);
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
      setIsTyping(false);
    };
  }, [delay, text]);

  return { typedText, isTyping };
};

const useVisibleAfter = (delay: number) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsVisible(true);
      return undefined;
    }

    setIsVisible(false);
    const timeoutId = window.setTimeout(() => setIsVisible(true), delay);

    return () => {
      window.clearTimeout(timeoutId);
      setIsVisible(false);
    };
  }, [delay]);

  return isVisible;
};

function TerminalFrame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="access-ui-loader access-term" role="status" aria-label={title}>
      <div className="access-term-bar" aria-hidden="true">
        <span className="access-term-dot" />
        <span className="access-term-dot" />
        <span className="access-term-dot" />
        <div className="access-term-title">Ritual Staking</div>
      </div>
      <div className="access-gate-body access-terminal-screen access-term-body" role="log" aria-live="polite">
        {children}
      </div>
    </div>
  );
}

function TerminalProgress({ delay }: { delay: number }) {
  return (
    <div
      className="access-term-progress-row"
      style={getProgressStyle(delay, Math.max(360, CHECKING_HOLD_MS - 220))}
      aria-hidden="true"
    >
      <div className="access-term-progress">
        <span className="access-term-fill" />
        <span className="access-term-glint" />
      </div>
    </div>
  );
}

function TerminalOutputLine({
  label,
  output,
  delay,
  checking,
  tone,
}: Required<Pick<TerminalLineProps, "output" | "delay" | "checking">> &
  Pick<TerminalLineProps, "label" | "tone">) {
  const toneClass = tone ? ` ${tone}` : "";
  const checkingClass = checking ? " checking" : "";
  const hasTag = Boolean(label || tone || checking);
  const tagText = tone === "error" ? "!" : tone === "warn" || checking ? "●" : "✓";

  return (
    <div
      className={`access-terminal-motion-line access-terminal-result-line access-term-line access-term-line-output${toneClass}${checkingClass}`}
      style={getLineStyle(delay)}
    >
      {hasTag ? (
        <span className={`access-term-tag access-term-tag-${tone ?? "ok"}`} aria-hidden="true">
          {tagText}
        </span>
      ) : (
        <span className="access-term-prefix" aria-hidden="true">
          ›
        </span>
      )}
      <span className="access-term-text">
        {label ? (
          <>
            <span className="access-terminal-inline-label">[{label}]</span>{" "}
          </>
        ) : null}
        {output}
      </span>
    </div>
  );
}

function TerminalLine({
  command,
  label,
  output,
  delay = 0,
  checking = false,
  tone,
}: TerminalLineProps) {
  const { typedText: typedCommand, isTyping } = useTypedText(command ?? "", delay);
  const commandComplete = !command || typedCommand.length >= command.length;
  const outputDelay = getOutputDelay(command, delay);
  const progressDelay = outputDelay + 160;

  return (
    <div className="access-terminal-motion-group">
      {command ? (
        <>
          <div className="access-terminal-motion-line access-term-line access-term-line-command" style={getLineStyle(delay)}>
            <span className="access-term-prompt">$</span>
            <span className="access-term-code">
              <span className="access-terminal-typed-code">{typedCommand}</span>
              {isTyping && !commandComplete ? <span className="access-term-cursor" aria-hidden="true" /> : null}
            </span>
          </div>
          <TerminalOutputLine
            output={output}
            delay={outputDelay}
            checking={checking}
            tone={tone}
          />
          {checking ? <TerminalProgress delay={progressDelay} /> : null}
        </>
      ) : (
        <TerminalOutputLine
          label={label}
          output={output}
          delay={outputDelay}
          checking={checking}
          tone={tone}
        />
      )}
    </div>
  );
}

function TerminalPromptCursor({ delay }: { delay: number }) {
  const isVisible = useVisibleAfter(delay);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="access-terminal-motion-line access-term-line access-term-line-command access-terminal-final-prompt"
      style={getLineStyle(0)}
    >
      <span className="access-term-prompt">$</span>
      <span className="access-term-code">
        <span className="access-term-cursor" aria-hidden="true" />
      </span>
    </div>
  );
}

function TerminalPromptAction({
  delay,
  label,
  pendingLabel,
  isPending = false,
  disabled = false,
  href,
  onClick,
  ariaLabel,
}: {
  delay: number;
  label: string;
  pendingLabel?: string;
  isPending?: boolean;
  disabled?: boolean;
  href?: string;
  onClick?: () => void;
  ariaLabel: string;
}) {
  const isVisible = useVisibleAfter(delay);
  const commandText = isPending && pendingLabel ? pendingLabel : label;
  const content = (
    <>
      <span className="access-terminal-prompt-command">{commandText}</span>
      {!disabled ? <span className="access-term-cursor" aria-hidden="true" /> : null}
    </>
  );

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="access-terminal-motion-line access-term-line access-terminal-action-line"
      style={getLineStyle(0)}
    >
      <span className="access-term-prompt">$</span>
      {href ? (
        <a className="access-terminal-prompt-action" href={href} aria-label={ariaLabel}>
          {content}
        </a>
      ) : (
        <button
          aria-label={ariaLabel}
          className="access-terminal-prompt-action"
          disabled={disabled || isPending}
          type="button"
          onClick={onClick}
        >
          {content}
        </button>
      )}
    </div>
  );
}

function TerminalConnectorActions({
  delay,
  connectors,
  isPending,
  onConnect,
}: {
  delay: number;
  connectors: readonly Connector[];
  isPending: boolean;
  onConnect: (connector: Connector) => void;
}) {
  const isVisible = useVisibleAfter(delay);

  if (!isVisible) {
    return null;
  }

  if (connectors.length === 0) {
    return (
      <div
        className="access-terminal-motion-line access-term-line access-terminal-action-line"
        style={getLineStyle(0)}
      >
        <span className="access-term-prompt">$</span>
        <button
          aria-label="No wallet connector available"
          className="access-terminal-prompt-action"
          disabled
          type="button"
        >
          <span className="access-terminal-prompt-command">
            no wallet connector available
          </span>
        </button>
      </div>
    );
  }

  return (
    <>
      {connectors.map((connector) => {
        const connectorLabel = getConnectorLabel(connector);

        return (
          <div
            key={`${connector.id}-${connector.name}`}
            className="access-terminal-motion-line access-term-line access-terminal-action-line"
            style={getLineStyle(0)}
          >
            <span className="access-term-prompt">$</span>
            <button
              aria-label={`Connect ${connectorLabel}`}
              className="access-terminal-prompt-action"
              disabled={isPending}
              type="button"
              onClick={() => onConnect(connector)}
            >
              <span className="access-terminal-prompt-command">
                {isPending
                  ? `await connectWallet("${connectorLabel}")`
                  : `run connectWallet("${connectorLabel}")`}
              </span>
              {!isPending ? (
                <span className="access-term-cursor" aria-hidden="true" />
              ) : null}
            </button>
          </div>
        );
      })}
    </>
  );
}

function StakeAccessSkeleton() {
  return (
    <section
      className="staking-dashboard stake-access-skeleton"
      aria-hidden="true"
    >
      <div className="staking-dashboard-head">
        <div>
          <div className="stake-skeleton-line short" />
          <div className="stake-skeleton-line title" />
          <div className="stake-skeleton-line copy" />
        </div>
        <div className="staking-wallet-panel">
          <span className="stake-skeleton-line micro" />
          <div className="stake-skeleton-line wallet" />
          <small className="stake-skeleton-line chain" />
        </div>
      </div>

      <div className="staking-config-note stake-skeleton-config">
        <span className="stake-skeleton-line notice" />
      </div>

      <div className="stake-swap-layout">
        <article className="stake-swap-card stake-skeleton-card">
          <div className="stake-swap-header">
            <span className="stake-skeleton-line code" />
            <strong className="stake-skeleton-line code short-code" />
          </div>
          <div className="stake-mode-toggle">
            <span className="stake-skeleton-tab active" />
            <span className="stake-skeleton-tab" />
          </div>
          <div className="stake-skeleton-token-field">
            <span className="stake-skeleton-line label" />
            <span className="stake-skeleton-amount-row">
              <span className="stake-skeleton-token-pill">
                <span className="stake-skeleton-token-dot" />
                <span className="stake-skeleton-line token-name" />
              </span>
              <span className="stake-skeleton-line amount" />
            </span>
          </div>
          <div className="swap-direction" aria-hidden="true">
            <span className="stake-skeleton-direction" />
          </div>
          <div className="stake-skeleton-token-field">
            <span className="stake-skeleton-line label" />
            <span className="stake-skeleton-amount-row">
              <span className="stake-skeleton-token-pill">
                <span className="stake-skeleton-token-dot alt" />
                <span className="stake-skeleton-line token-name wide" />
              </span>
              <span className="stake-skeleton-line amount" />
            </span>
          </div>
          <span className="stake-skeleton-action" />
          <div className="stake-rate-panel">
            <div>
              <span className="stake-skeleton-line rate-label" />
              <strong className="stake-skeleton-line rate-value" />
            </div>
            <div>
              <span className="stake-skeleton-line rate-label" />
              <strong className="stake-skeleton-line rate-value wide" />
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function AccessTerminalGate({
  title,
  heading,
  headingId,
  steps,
  finalPromptDelay,
  children,
}: {
  title: string;
  heading: string;
  headingId: string;
  steps: (TerminalLineProps & { delay: number })[];
  finalPromptDelay: number;
  children?: ReactNode;
}) {
  return (
    <section className="access-gate" aria-labelledby={headingId}>
      <div className="access-gate-card">
        <TerminalFrame title={title}>
          <h2 id={headingId} className="access-gate-title screen-reader-only">
            {heading}
          </h2>
          {steps.map((step, index) => (
            <TerminalLine key={`${step.command ?? step.label}-${index}`} {...step} />
          ))}
          {children ?? <TerminalPromptCursor delay={finalPromptDelay} />}
        </TerminalFrame>
      </div>
    </section>
  );
}

function StakeAccessScan({
  title,
  heading,
  steps,
  finalPromptDelay,
}: {
  title: string;
  heading: string;
  steps: (TerminalLineProps & { delay: number })[];
  finalPromptDelay: number;
}) {
  return (
    <section className="stake-access-shell" aria-live="polite" aria-busy="true">
      <StakeAccessSkeleton />
      <div className="stake-access-gate">
        <div className="stake-access-terminal">
          <TerminalFrame title={title}>
            <h2 className="access-gate-title screen-reader-only">
              {heading}
            </h2>
            {steps.map((step, index) => (
              <TerminalLine key={`${step.command ?? step.label}-${index}`} {...step} />
            ))}
            <TerminalPromptCursor delay={finalPromptDelay} />
          </TerminalFrame>
        </div>
      </div>
    </section>
  );
}

export function AccessGate({ children }: AccessGateProps) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { hasSBT: hasAccess, isLoading } = useHasSBT();
  const [mounted, setMounted] = useState(false);
  const [grantScanComplete, setGrantScanComplete] = useState(false);
  const [scanSession, setScanSession] = useState<{
    key: string | null;
    status: ScanSessionStatus;
  }>({
    key: null,
    status: "checking",
  });
  const shortAddress = getShortAddress(address);
  const accessScanSessionKey = getAccessScanSessionKey(address, SBT_CONTRACT);
  const scanSessionStatus =
    scanSession.key === accessScanSessionKey ? scanSession.status : "checking";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !accessScanSessionKey) {
      setScanSession({
        key: accessScanSessionKey,
        status: "fresh",
      });
      return;
    }

    setScanSession({
      key: accessScanSessionKey,
      status:
        window.sessionStorage.getItem(accessScanSessionKey) === "complete"
          ? "complete"
          : "fresh",
    });
  }, [accessScanSessionKey, mounted]);

  useEffect(() => {
    setGrantScanComplete(false);

    if (
      !mounted ||
      !isConnected ||
      isLoading ||
      !hasAccess ||
      scanSessionStatus === "checking"
    ) {
      return undefined;
    }

    if (scanSessionStatus === "complete") {
      setGrantScanComplete(true);
      return undefined;
    }

    const timeoutId = window.setTimeout(
      () => {
        if (accessScanSessionKey) {
          window.sessionStorage.setItem(accessScanSessionKey, "complete");
        }
        setGrantScanComplete(true);
      },
      ACCESS_GRANTED_REVEAL_MS,
    );

    return () => window.clearTimeout(timeoutId);
  }, [
    accessScanSessionKey,
    hasAccess,
    isConnected,
    isLoading,
    mounted,
    scanSessionStatus,
  ]);

  if (!mounted) {
    const { timedSteps, finalPromptDelay } = withTerminalTiming([
      {
        command: 'access.open({ route: "/stake" })',
        output: "waiting for wallet context",
      },
      {
        command: `identity.queue({ pass: "${config.sbtSymbol}" })`,
        checking: true,
        output: "preparing local access scan",
        tone: "warn",
      },
    ]);

    return (
      <AccessTerminalGate
        title="Preparing access check"
        heading="Preparing Access Check"
        headingId="preparing-access-title"
        steps={timedSteps}
        finalPromptDelay={finalPromptDelay}
      />
    );
  }

  if (!isConnected) {
    const { timedSteps, finalPromptDelay } = withTerminalTiming([
      {
        command: 'access.open({ route: "/stake" })',
        output: "route requires wallet context",
      },
      {
        command: `identity.check({ pass: "${config.sbtSymbol}" })`,
        checking: true,
        output: "paused: wallet is not connected",
        tone: "warn",
      },
      {
        label: "next",
        output: `connect wallet that holds ${config.sbtName}`,
        tone: "warn",
      },
    ]);

    return (
      <AccessTerminalGate
        title="Wallet access check"
        heading="Connect Wallet"
        headingId="connect-wallet-title"
        steps={timedSteps}
        finalPromptDelay={finalPromptDelay}
      >
        <TerminalConnectorActions
          connectors={connectors}
          delay={finalPromptDelay}
          isPending={isPending}
          onConnect={(connector) => connect({ connector })}
        />
      </AccessTerminalGate>
    );
  }

  if (isLoading) {
    const { timedSteps, finalPromptDelay } = withTerminalTiming([
      {
        command: "wallet()",
        output: "wallet loaded",
      },
      {
        command: "sbt()",
        checking: true,
        output: `checking ${config.chainName} for ${config.sbtSymbol}`,
        tone: "warn",
      },
      {
        label: "wallet",
        output: address ?? "unknown",
      },
    ]);

    return (
      <AccessTerminalGate
        title="Checking access pass"
        heading="Checking Access Pass"
        headingId="checking-access-title"
        steps={timedSteps}
        finalPromptDelay={finalPromptDelay}
      />
    );
  }

  if (!hasAccess) {
    const { timedSteps, finalPromptDelay } = withTerminalTiming([
      {
        command: `const wallet = "${shortAddress}";`,
        output: "wallet loaded",
      },
      {
        command: `identity.check({ wallet, pass: "${config.sbtSymbol}" })`,
        checking: true,
        output: "checking access credential",
        tone: "warn",
      },
      {
        command: 'if (!ownsPass) throw new AccessDenied("/stake");',
        output: `missing ${config.sbtSymbol}; route remains locked`,
        tone: "error",
      },
      {
        label: "required",
        output: config.sbtName,
      },
    ]);

    return (
      <AccessTerminalGate
        title="Access pass required"
        heading="Access Denied"
        headingId="access-required-title"
        steps={timedSteps}
        finalPromptDelay={finalPromptDelay}
      >
        <TerminalPromptAction
          ariaLabel="Go to mint page"
          delay={finalPromptDelay}
          href="/"
          label="run mintAccessPass()"
        />
      </AccessTerminalGate>
    );
  }

  if (scanSessionStatus === "checking") {
    const { timedSteps, finalPromptDelay } = withTerminalTiming([
      {
        command: `${config.tokenSymbol.toLowerCase()}.stake.session()`,
        checking: true,
        output: `restoring ${config.protocolName} access checkpoint`,
        tone: "warn",
      },
    ]);

    return (
      <AccessTerminalGate
        title="Restoring access"
        heading="Restoring Access State"
        headingId="restoring-access-title"
        steps={timedSteps}
        finalPromptDelay={finalPromptDelay}
      />
    );
  }

  if (!grantScanComplete) {
    const { timedSteps, finalPromptDelay } = withTerminalTiming([
      {
        command: "wallet()",
        output: `wallet loaded: ${shortAddress}`,
      },
      {
        command: "sbt()",
        checking: true,
        output: `reading ${config.sbtSymbol} before staking console`,
        tone: "warn",
      },
      {
        label: "access",
        output: "granted; staking console loading",
        tone: "ok",
      },
    ]);

    return (
      <StakeAccessScan
        title="Access pass verified"
        heading="Access Granted"
        steps={timedSteps}
        finalPromptDelay={finalPromptDelay}
      />
    );
  }

  return <>{children}</>;
}
