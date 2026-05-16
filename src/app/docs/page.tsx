"use client";

import { useEffect, useState } from "react";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";

const RITUAL_LST_ADDRESS = "0x7ccfEcd93Cb3Bf48BDa747De884d0d5F11Fc7B35";
const RITUAL_SBT_ADDRESS = "0xbeF776D31F0fb4F141e12443Eb0956F5fBd75398";
const RITUAL_RPC_URL = "https://rpc.ritualfoundation.org";
const RITUAL_EXPLORER_URL = "https://explorer.ritualfoundation.org";
const RITUAL_CHAIN_ID = 1979;

const docSections = [
  { id: "overview", label: "Overview" },
  { id: "how-it-works", label: "How It Works" },
  { id: "access-pass", label: "Access Pass" },
  { id: "smart-contracts", label: "Smart Contracts" },
  { id: "faq", label: "FAQ" },
] as const;

const howItWorksSteps = [
  {
    title: "Mint Access Pass",
    description:
      "Mint an SBT (Soulbound Token) to access the protocol. Cost: 0.01 RITUAL.",
  },
  {
    title: "Stake RITUAL",
    description:
      "Deposit native RITUAL and receive xRITUAL at the current exchange rate.",
  },
  {
    title: "Earn Yield",
    description:
      "Your xRITUAL appreciates in value as validator rewards accrue to the protocol.",
  },
  {
    title: "Unstake",
    description:
      "Burn xRITUAL to initiate withdrawal. Unbonding period: ~10 minutes on testnet.",
  },
  {
    title: "Claim",
    description: "After unbonding period ends, claim your RITUAL.",
  },
] as const;

const contracts = [
  {
    name: "RitualLST (xRITUAL)",
    address: RITUAL_LST_ADDRESS,
    description: "Staking pool and xRITUAL token",
  },
  {
    name: "RitualSBT",
    address: RITUAL_SBT_ADDRESS,
    description: "Access pass NFT",
  },
] as const;

type SectionId = (typeof docSections)[number]["id"];
type ContractAddress = (typeof contracts)[number]["address"];

