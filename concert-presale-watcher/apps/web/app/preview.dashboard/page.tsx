import { notFound } from "next/navigation";
import PreviewDashboard from "./PreviewDashboard";

export const metadata = { title: "Dashboard preview", robots: { index: false } };

/**
 * Dev-only: the dashboard with mocked API data, no sign-in needed.
 * The auth proxy skips paths containing a dot, so this route is reachable
 * logged out. It 404s in production builds.
 *
 *   http://localhost:3000/preview.dashboard          sample feed
 *   http://localhost:3000/preview.dashboard?empty    first-run empty state
 */
export default function PreviewDashboardPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PreviewDashboard />;
}
