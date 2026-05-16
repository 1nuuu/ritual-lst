import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";

const assistantFeatures = [
  {
    icon: "YLD",
    title: "Yield Analysis",
    description: "AI-powered APY forecasting",
  },
  {
    icon: "RSK",
    title: "Risk Assessment",
    description: "Real-time pool health monitoring",
  },
  {
    icon: "PRT",
    title: "Portfolio Advice",
    description: "Personalized staking recommendations",
  },
] as const;

export default function AssistantPage() {
  return (
    <>
      <Nav />
      <main className="feature-page assistant-page">
        <div className="feature-page-shell">
          <section
            className="terminal-panel assistant-terminal"
            aria-labelledby="assistant-title"
          >
            <div className="terminal-panel-top">
              <div className="terminal-dots" aria-hidden="true">
                <span className="terminal-dot" />
                <span className="terminal-dot" />
                <span className="terminal-dot" />
              </div>
              <span className="terminal-path">/ritual/assistant</span>
            </div>

            <div className="assistant-content">
              <div className="assistant-heading-row">
                <div>
                  <span className="feature-kicker">Protocol Intelligence</span>
                  <h1 id="assistant-title">Assistant</h1>
                  <p>AI-Powered Staking Intelligence</p>
                </div>
                <span className="status-badge">Coming Soon</span>
              </div>

              <p className="assistant-body">
                The LST Protocol Assistant is being trained on Ritual Chain&apos;s
                AI infrastructure. It will analyze on-chain data, validator
                metrics, and protocol performance to help you make informed
                staking decisions.
              </p>

              <div className="assistant-preview-grid" aria-label="Feature previews">
                {assistantFeatures.map((feature) => (
                  <article className="assistant-feature-card" key={feature.title}>
                    <span className="assistant-feature-icon" aria-hidden="true">
                      {feature.icon}
                    </span>
                    <h2>{feature.title}</h2>
                    <p>{feature.description}</p>
                    <span className="assistant-feature-lock">Coming Soon</span>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
