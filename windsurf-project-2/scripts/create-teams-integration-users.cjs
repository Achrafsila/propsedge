#!/usr/bin/env node
/**
 * One-time PropsEdge Teams integration identities.
 * Run locally only. NEVER commit or print the Supabase secret key.
 * SUPABASE_SERVICE_ROLE_KEY is required in the process environment.
 */
const { createClient } = require("@supabase/supabase-js");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const projectUrl = "https://lbmwvsghqarrlpylknmj.supabase.co";
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!secret) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY. Supply it locally, never in chat or GitHub.");
  process.exit(2);
}
const client = createClient(projectUrl, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const tag = randomBytes(5).toString("hex");
const roles = ["owner", "member", "outsider"];
const created = [];
(async () => {
  try {
    for (const role of roles) {
      const email = `propsedge-teams-${role}-${tag}@example.com`;
      const password = randomBytes(24).toString("base64url") + "aA1!";
      const { data, error } = await client.auth.admin.createUser({
        email, password, email_confirm: true,
        app_metadata: { propsedge_test: true, test_suite: "teams_go_live" },
      });
      if (error || !data.user) throw new Error(`Failed creating ${role}: ${error?.message || "unknown"}`);
      created.push({ role, id: data.user.id, email, password });
    }
    const target = path.join(process.cwd(), ".demo-credentials", "teams-integration-accounts.json");
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    fs.writeFileSync(target, JSON.stringify({ projectUrl, createdAt: new Date().toISOString(), accounts: created }, null, 2), { mode: 0o600, flag: "wx" });
    console.log(`Created ${created.length} isolated Supabase Auth test identities. Credentials saved locally at ${target}`);
    console.log("Delete these users using the admin API after the integration tests.");
  } catch (error) {
    console.error(error.message);
    for (const account of created) {
      const { error: deleteError } = await client.auth.admin.deleteUser(account.id);
      if (deleteError) console.error(`Cleanup failed for ${account.role}: ${deleteError.message}`);
    }
    process.exitCode = 1;
  }
})();