const explorerAddressUrl = (address: string) =>
  `${RITUAL_EXPLORER_URL}/address/${address}`;

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [copiedAddress, setCopiedAddress] = useState<ContractAddress | null>(
    null,
  );

  useEffect(() => {
    const observers = docSections
      .map((section) => document.getElementById(section.id))
      .filter((section): section is HTMLElement => Boolean(section))
      .map((section) => {
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              setActiveSection(section.id as SectionId);
            }
          },
          {
            rootMargin: "-30% 0px -55% 0px",
            threshold: 0,
          },
        );

        observer.observe(section);
        return observer;
      });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, []);

  const copyAddress = (address: ContractAddress) => {
    void window.navigator.clipboard.writeText(address).then(() => {
      setCopiedAddress(address);
      window.setTimeout(() => setCopiedAddress(null), 1400);
    });
  };

  return (
    <>
      <Nav />
      <main className="feature-page docs-page">
        <div className="feature-page-shell docs-layout">
          <aside className="docs-sidebar" aria-label="Documentation sections">
            <p className="docs-sidebar-label">Docs</p>
            {docSections.map((section) => (
              <a
                key={section.id}
                className={`docs-link ${
                  activeSection === section.id ? "active" : ""
                }`}
                href={`#${section.id}`}
                aria-current={
                  activeSection === section.id ? "location" : undefined
                }
              >
                {section.label}
              </a>
            ))}
          </aside>

          <div className="docs-main">
            <section className="docs-section" id="overview">
              <span className="feature-kicker">Overview</span>
              <h1>LST Protocol</h1>
              <p className="docs-subtitle">Liquid Staking on Ritual Chain</p>

              <p>
                LST Protocol is a liquid staking protocol built natively on
                Ritual Chain - the first blockchain with AI inference built into
                the protocol layer.
              </p>
              <p>
                Stake your native RITUAL tokens and receive xRITUAL, a liquid
                staking token that represents your staked position. Your RITUAL
                continues to earn yield while xRITUAL remains transferable and
                usable across the ecosystem.
              </p>
              <p>
                Built on Ritual to leverage on-chain AI for automated yield
                optimization, validator selection, and real-time protocol
                intelligence.
              </p>
            </section>

            <section className="docs-section" id="how-it-works">
              <span className="feature-kicker">Protocol Flow</span>
              <h2>How It Works</h2>

              <ol className="docs-steps">
                {howItWorksSteps.map((step, index) => (
                  <li className="docs-step" key={step.title}>
                    <span className="docs-step-index">{index + 1}</span>
                    <div>
                      <strong>{step.title}</strong>
                      <span>{step.description}</span>
                    </div>
                  </li>
                ))}
              </ol>

              <h3>Exchange Rate</h3>
              <p>
                The exchange rate between xRITUAL and RITUAL starts at 1:1 and
                increases over time as yield accrues. This means 1 xRITUAL will
                be worth more than 1 RITUAL after rewards are distributed.
              </p>

              <div className="docs-callout" id="apy-coming-soon">
                <h3>Why is APY showing &quot;Coming Soon&quot;?</h3>
                <p>
                  LST Protocol derives real yield from Ritual Chain validators.
                  Unlike protocols that simulate or estimate APY, our yield is
                  sourced directly from on-chain validator rewards.
                </p>
                <p>
                  Ritual&apos;s testnet validator infrastructure is currently in
                  early stages. The validator reward distribution mechanism -
                  which determines how staking yield is calculated and
                  distributed - has not yet been finalized by the Ritual team.
                </p>
                <p>
                  Once Ritual publishes the validator reward API and confirms
                  the reward distribution schedule, LST Protocol will activate
                  the automated yield engine using Ritual&apos;s HTTP precompile
                  (0x0801) and Scheduler (0x56e7) to fetch real validator data
                  and apply yield automatically.
                </p>
                <p>
                  APY will be displayed and activated as soon as the Ritual
                  testnet validator infrastructure matures. We are committed to
                  showing only real, verifiable yield - not fabricated numbers.
                </p>
              </div>
            </section>

            <section className="docs-section" id="access-pass">
              <span className="feature-kicker">Identity Layer</span>
              <h2>Access Pass (SBT)</h2>

              <p>
                Access to LST Protocol is gated by a Soulbound Token (SBT) - a
                non-transferable NFT that represents verified participation in
                the protocol.
              </p>

              <h3>Why is an Access Pass required?</h3>
              <p>
                The access pass serves as an identity layer during the testnet
                phase. It ensures that stakers are intentional participants, not
                bots or automated scripts.
              </p>

              <h3>How to mint:</h3>
              <ol className="docs-steps">
                <li className="docs-step">
                  <span className="docs-step-index">1</span>
                  <div>
                    <strong>Visit the LST Protocol homepage</strong>
                    <span>Open the homepage from this app.</span>
                  </div>
                </li>
                <li className="docs-step">
                  <span className="docs-step-index">2</span>
                  <div>
                    <strong>Click &apos;Mint Access Pass&apos;</strong>
                    <span>Start the access pass mint transaction.</span>
                  </div>
                </li>
                <li className="docs-step">
                  <span className="docs-step-index">3</span>
                  <div>
                    <strong>Pay 0.01 RITUAL mint fee</strong>
                    <span>Approve the transaction from your wallet.</span>
                  </div>
                </li>
                <li className="docs-step">
                  <span className="docs-step-index">4</span>
                  <div>
                    <strong>The SBT will be sent to your wallet</strong>
                    <span>The pass is bound to the minting wallet address.</span>
                  </div>
                </li>
              </ol>

              <p>
                <strong>Supply:</strong> 200 passes (current phase). Hard cap:
                1000 passes total.
              </p>
              <p>
                <strong>Important:</strong> The SBT is soulbound - it cannot be
                transferred, sold, or moved to another wallet. One pass per
                wallet address.
              </p>
            </section>

            <section className="docs-section" id="smart-contracts">
              <span className="feature-kicker">Deployments</span>
              <h2>Smart Contracts</h2>
              <p className="docs-subtitle">
                All contracts are deployed on Ritual Testnet (Chain ID:{" "}
                {RITUAL_CHAIN_ID})
              </p>

              <div className="docs-contract-table-wrap">
                <table className="docs-contract-table">
                  <thead>
                    <tr>
                      <th scope="col">Contract</th>
                      <th scope="col">Address</th>
                      <th scope="col">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map((contract) => (
                      <tr key={contract.address}>
                        <td>{contract.name}</td>
                        <td>
                          <div className="docs-address-tools">
                            <code className="docs-address">
                              {contract.address}
                            </code>
                            <button
                              className="docs-copy-btn"
                              type="button"
                              onClick={() => copyAddress(contract.address)}
                            >
                              {copiedAddress === contract.address
                                ? "Copied"
                                : "Copy"}
                            </button>
                            <a
                              className="docs-explorer-link"
                              href={explorerAddressUrl(contract.address)}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Explorer
                            </a>
                          </div>
                        </td>
                        <td>{contract.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="docs-chain-grid" aria-label="Network details">
                <article className="docs-chain-card">
                  <span>RPC</span>
                  <strong>{RITUAL_RPC_URL}</strong>
                </article>
                <article className="docs-chain-card">
                  <span>Explorer</span>
                  <a href={RITUAL_EXPLORER_URL} rel="noreferrer" target="_blank">
                    {RITUAL_EXPLORER_URL}
                  </a>
                </article>
                <article className="docs-chain-card">
                  <span>Chain ID</span>
                  <strong>{RITUAL_CHAIN_ID}</strong>
                </article>
              </div>
            </section>

            <section className="docs-section" id="faq">
              <span className="feature-kicker">Support</span>
              <h2>FAQ</h2>

              <div className="docs-faq">
                <article className="docs-faq-item">
                  <h3>Why is APY showing &quot;Coming Soon&quot;?</h3>
                  <p>
                    See the{" "}
                    <a href="#apy-coming-soon">
                      Why is APY showing Coming Soon
                    </a>{" "}
                    section above.
                  </p>
                </article>

                <article className="docs-faq-item">
                  <h3>What is xRITUAL?</h3>
                  <p>
                    xRITUAL is a liquid staking token that represents your
                    staked RITUAL. It appreciates in value as yield accrues,
                    meaning 1 xRITUAL will eventually be worth more than 1
                    RITUAL. You can unstake at any time by burning xRITUAL.
                  </p>
                </article>

                <article className="docs-faq-item">
                  <h3>How long is the unbonding period?</h3>
                  <p>
                    On testnet, the unbonding period is approximately 10
                    minutes (~1714 blocks at 350ms per block). On mainnet, this
                    will follow Ritual&apos;s official validator unbonding
                    schedule.
                  </p>
                </article>

                <article className="docs-faq-item">
                  <h3>Can I transfer my Access Pass?</h3>
                  <p>
                    No. The SBT is soulbound and permanently bound to your
                    wallet address. It cannot be transferred, sold, or moved.
                  </p>
                </article>

                <article className="docs-faq-item">
                  <h3>Is LST Protocol audited?</h3>
                  <p>
                    LST Protocol is currently in testnet phase. A full security
                    audit will be conducted before mainnet launch.
                  </p>
                </article>

                <article className="docs-faq-item">
                  <h3>What happens to my RITUAL during unbonding?</h3>
                  <p>
                    During the unbonding period, your RITUAL is held in the
                    staking contract and cannot be claimed until the period
                    ends. Your xRITUAL is burned immediately when you initiate
                    unstaking.
                  </p>
                </article>
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
