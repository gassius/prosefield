<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Agent attribution

Every commit, pull request, and review comment made by an AI agent must identify the agent, the ClickUp ticket (or `none` / a GitHub issue-or-PR reference), and the agent run.

### Commits

AI-agent commits must end with **one contiguous trailer block**: the final paragraph of the message, with no blank lines inside it. Git only treats that last paragraph as trailers. The block contains `Agent:`, `Agent-Ticket:`, `Agent-Run:`, optional `Agent-Coordinator:`, and any other trailers such as `Co-authored-by:`. There must be no blank line between the `Agent:` lines and `Co-authored-by:`.

Add them with `--trailer` so they form that final paragraph (do not type a separate paragraph by hand):

```bash
git commit --trailer 'Agent: …' --trailer 'Agent-Ticket: …' --trailer 'Agent-Run: …'
```

Example with a subject and body:

```bash
git commit -m "subject" -m "body" \
  --trailer 'Agent: GasNet Implementer' \
  --trailer 'Agent-Ticket: 869f9e0zr' \
  --trailer 'Agent-Run: https://cursor.com/agents/<bc id>' \
  --trailer 'Agent-Coordinator: https://cursor.com/agents/<coordinator id>' \
  --trailer 'Co-authored-by: Carlos González Rico <gassius@users.noreply.github.com>'
```

