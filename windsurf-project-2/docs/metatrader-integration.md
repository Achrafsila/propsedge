# Connexion directe MetaTrader 4 / 5

Passe par MetaApi (pont cloud officiel MT4/MT5), car MetaTrader n'expose pas d'API web.

1. Créer un compte sur metaapi.cloud, copier le token dans `METAAPI_TOKEN` (`.env.local`, jamais commité).
2. `POST /api/mt/connect` avec `{ login, password, server, platform: "mt4" | "mt5", name? }`
   - utiliser le mot de passe **investisseur** (lecture seule) du compte.
   - renvoie `metaApiAccountId`, à stocker sur le compte (Personal/Challenge/Funded).
3. `GET /api/mt/sync?accountId=<metaApiAccountId>&days=30` renvoie les trades clôturés
   (positions appariées entrée/sortie, PnL = profit + commission + swap, heures en UTC).

Les routes sont protégées par la session Supabase (le proxy ne les exempte pas).
Prochaine étape : mapper `MtClosedTrade` vers `ParsedTrade` et l'injecter dans le flux de
`ImportTradesDialog`, en dédupliquant sur `externalTradeId`.
