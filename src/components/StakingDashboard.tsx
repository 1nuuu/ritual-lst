"use client";

import { useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, useBalance, useSwitchChain } from "wagmi";
import { ritualChain } from "@/lib/chain";
import { config } from "@/lib/config";
import { useStaking } from "@/lib/hooks/useStaking";
import { isStakingPoolConfigured } from "@/lib/staking";

const ZERO = BigInt(0);

const formatAmount = (amount: bigint) => {
  const formatted = formatEther(amount);
  const [whole, decimals = ""] = formatted.split(".");
  const trimmedDecimals = decimals.slice(0, 4).replace(/0+$/, "");

  return trimmedDecimals ? `${whole}.${trimmedDecimals}` : whole;
};

const formatSwapDecimal = (value: string) => {
  const trimmed = value.trim();
  const [whole = "0", decimals = ""] = trimmed.split(".");
  const cleanWhole = whole || "0";
  const trimmedDecimals = decimals.slice(0, 6).replace(/0+$/, "");

  return trimmedDecimals ? `${cleanWhole}.${trimmedDecimals}` : cleanWhole;
};

const formatInputEcho = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return "-";
  }

  const numeric = Number(trimmed);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "0";
  }

  return formatSwapDecimal(trimmed);
};

const formatBasisPointAPR = (basisPoints: bigint) => {
  if (basisPoints === ZERO) {
    return "Coming Soon";
  }

  const whole = basisPoints / BigInt(100);
  const decimals = (basisPoints % BigInt(100)).toString().padStart(2, "0");

  return `${whole}.${decimals}%`;
};

const formatExchangeRate = (rate: bigint) => {
  const formatted = formatEther(rate);
  const [whole, decimals = ""] = formatted.split(".");
  const trimmedDecimals = decimals.slice(0, 4).replace(/0+$/, "");

  return trimmedDecimals ? `${whole}.${trimmedDecimals}` : whole;
};

type StakeMode = "stake" | "unstake";

type StatusFeedbackProps = {
  status: "idle" | "pending" | "success" | "error";
  error: string | null;
  formError: string | null;
  isWrongChain: boolean;
  action: "Stake" | "Unstake" | "Claim" | null;
};

type TokenFieldProps = {
  label: string;
  balanceLabel: string;
  symbol: string;
  value: string;
  editable?: boolean;
  onChange?: (value: string) => void;
  onMax?: () => void;
  accent: "ritual" | "receipt";
};

const getTokenKind = (symbol: string) =>
  symbol === config.lstSymbol ? "xritual" : "ritual";

function StatusFeedback({
  status,
  error,
  formError,
  isWrongChain,
  action,
}: StatusFeedbackProps) {
  if (isWrongChain) {
    return (
      <p className="tx-status error">
        Please switch to Ritual Chain to continue
      </p>
    );
  }

  if (formError) {
    return <p className="tx-status error">{formError}</p>;
  }

  const label = action ? `${action} transaction` : "Transaction";

  if (status === "pending") {
    return <p className="tx-status pending">{label} pending...</p>;
  }

  if (status === "success") {
    return <p className="tx-status success">{label} confirmed.</p>;
  }

  if (status === "error") {
    return <p className="tx-status error">{error ?? "Transaction failed."}</p>;
  }

  return null;
}

function TokenField({
  label,
  balanceLabel,
  symbol,
  value,
  editable = false,
  onChange,
  onMax,
  accent,
}: TokenFieldProps) {
  const tokenKind = getTokenKind(symbol);

  return (
    <label className="swap-token-field">
      <span className="swap-field-meta">
        <span>{label}</span>
        <span className="swap-balance-line">
          <span>{balanceLabel}</span>
          {onMax ? (
            <button className="swap-max" type="button" onClick={onMax}>
              Max
            </button>
          ) : null}
        </span>
      </span>
      <span className="swap-amount-row">
        <span className={`swap-token-pill ${accent} ${tokenKind}`}>
          <span className="ritual-token-logo" aria-hidden="true">
            <span className="ritual-logo-core" />
          </span>
          <span>{symbol}</span>
        </span>
        {editable ? (
          <input
            className="swap-amount-input"
            inputMode="decimal"
            min="0"
            placeholder="0.00"
            type="text"
            value={value}
            onChange={(event) => onChange?.(event.target.value)}
          />
        ) : (
          <output className="swap-amount-output">{value}</output>
        )}
      </span>
    </label>
  );
}

