<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Domain logic lives in `src/domain/` as pure TypeScript; UI and server only call it. Why: tests and execution share one model.
- Server-only code goes in `src/server/*.server.ts`; client-callable server functions go in `src/lib/*.functions.ts`. Why: `src/server/` is blocked from client bundles.
- Public case inputs (`src/server/fixtures`) and evaluator gold (`src/evaluation`) stay in separate files and types. Why: decision code must never see expected labels.
- Permission references are only minted by the server with the `GTM_SEAL_SECRET` HMAC seal. Why: client strings must never grant authority.
- Every phase updates `docs/rebuild-status.md` with real executed checks. Why: status must reflect evidence, not intent.
- Durable state lives in Lovable Cloud; every registry mutation and effect commit goes through `gtm_append_event` / `gtm_commit_dispatch`, which lock the same aggregate row. Why: a revoke and a dispatch must serialize.
- Each sandbox session + case is its own aggregate scope. Why: positive controls start from a clean fixture state.
- Simulator lives in `src/domain/sim/`: `env.ts` owns latent truth; policies import only `observation`, `belief`, `planner`, `grammar`, `prng`. Why: R01 truth isolation is checked by a test that scans policy imports.
