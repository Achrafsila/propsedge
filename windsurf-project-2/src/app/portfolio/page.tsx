import { redirect } from "next/navigation";

// Legacy Personal Broker URL. Preserve browser-local data; do not render
// broker screens or expose them during client-side hydration.
export default function DeprecatedBrokerRoute() {
  redirect("/dashboard");
}