export function StakingDashboard() {
  const { address, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const [mode, setMode] = useState<StakeMode>("stake");
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<
    "Stake" | "Unstake" | "Claim" | null
  >(null);

  const {
    totalStaked,
    xRitualBalance,
    exchangeRate,
    currentAPR,
    unbondingRequest,
    blocksUntilClaimable,
    stake,
    unstake,
    claimUnstaked,
    isLoading,
    txStatus,
    txError,
  } = useStaking(address);

  const nativeBalance = useBalance({
    address,
    chainId: ritualChain.id,
    query: {
      enabled: Boolean(address),
    },
  });

  const parseInputAmount = (value: string, action: string) => {
    const trimmed = value.trim();

    if (!trimmed) {
      setFormError(`${action} amount is required.`);
      return null;
    }

    try {
      const parsed = parseEther(trimmed);

      if (parsed <= ZERO) {
        setFormError(`${action} amount must be greater than zero.`);
        return null;
      }

      setFormError(null);
      return parsed;
    } catch {
      setFormError(`Enter a valid ${action.toLowerCase()} amount.`);
      return null;
    }
  };

  const handleClaimUnstaked = () => {
    setFormError(null);
    setActiveAction("Claim");
    claimUnstaked();
  };

  const handleModeChange = (nextMode: StakeMode) => {
    setMode(nextMode);
    setFormError(null);
    setActiveAction(null);
  };

  const contractReady = isStakingPoolConfigured;
  const isWrongChain = Boolean(address && chain?.id !== ritualChain.id);
  const actionDisabled = isLoading || !contractReady || !address;
  const nativeBalanceValue = nativeBalance.data?.value ?? ZERO;

  const inputAmount = mode === "stake" ? stakeAmount : unstakeAmount;
  const receiveAmount = formatInputEcho(inputAmount);
  const inputSymbol = mode === "stake" ? config.tokenSymbol : config.lstSymbol;
  const receiveSymbol = mode === "stake" ? config.lstSymbol : config.tokenSymbol;
  const inputBalance =
    mode === "stake"
      ? `${formatAmount(nativeBalanceValue)} ${config.tokenSymbol}`
      : `${formatAmount(xRitualBalance)} ${config.lstSymbol}`;
  const receiveBalance =
    mode === "stake"
      ? `${formatAmount(xRitualBalance)} ${config.lstSymbol}`
      : `${formatAmount(nativeBalanceValue)} ${config.tokenSymbol}`;
  const primaryAction = mode === "stake" ? "Stake" : "Unstake";
  const primaryButtonCopy = !contractReady
    ? "Contracts Pending"
    : isLoading
      ? "Processing..."
      : `${primaryAction} ${inputSymbol}`;
  const ritualDisplayName =
    config.chainName.replace(/\s+chain$/i, "").trim() || config.chainName;
  const tokenDisplayName =
    config.tokenSymbol.toLowerCase() === ritualDisplayName.toLowerCase()
      ? ritualDisplayName
      : config.tokenSymbol;
  const hasActiveUnbonding = unbondingRequest.amount > ZERO;
  const unbondingMinutesRemaining = Math.ceil(
    (Number(blocksUntilClaimable) * 350) / 60000,
  );

  const handleSwitchNetwork = () => {
    switchChain({ chainId: ritualChain.id });
  };

  const handleStake = () => {
    if (isWrongChain) {
      handleSwitchNetwork();
      return;
    }

    const parsedAmount = parseInputAmount(stakeAmount, "Stake");

    if (parsedAmount) {
      setActiveAction("Stake");
      stake(parsedAmount);
    }
  };

  const handleUnstake = () => {
    if (isWrongChain) {
      handleSwitchNetwork();
      return;
    }

    const parsedAmount = parseInputAmount(unstakeAmount, "Unstake");

    if (parsedAmount) {
      setActiveAction("Unstake");
      unstake(parsedAmount);
    }
  };

  return (
    <section className="staking-dashboard" aria-labelledby="staking-dashboard-title">
      <div className="stake-simple-layout">
        <div className="staking-dashboard-head">
          <div>
            <h2 id="staking-dashboard-title" className="stake-title">
              Liquid Staking on {ritualDisplayName}
            </h2>
            <div className="stake-rule" aria-hidden="true" />
            <p className="stake-copy">
              Stay liquid and earn yield by staking your {tokenDisplayName}.
            </p>
          </div>
          <div className="stake-simple-metrics" aria-label="Staking overview">
            <div>
              <span>Total Staked</span>
              <strong>
                {formatAmount(totalStaked)} {config.tokenSymbol}
              </strong>
            </div>
            <div>
              <span>Your Stake</span>
              <strong>
                {formatAmount(xRitualBalance)} {config.lstSymbol}
              </strong>
            </div>
          </div>

          {hasActiveUnbonding ? (
            <article
              className={`unbonding-queue-card ${
                blocksUntilClaimable > ZERO
                  ? "unbonding-queue-card--pending"
                  : "unbonding-queue-card--ready"
              }`}
              aria-label="Unbonding status"
            >
              <div className="unbonding-queue-header">
                <span className="unbonding-queue-label">Withdrawal Queue</span>
                <span
                  className={`unbonding-queue-badge ${
                    blocksUntilClaimable > ZERO
                      ? "unbonding-queue-badge--pending"
                      : "unbonding-queue-badge--ready"
                  }`}
                >
                  {blocksUntilClaimable > ZERO ? "Unbonding" : "Ready"}
                </span>
              </div>

              <div className="unbonding-queue-body">
                <div className="unbonding-queue-row">
                  <span>Amount</span>
                  <strong>
                    {formatAmount(unbondingRequest.amount)} {config.tokenSymbol}
                  </strong>
                </div>
                <div className="unbonding-queue-row">
                  <span>Status</span>
                  <strong
                    className={
                      blocksUntilClaimable > ZERO
                        ? "unbonding-queue-countdown"
                        : "unbonding-queue-claimable"
                    }
                  >
                    {blocksUntilClaimable > ZERO
                      ? `~${unbondingMinutesRemaining} min remaining`
                      : "Claimable now"}
                  </strong>
                </div>
              </div>

              {blocksUntilClaimable === ZERO ? (
                <button
                  className="unbonding-claim-btn"
                  disabled={actionDisabled}
                  type="button"
                  onClick={handleClaimUnstaked}
                >
                  <span>Claim {config.tokenSymbol}</span>
                </button>
              ) : null}
            </article>
          ) : null}
        </div>

        <div className="stake-swap-layout">
          <article className="stake-swap-card">
            <span className="stake-card-bg" aria-hidden="true" />
            <span className="stake-card-blob" aria-hidden="true" />
            <div className="stake-swap-header">
              <span>{config.protocolName}</span>
              <strong>{mode === "stake" ? "Stake" : "Unstake"}</strong>
            </div>

            <div className="stake-mode-toggle" role="tablist" aria-label="Staking mode">
              <button
                className={mode === "stake" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={mode === "stake"}
                onClick={() => handleModeChange("stake")}
              >
                Stake
              </button>
              <button
                className={mode === "unstake" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={mode === "unstake"}
                onClick={() => handleModeChange("unstake")}
              >
                Unstake
              </button>
            </div>

            {!contractReady ? (
              <div className="staking-config-note" role="status">
                <span className="staking-config-dot" aria-hidden="true" />
                <span>
                  Staking contracts pending. Transactions are disabled until the
                  pool is configured.
                </span>
              </div>
            ) : null}

            <StatusFeedback
              status={txStatus}
              error={txError}
              formError={formError}
              isWrongChain={isWrongChain}
              action={activeAction}
            />

            <TokenField
              label={mode === "stake" ? "You Stake" : "You Unstake"}
              balanceLabel={inputBalance}
              symbol={inputSymbol}
              value={inputAmount}
              editable
              accent={mode === "stake" ? "ritual" : "receipt"}
              onChange={(value) => {
                setFormError(null);
                if (mode === "stake") {
                  setStakeAmount(value);
                } else {
                  setUnstakeAmount(value);
                }
              }}
              onMax={() => {
                setFormError(null);
                if (mode === "stake") {
                  setStakeAmount(formatAmount(nativeBalanceValue));
                } else {
                  setUnstakeAmount(formatAmount(xRitualBalance));
                }
              }}
            />

            <div className="swap-direction">
              <button
                className="swap-direction-button"
                type="button"
                aria-label={`Switch to ${mode === "stake" ? "unstake" : "stake"} mode`}
                title={`Switch to ${mode === "stake" ? "unstake" : "stake"}`}
                onClick={() =>
                  handleModeChange(mode === "stake" ? "unstake" : "stake")
                }
              >
                <svg
                  className="swap-direction-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M8 4v14" />
                  <path d="m4 14 4 4 4-4" />
                  <path d="M16 20V6" />
                  <path d="m12 10 4-4 4 4" />
                </svg>
              </button>
            </div>

            <TokenField
              label="You Receive"
              balanceLabel={`Balance ${receiveBalance}`}
              symbol={receiveSymbol}
              value={receiveAmount}
              accent={mode === "stake" ? "receipt" : "ritual"}
            />

            {isWrongChain ? (
              <button
                className="btn staking-action stake-swap-action"
                disabled={!address}
                type="button"
                onClick={handleSwitchNetwork}
              >
                <span>Switch Network</span>
              </button>
            ) : (
              <button
                className="btn staking-action stake-swap-action"
                disabled={actionDisabled}
                type="button"
                onClick={mode === "stake" ? handleStake : handleUnstake}
              >
                <span>{primaryButtonCopy}</span>
              </button>
            )}

            <div className="stake-rate-panel" aria-label="Staking rate details">
              <div>
                <span>APR</span>
                <strong>{formatBasisPointAPR(currentAPR)}</strong>
              </div>
              <div>
                <span>Exchange</span>
                <strong>
                  1 {config.lstSymbol} = {formatExchangeRate(exchangeRate)}{" "}
                  {config.tokenSymbol}
                </strong>
              </div>
            </div>

          </article>
        </div>
      </div>
    </section>
  );
}
