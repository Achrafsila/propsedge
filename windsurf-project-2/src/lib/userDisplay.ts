import type { User } from "@supabase/supabase-js";

// Same fallback chain already used in src/app/settings/page.tsx — kept here
// too since the Morning Briefing needs it independently and duplicating a
// one-line chain is preferable to a cross-page import into a settings page.
export function getResolvedDisplayName(user: Pick<User, "user_metadata" | "email"> | null | undefined): string {
  return user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email?.split("@")[0] ?? "User";
}

// First whitespace token of the resolved display name — for "Good morning,
// {FirstName}" greetings, where a full name or email-local-part would read
// as too formal/long.
export function getFirstName(user: Pick<User, "user_metadata" | "email"> | null | undefined): string {
  const resolved = getResolvedDisplayName(user);
  return resolved.split(/\s+/)[0] || resolved;
}
