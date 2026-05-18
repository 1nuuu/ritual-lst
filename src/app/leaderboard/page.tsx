import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";

export default function LeaderboardPage() {
  return (
    <>
      <Nav />
      <main className="feature-page leaderboard-page">
        <div className="feature-page-shell">
          <header className="leaderboard-header">
            <div>
              <span className="feature-kicker">Ritual Testnet</span>
              <h1 className="feature-title">Leaderboard</h1>
              <p className="feature-subtitle">
                Top stakers by volume on Ritual Testnet
              </p>
            </div>

            <div className="leaderboard-actions">
              <span className="status-badge">Coming Soon</span>
            </div>
          </header>

          <section
            className="leaderboard-table-card"
            aria-label="Leaderboard coming soon"
          >
            <div className="leaderboard-empty">
              <p>
                <strong>Leaderboard coming soon</strong>
              </p>
              <p>
                Rankings for top stakers on Ritual Testnet will appear here once
                on-chain event indexing is available.
              </p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
