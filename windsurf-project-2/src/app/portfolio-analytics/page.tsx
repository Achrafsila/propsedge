import { redirect } from "next/navigation";

// Deprecated broker analytics route. Browser-local broker data is preserved.
export default function DeprecatedBrokerAnalytics() {
  redirect("/dashboard");
}
