"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useConnect,
  useEstimateFeesPerGas,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { BaseError, decodeEventLog, formatEther, parseGwei } from "viem";
import { WalletSelectModal } from "@/components/WalletSelectModal";
import { config } from "@/lib/config";
import { ritualChain } from "@/lib/chain";
import {
  getIpfsGatewayUrls,
  getSbtExplorerUrl,
  isSbtConfigured,
  puffSbtAbi,
  requireSbtContract,
  SBT_CONTRACT,
} from "@/lib/sbt";
import type { Connector } from "wagmi";

const MINT_GAS_LIMIT = BigInt(160000);
const FALLBACK_MAX_FEE_PER_GAS = parseGwei("2");
const FALLBACK_MAX_PRIORITY_FEE_PER_GAS = parseGwei("1");

type MintPhase =
  | "idle"
  | "connecting"
  | "minting"
  | "confirming"
  | "success"
  | "error"
  | "already-minted"
  | "sold-out";

interface MintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SbtMetadata = {
  name?: string;
  description?: string;
  image?: string;
};

const formatTokenSerial = (value: string | null) =>
  value ? value.padStart(3, "0") : null;

const withCacheBuster = (url: string) => {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}t=${Date.now()}`;
};

const fetchMetadataFromGateways = async (
  uri: string,
): Promise<SbtMetadata | null> => {
  for (const metadataUrl of getIpfsGatewayUrls(uri)) {
    try {
      const response = await fetch(withCacheBuster(metadataUrl), {
        cache: "no-store",
      });

      if (!response.ok) {
        continue;
      }

      return (await response.json()) as SbtMetadata;
    } catch {
      continue;
    }
  }

  return null;
};

const resolveImageFromGateways = async (uri: string) => {
  for (const imageUrl of getIpfsGatewayUrls(uri)) {
    try {
      const response = await fetch(withCacheBuster(imageUrl), {
        cache: "no-store",
      });

      if (response.ok) {
        return imageUrl;
      }
    } catch {
      continue;
    }
  }

  return null;
};

export function MintModal({ isOpen, onClose }: MintModalProps) {
  const { address, chain, isConnected } = useAccount();
  const router = useRouter();
  const { connect, connectors, isPending: isConnectPending } = useConnect();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: ritualChain.id });
  const feeEstimate = useEstimateFeesPerGas({
    chainId: ritualChain.id,
    query: {
      enabled: isOpen,
    },
  });
  const mintPriceRead = useReadContract({
    address: SBT_CONTRACT,
    abi: puffSbtAbi,
    functionName: "MINT_PRICE",
    query: {
      enabled: isSbtConfigured,
    },
  });
  const ownerRead = useReadContract({
    address: SBT_CONTRACT,
    abi: puffSbtAbi,
    functionName: "owner",
    query: {
      enabled: isSbtConfigured,
    },
  });
  const maxSupplyRead = useReadContract({
    address: SBT_CONTRACT,
    abi: puffSbtAbi,
    functionName: "maxSupply",
    query: {
      enabled: isSbtConfigured,
    },
  });
  const hardMaxSupplyRead = useReadContract({
    address: SBT_CONTRACT,
    abi: puffSbtAbi,
    functionName: "HARD_MAX_SUPPLY",
    query: {
      enabled: isSbtConfigured,
    },
  });
  const {
    data: totalSupplyData,
    refetch: refetchTotalSupply,
  } = useReadContract({
    address: SBT_CONTRACT,
    abi: puffSbtAbi,
    functionName: "totalSupply",
    query: {
      enabled: isSbtConfigured,
    },
  });
  const {
    writeContract,
    data: txHash,
    error: writeError,
    isPending,
    reset: resetWrite,
  } = useWriteContract();
  const { data: receipt, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  const [phase, setPhase] = useState<MintPhase>("idle");
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [sbtImageUrl, setSbtImageUrl] = useState<string | null>(null);
  const [sbtMetadataName, setSbtMetadataName] = useState<string | null>(null);
  const [isSbtImageLoading, setIsSbtImageLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const mintPrice = mintPriceRead.data as bigint | undefined;
  const maxFeePerGas =
    feeEstimate.data?.maxFeePerGas ?? FALLBACK_MAX_FEE_PER_GAS;
  const maxPriorityFeePerGas =
    feeEstimate.data?.maxPriorityFeePerGas ??
    FALLBACK_MAX_PRIORITY_FEE_PER_GAS;
  const feeRecipient = ownerRead.data as `0x${string}` | undefined;
  const maxSupply = maxSupplyRead.data as bigint | undefined;
  const hardMaxSupply = hardMaxSupplyRead.data as bigint | undefined;
  const totalMinted = totalSupplyData as bigint | undefined;
  const tokenSerial = formatTokenSerial(tokenId);
  const mintPriceLabel =
    mintPrice === undefined
      ? "Loading..."
      : `${formatEther(mintPrice)} ${config.tokenSymbol}`;
  const feeRecipientLabel = feeRecipient
    ? `${feeRecipient.slice(0, 6)}...${feeRecipient.slice(-4)}`
    : "Loading...";
  const supplyLabel =
    maxSupply === undefined || totalMinted === undefined
      ? "Loading..."
      : `${totalMinted.toString()} / ${maxSupply.toString()}`;
  const limitLabel =
    maxSupply === undefined
      ? "Loading..."
      : `1 per wallet / ${maxSupply.toString()} total`;
  const soldOut =
    maxSupply !== undefined &&
    totalMinted !== undefined &&
    totalMinted >= maxSupply;
  const contractReady =
    isSbtConfigured &&
    mintPrice !== undefined &&
    maxSupply !== undefined &&
    totalMinted !== undefined;
  const explorerTxUrl = txHash ? getSbtExplorerUrl(txHash) : undefined;
  const successTitle = tokenSerial
    ? `${config.protocolName} Pass #${tokenSerial}`
    : `${config.protocolName} Pass`;
  const isSuccessView = phase === "success";

  useEffect(() => {
    if (!isOpen) return;
    setPhase(isConnected ? "idle" : "connecting");
    setTokenId(null);
    setSbtImageUrl(null);
    setSbtMetadataName(null);
    setIsSbtImageLoading(false);
    setConfigError(null);
    setShowWalletModal(false);
    resetWrite();
  }, [isOpen, isConnected, resetWrite]);

  useEffect(() => {
    if (
      phase !== "success" ||
      !tokenId ||
      !publicClient ||
      !SBT_CONTRACT
    ) {
      return;
    }

    let cancelled = false;
    const loadMetadata = async () => {
      setIsSbtImageLoading(true);
      setSbtImageUrl(null);
      setSbtMetadataName(null);

      try {
        const tokenUri = await publicClient.readContract({
          address: requireSbtContract(),
          abi: puffSbtAbi,
          functionName: "tokenURI",
          args: [BigInt(tokenId)],
        });
        const metadata = await fetchMetadataFromGateways(String(tokenUri));
        if (!metadata) {
          if (!cancelled) {
            setSbtImageUrl(null);
            setSbtMetadataName(null);
          }
          return;
        }

        const imageUrl = metadata.image
          ? await resolveImageFromGateways(metadata.image)
          : null;

        if (cancelled) return;
        setSbtMetadataName(metadata.name ?? null);
        setSbtImageUrl(imageUrl);
      } catch {
        if (!cancelled) {
          setSbtImageUrl(null);
          setSbtMetadataName(null);
        }
      } finally {
        if (!cancelled) {
          setIsSbtImageLoading(false);
        }
      }
    };

    loadMetadata();

    return () => {
      cancelled = true;
    };
  }, [phase, publicClient, tokenId]);

  useEffect(() => {
    if (writeError) {
      const errorMessage =
        writeError instanceof BaseError
          ? writeError.shortMessage
          : writeError.message;
      setConfigError(errorMessage || "Transaction failed.");
      setPhase(
        writeError.message?.includes("AlreadyMinted")
          ? "already-minted"
          : writeError.message?.includes("MaxSupplyReached")
            ? "sold-out"
            : "error",
      );
      return;
    }

    if (txHash && !isConfirmed) {
      setPhase("confirming");
    }

    if (isConfirmed && receipt) {
      if (receipt.status === "reverted") {
        setConfigError("Transaction reverted on-chain.");
        setPhase("error");
        return;
      }

      setPhase("success");
      refetchTotalSupply();
      try {
        const mintedLog = receipt.logs.find((log) => {
          try {
            const decoded = decodeEventLog({
              abi: puffSbtAbi,
              data: log.data,
              topics: log.topics,
            });
            return decoded.eventName === "Minted";
          } catch {
            return false;
          }
        });

        if (mintedLog) {
          const decoded = decodeEventLog({
            abi: puffSbtAbi,
            data: mintedLog.data,
            topics: mintedLog.topics,
          });
          setTokenId(String((decoded.args as { tokenId: bigint }).tokenId));
        }
      } catch {
        setTokenId(null);
      }
    }
  }, [writeError, txHash, isConfirmed, receipt, refetchTotalSupply]);

  useEffect(() => {
    if (phase === "connecting" && isConnected) {
      setPhase("idle");
    }
  }, [isConnected, phase]);

  useEffect(() => {
    if (phase !== "success" && phase !== "already-minted") {
      return;
    }

    const timer = window.setTimeout(() => {
      router.replace("/stake");
    }, 6000);

    return () => window.clearTimeout(timer);
  }, [phase, router]);

  const handleMint = useCallback(() => {
    if (!isSbtConfigured) {
      setConfigError("SBT contract is not deployed yet.");
      setPhase("error");
      return;
    }

    if (mintPrice === undefined) {
      setConfigError("Could not read mint price from contract.");
      setPhase("error");
      return;
    }

    if (!contractReady) {
      setConfigError(
        "Contract must expose MINT_PRICE, maxSupply, and totalSupply before minting.",
      );
      setPhase("error");
      return;
    }

    if (soldOut) {
      setPhase("sold-out");
      return;
    }

    if (chain?.id !== ritualChain.id) {
      setConfigError(`Wallet must be on ${config.chainName}.`);
      setPhase("error");
      switchChain?.({ chainId: ritualChain.id });
      return;
    }

    setPhase("minting");
    writeContract({
      address: requireSbtContract(),
      abi: puffSbtAbi,
      functionName: "mint",
      chainId: ritualChain.id,
      gas: MINT_GAS_LIMIT,
      maxFeePerGas,
      maxPriorityFeePerGas,
      value: mintPrice,
    });
  }, [
    chain?.id,
    contractReady,
    maxFeePerGas,
    maxPriorityFeePerGas,
    mintPrice,
    soldOut,
    switchChain,
    writeContract,
  ]);

  const handleWalletSelect = useCallback((connector: Connector) => {
    setShowWalletModal(false);
    connect({ connector });
  }, [connect]);

  if (!isOpen) return null;

  return (
    <>
      <div className="mint-backdrop" onClick={onClose} />

      <div
        className={`mint-modal${isSuccessView ? " mint-modal-success" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={isSuccessView ? "Mint successful" : "Mint SBT"}
      >
        <div className={`mint-header${isSuccessView ? " success-header" : ""}`}>
          <span className="mint-title">Mint SBT</span>
          <button className="mint-close" onClick={onClose} aria-label="Close">
            x
          </button>
        </div>

        <div className="mint-body">
          {isSuccessView ? (
            <div className="sbt-success-card" role="status" aria-label="Mint successful">
              <div className="sbt-success-art">
                <div className="sbt-success-frame">
                  {sbtImageUrl ? (
                    <img
                      src={sbtImageUrl}
                      alt={sbtMetadataName ?? config.sbtName}
                      className="sbt-success-image"
                      onError={() => setSbtImageUrl(null)}
                    />
                  ) : isSbtImageLoading ? (
                    <span className="sbt-success-loading">loading nft image</span>
                  ) : (
                    <span className="sbt-success-fallback">{config.sbtSymbol}</span>
                  )}
                </div>
              </div>
              <div className="sbt-success-copy">
                <span className="sbt-success-kicker">Mint successful</span>
                <strong>{successTitle}</strong>
                <p>
                  You received {sbtMetadataName ?? config.sbtName} as a
                  soulbound ERC-721 NFT identity pass for access to{" "}
                  {config.protocolName}.
                </p>
              </div>
              {explorerTxUrl && (
                <a
                className="btn sbt-explorer-button"
                href={explorerTxUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                  <span>View in Explorer</span>
                  <span aria-hidden="true">-&gt;</span>
                </a>
              )}
            </div>
          ) : (
            <>
              <div className="mint-terminal">
                <div className="lt-line cmd">
                  <span className="lt-prompt">&gt;</span>
                  <span className="lt-text">
                    identity.mint({"value: " + mintPriceLabel})
                  </span>
                </div>

                {phase === "connecting" && (
                  <div className="lt-line normal">
                    <span className="lt-prompt" />
                    <span className="lt-text">  awaiting wallet connection...</span>
                  </div>
                )}

                {isConnected && (
                  <div className="lt-line normal">
                    <span className="lt-prompt" />
                    <span className="lt-text">
                      {"  wallet: " + address?.slice(0, 6) + "..." + address?.slice(-4)}
                    </span>
                  </div>
                )}

                {(phase === "minting" || isPending) && (
                  <div className="lt-line normal">
                    <span className="lt-prompt" />
                    <span className="lt-text">  submitting transaction...</span>
                  </div>
                )}

                {phase === "confirming" && (
                  <div className="lt-line normal">
                    <span className="lt-prompt" />
                    <span className="lt-text">  waiting for confirmation...</span>
                  </div>
                )}

                {txHash && phase !== "error" && (
                  <div className="lt-line normal">
                    <span className="lt-prompt" />
                    <span className="lt-text">
                      {"  tx: "}
                      <a
                        href={getSbtExplorerUrl(txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {txHash.slice(0, 10)}...{txHash.slice(-6)}
                      </a>
                    </span>
                  </div>
                )}

                {phase === "already-minted" && (
                  <div className="lt-line success">
                    <span className="lt-prompt" />
                    <span className="lt-text">
                      {`  ok ${config.sbtName} already minted - access granted.`}
                    </span>
                  </div>
                )}

                {phase === "sold-out" && (
                  <div className="lt-line" style={{ color: "var(--gold)" }}>
                    <span className="lt-prompt" />
                    <span className="lt-text">  all identity passes have been minted.</span>
                  </div>
                )}

                {phase === "error" && (
                  <div className="lt-line" style={{ color: "var(--red)" }}>
                    <span className="lt-prompt" />
                    <span className="lt-text">
                      {`  ${configError ?? "transaction failed. try again."}`}
                    </span>
                  </div>
                )}

                {(phase === "idle" || phase === "connecting") && (
                  <div className="lt-line cmd">
                    <span className="lt-prompt">&gt;</span>
                    <span className="lt-text">
                      <span className="lt-cursor" />
                    </span>
                  </div>
                )}
              </div>

              <div className="mint-info">
                <div className="mint-info-row">
                  <span>NFT</span>
                  <span>
                    {config.sbtName} ({config.sbtSymbol})
                  </span>
                </div>
                <div className="mint-info-row">
                  <span>Standard</span>
                  <span>ERC-721 NFT / ERC-5192 Soulbound</span>
                </div>
                <div className="mint-info-row">
                  <span>Description</span>
                  <span>
                    Non-transferable NFT identity pass for {config.protocolName}
                  </span>
                </div>
                <div className="mint-info-row">
                  <span>Price</span>
                  <span style={{ color: "var(--green)" }}>{mintPriceLabel}</span>
                </div>
                <div className="mint-info-row">
                  <span>Author</span>
                  <span title={feeRecipient}>{feeRecipientLabel}</span>
                </div>
                <div className="mint-info-row">
                  <span>Network</span>
                  <span>{config.chainName}</span>
                </div>
                <div className="mint-info-row">
                  <span>Status</span>
                  <span
                    style={{
                      color: soldOut
                        ? "var(--gold)"
                        : contractReady
                          ? "var(--green)"
                          : "var(--gold)",
                    }}
                  >
                    {soldOut
                      ? "Sold Out"
                      : contractReady
                        ? "Ready"
                        : isSbtConfigured
                          ? "Reading Contract"
                          : "Awaiting Deploy"}
                  </span>
                </div>
                <div className="mint-info-row">
                  <span>Supply</span>
                  <span>{supplyLabel}</span>
                </div>
                <div className="mint-info-row">
                  <span>Limit</span>
                  <span>{limitLabel}</span>
                </div>
                <div className="mint-info-row">
                  <span>Hard Cap</span>
                  <span>
                    {hardMaxSupply === undefined
                      ? "Loading..."
                      : hardMaxSupply.toString()}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {!isSuccessView && (
          <div className="mint-footer">
            {!isConnected ? (
              <button
                className="btn mint-btn"
                onClick={() => setShowWalletModal(true)}
              >
                <span>Connect Wallet</span>
              </button>
            ) : phase === "already-minted" ? (
              <button className="btn mint-btn minted" onClick={onClose}>
                <span>Done</span>
              </button>
            ) : phase === "error" ? (
              <button
                className="btn mint-btn"
                onClick={handleMint}
                disabled={!contractReady}
              >
                <span>{contractReady ? "Retry" : "Contract Read Required"}</span>
              </button>
            ) : phase === "sold-out" || soldOut ? (
              <button className="btn mint-btn" disabled>
                <span>Sold Out</span>
              </button>
            ) : (
              <button
                className="btn mint-btn"
                onClick={handleMint}
                disabled={
                  !contractReady ||
                  isPending ||
                  phase === "minting" ||
                  phase === "confirming"
                }
              >
                <span>
                  {!contractReady
                    ? "Reading Contract..."
                    : isPending || phase === "minting"
                      ? "Minting..."
                      : `Mint for ${mintPriceLabel}`}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
      <WalletSelectModal
        connectors={connectors}
        isOpen={showWalletModal}
        isPending={isConnectPending}
        onClose={() => setShowWalletModal(false)}
        onConnect={handleWalletSelect}
      />
    </>
  );
}
