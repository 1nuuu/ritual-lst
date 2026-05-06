import Link from "next/link";
import { config } from "@/lib/config";

export default function NotFound() {
  return (
    <main className="not-found">
      <span className="section-label">404</span>
      <h1 className="hiw-h2">Page Not Found</h1>
      <p className="hiw-desc">
        This route is not available in {config.protocolName}.
      </p>
      <Link className="btn" href="/">
        <span>Return Home</span>
      </Link>
    </main>
  );
}
