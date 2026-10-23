#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
P=(psql -q -X -v ON_ERROR_STOP=1 -At -d teams_test)
"${P[@]}" -f "$ROOT/scripts/teams-local-fixture.sql" >/dev/null
for f in "$ROOT"/supabase/teams/00{1,2,3,4,5,6}_*.sql; do
  echo "Applying $(basename "$f")"
  "${P[@]}" -f "$f" >/dev/null
done
A=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
B=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
C=cccccccc-cccc-4ccc-8ccc-cccccccccccc
C1=11111111-1111-4111-8111-111111111111
C2=22222222-2222-4222-8222-222222222222
F=33333333-3333-4333-8333-333333333333
actor() { local u="$1"; shift; "${P[@]}" -c "set role authenticated; set request.jwt.claim.sub='$u'; $*"; }
eq() { if [[ "$1" != "$2" ]]; then echo "FAIL $3: $1 != $2"; exit 1; fi; echo "PASS $3"; }
deny() { local u="$1" label="$2" q="$3"; if actor "$u" "$q" >/dev/null 2>&1; then echo "FAIL $label"; exit 1; fi; echo "PASS $label"; }
T="$(actor "$A" "select public.create_team('Risk Desk');")"
eq 1 "$(actor "$A" "select count(*) from public.team_members where team_id='$T' and role='owner';")" owner
eq 0 "$(actor "$C" "select count(*) from public.teams where id='$T';")" outsider_team
deny "$B" nonmember_invite "select public.invite_team_member('$T','charlie@example.com','member');"
I="$(actor "$A" "select public.invite_team_member('$T','bob@example.com','member');")"
deny "$C" wrong_invitee "select public.accept_team_invitation('$I');"
eq "$T" "$(actor "$B" "select public.accept_team_invitation('$I');")" accept_invitation
deny "$B" self_promotion "select public.change_team_member_role('$T','$B','admin');"
deny "$B" remove_owner "select public.remove_team_member('$T','$A');"
deny "$B" share_foreign_account "select public.share_team_account('$T','challenge','$C1');"
S="$(actor "$A" "select public.share_team_account('$T','challenge','$C1');")"
eq 1 "$(actor "$B" "select count(*) from public.challenge_accounts;")" shared_challenge
eq 1 "$(actor "$B" "select count(*) from public.trades;")" shared_trade
eq 0 "$(actor "$B" "select count(*) from public.payouts;")" unshared_payouts
eq 0 "$(actor "$C" "select count(*) from public.challenge_accounts;")" outsider_accounts
eq 0 "$(actor "$B" "with changed as (update public.challenge_accounts set status='closed' where id='$C1' returning id) select count(*) from changed;")" financial_write_blocked
actor "$B" "insert into public.team_notes(team_id,account_type,account_id,author_user_id,body) values('$T','challenge','$C1','$B','Review risk');" >/dev/null
eq 1 "$(actor "$A" "select count(*) from public.team_notes;")" team_note
eq 0 "$(actor "$C" "select count(*) from public.team_notes;")" outsider_note
deny "$B" unshared_note "insert into public.team_notes(team_id,account_type,account_id,author_user_id,body) values('$T','challenge','$C2','$B','Hidden');"
actor "$A" "select public.share_team_account('$T','funded','$F');" >/dev/null
eq 1 "$(actor "$B" "select count(*) from public.payouts;")" funded_payout
eq 2 "$(actor "$B" "select count(*) from public.trades;")" funded_trades
actor "$A" "select public.revoke_team_account_share('$S');" >/dev/null
eq 0 "$(actor "$B" "select count(*) from public.challenge_accounts;")" revoked_account
eq 0 "$(actor "$B" "select count(*) from public.team_notes;")" revoked_notes
actor "$A" "select public.remove_team_member('$T','$B');" >/dev/null
eq 0 "$(actor "$B" "select count(*) from public.funded_accounts;")" removed_member
eq 0 "$(actor "$B" "select count(*) from public.payouts;")" removed_payouts
echo "ALL LOCAL RLS TESTS PASSED"
