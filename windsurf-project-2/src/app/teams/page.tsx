import { notFound } from "next/navigation";
import TeamsPage from "./TeamsPage";

/**
 * T1 rollout gate. Enable only after Teams RLS is applied and verified.
 * Server-side flag prevents premature access to unfinished workspace.
 */
export default function Page() {
  if (process.env.TEAMS_ENABLED !== "true") notFound();
  return <TeamsPage />;
}