`Agent:` is exactly one name from [Known identities](#known-identities).

`Agent-Ticket:` is the ClickUp task id. When there is no ClickUp task, use `Agent-Ticket: none`, or the GitHub issue/PR reference if there is one (for example `Agent-Ticket: #64`).

`Agent-Run:` names the Cursor agent or Project thread that authored the commit or opened the PR — **not** the Project coordinator. For Cursor cloud agents use the full `https://cursor.com/agents/<bc id>` URL of that agent or thread. For GasNet Hermes use `hermes-session:<session id>`. Required on every agent commit that lands on `main` (each commit is preserved as-is under merge commits).

Optional `Agent-Coordinator: https://cursor.com/agents/<coordinator id>` may follow in the same trailer block when a Project coordinator launched the authoring thread.

If tooling would append `Co-authored-by:` after a blank line, include that trailer yourself so it joins the same block (`--trailer 'Co-authored-by: …'` or `git interpret-trailers --in-place --trailer …`). Cursor's commit-msg hook skips adding `Co-authored-by:` when the message already has one.

Before pushing, check:

```bash
git log -1 --format='%(trailers:key=Agent,valueonly)'
```

It must print the agent name. `git interpret-trailers --parse` on the commit message must list every `Agent*` trailer (and `Co-authored-by:` if present) in one block.

**Carve-outs (no trailers required):** CI and humans use the same signals — agents cannot forge them.

- **GitHub merge commits:** PR merges (*Create a merge commit*) and update-branch merges (button or API) when the committer is GitHub `web-flow` **and** the commit signature is verified. An agent that updates the branch via GitHub **must** leave a PR comment starting with `### Agent: <name>` that names the merge SHA.
- **Carlos's own commits (`gassius`):** only when the commit is signature-verified with committer login `gassius`, or is a verified `web-flow` commit whose author login is `gassius` (web UI). Never treat author name or email alone as proof. A message that contains any `Agent:` / `Agent-*:` line is never exempt — it must parse as a valid trailer block.

Any other merge (for example a local `git merge`) must carry a valid trailer block.

**Merge commits (Carlos):** Carlos merges with *Create a merge commit* only. *Squash and merge* and *Rebase and merge* are disabled in repo settings. Because every PR-branch commit lands on `main` as-is, each commit on the branch must carry its own valid single trailer block (`Agent:`, `Agent-Ticket:`, `Agent-Run:`, optional `Agent-Coordinator:`, `Co-authored-by:`).

**Draft-only trailer fixes:** If a commit on a **draft** PR has a bad trailer block, the agent that owns that PR branch may reword and force-push with `--force-with-lease` to fix it. Only on that agent's own PR branch while the PR is still draft. Never force-push to `main` or to a ready (non-draft) PR.

**Known exception on `main` (do not rewrite):** `d7a4098`, `cf06361`, and `c7f6888` predate this check and have malformed or incorrect trailers. They are attributed via PRs #1 / #2 and ClickUp `869faehaz`. Leave them as-is.

### Pull requests

The same trailer lines appear as a footer. That footer is the last human-written section of the PR description; tool-appended HTML (Open in Web / Open in Cursor badges, `<!-- CURSOR_AGENT_PR_BODY_* -->` wrappers) may follow.

In the PR body, the footer may use the bare bc id for `Agent-Run:` / `Agent-Coordinator:` if the form rejects the `https://cursor.com/agents/…` URL. Commits still use the full URL.

### PR comments and reviews

Every agent comment starts with `### Agent: <name>` as the first line.

**Exempt:** command comments that only trigger tooling (for example `/hermes run docker-smoke` with Head/Ticket/Reason). Those do not need the `### Agent:` header.

`**Verdict:**` is required on reviews and on verdict or status comments only. Pull Request Reviewer uses `**Verdict:** Approve | Request changes | Comment`. GasNet Hermes status comments use `**Verdict:** Pass | Fail | Blocked` (never Approve or Request changes). Plain replies need only the `### Agent:` header.

### Known identities

- **GasNet Implementer**: Cursor cloud agents launched by Engineer Supervisor. Commits are authored by Cursor's `cursoragent` account (`Cursor Agent <cursoragent@cursor.com>`) and identified by `Agent: GasNet Implementer` trailers. `Agent-Run:` is `https://cursor.com/agents/<bc id>` of the authoring agent or Project thread (not the Project coordinator).
- **Engineer Supervisor**: writes as GitHub App `gasnet-supervisor-gassius[bot]` (since 2026-09-30).
- **Pull Request Reviewer**: writes as GitHub App `gasnet-reviewer-gassius[bot]` (since 2026-09-30). Approve and Request changes are reserved for this identity.
- **Nightly Audit Engineer**: also uses Cursor cloud agents; identified by `Agent: Nightly Audit Engineer`.
- **GasNet Hermes** *(prosefield only for now)*: external build/verification agent writing as GitHub App `gasnet-hermes-agent[bot]` (since 2026-10-01). Every Hermes comment ends with a footer paragraph of `Agent: GasNet Hermes`, `Agent-Ticket:`, and `Agent-Run: hermes-session:<id>` (contiguous, no blank lines). Status comments use `**Verdict:** Pass | Fail | Blocked` together with the tested head SHA; they never use Approve or Request changes. Hermes may commit or open PRs only if Carlos explicitly allows it for a given job; such commits follow the [Commits](#commits) rules with `Agent: GasNet Hermes` and `Agent-Run: hermes-session:<id>`. Session unit: one job run on one head SHA — a new session for every PR and every task; one result comment per session. First job: Prosefield Docker build and smoke test on its own server.

Before 2026-09-30, Engineer Supervisor and Pull Request Reviewer actions appear as `gassius`. The `### Agent:` header is then the only attribution.

PRs opened by Cursor agents show `gassius` as author; the footer identifies the agent.

### Merge policy

Only Carlos (`gassius`) merges PRs, and only via *Create a merge commit* (see [Commits](#commits)). *Squash and merge* and *Rebase and merge* are disabled in repo settings.

Engineer Supervisor marks a PR ready after Pull Request Reviewer **Approve** + GasNet Hermes **Pass** + green CI on the **same** head SHA. Other agents never mark Ready unless Carlos asks. Agents never merge or enable auto-merge.

## Testing requirements

Every PR that changes behaviour must ship tests in the **same** PR. Mirror the ClickUp Definition of Done:

1. **Same-PR tests for behaviour changes**
   - Vitest **unit** and **component** (RTL) coverage for logic and UI wiring
   - Playwright **E2E** for user flows (register, login, logout, redirects, CTAs)
   - **axe** accessibility checks for new pages (`e2e/a11y.spec.ts` project)
   - Docker-only **visual** baselines for UI changes (`pnpm test:visual` / `pnpm test:visual:update`)
2. **Bug fixes** include a **regression test that fails before the fix** (prove it bites).
3. **Tests must bite** — be ready to show a red run when the feature is removed or weakened.
4. **Coverage thresholds only go up.** New files under `src/lib/**` and `src/features/auth/**` must stay inside Vitest coverage `include` globs. Do not lower thresholds to get green.
5. **No weakening to get green:** no `.skip` / `.only`, no loosened assertions, no extra visual diff allowance, no retries used to hide flakes.
6. **PR body** lists which tests cover each scope item / behaviour change.

See also [README.md](README.md#testing) for how to run the suites locally.
