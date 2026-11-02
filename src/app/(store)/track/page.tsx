import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Track Order redirects directly to the official Burnout Wheels Discord server
 * where customers track their order and get live updates from the crew in real time.
 */
export default function TrackPage() {
  redirect("https://discord.gg/WRZDQEnA2");
}
