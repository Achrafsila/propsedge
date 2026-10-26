import { notFound } from "next/navigation";
import TeamDashboard from "./TeamDashboard";
export default function Page() {
  if (process.env.TEAMS_ENABLED !== "true") notFound();
  return <TeamDashboard />;
}
