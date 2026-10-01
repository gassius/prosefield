<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Agent attribution

Every commit, pull request, and review comment made by an AI agent must identify the agent, the ClickUp ticket (or `none` / a GitHub issue-or-PR reference), and (when known) the agent run.

### Commits

AI-agent commits must end with **one contiguous trailer block**: the final paragraph of the message, with no blank lines inside it. Git only treats that last paragraph as trailers. The block contains `Agent:`, `Agent-Ticket:`, `Agent-Run:` (when known), and any other trailers such as `Co-authored-by:`. There must be no blank line between the `Agent:` lines and `Co-authored-by:`.

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
  --trailer 'Co-authored-by: Carlos González Rico <gassius@users.noreply.github.com>'
```

`Agent:` is exactly one name from [Known identities](#known-identities).

`Agent-Ticket:` is the ClickUp task id. When there is no ClickUp task, use `Agent-Ticket: none`, or the GitHub issue/PR reference if there is one (for example `Agent-Ticket: #64`).

`Agent-Run:` is the full `https://cursor.com/agents/<bc id>` URL for Cursor cloud agents, or `hermes-session:<session id>` for GasNet Hermes. Omit the line when the run id is unknown.

If tooling would append `Co-authored-by:` after a blank line, include that trailer yourself so it joins the same block (`--trailer 'Co-authored-by: …'` or `git interpret-trailers --in-place --trailer …`). Cursor's commit-msg hook skips adding `Co-authored-by:` when the message already has one.

Before pushing, check:

```bash
git log -1 --format='%(trailers:key=Agent,valueonly)'
```

It must print the agent name. `git interpret-trailers --parse` on the commit message must list every `Agent*` trailer (and `Co-authored-by:` if present) in one block.

**Carve-out:** merge commits created by GitHub's update-branch button or API have no trailers. That is acceptable. Attribute those updates in a PR comment instead.

**Squash merges:** when squash-merging, replace the whole squash commit body so the final paragraph is a single correct contiguous trailer block (no blank lines inside it). Do not leave a multi-commit concatenation that breaks trailer parsing.

### Pull requests

The same trailer lines appear as a footer. That footer is the last human-written section of the PR description; tool-appended HTML (Open in Web / Open in Cursor badges, `<!-- CURSOR_AGENT_PR_BODY_* -->` wrappers) may follow.

In the PR body, the footer may use the bare bc id for `Agent-Run:` if the form rejects the `https://cursor.com/agents/…` URL. Commits still use the full URL.

### PR comments and reviews

Every agent comment starts with `### Agent: <name>` as the first line.

`**Verdict:**` is required on reviews and on verdict or status comments only (for example `**Verdict:** Approve | Request changes | Comment`). Plain replies need only the `### Agent:` header.

### Known identities

- **GasNet Implementer**: Cursor cloud agents launched by Engineer Supervisor. Commits are authored by Cursor's `cursoragent` account (`Cursor Agent <cursoragent@cursor.com>`) and identified by `Agent: GasNet Implementer` trailers. `Agent-Run:` is `https://cursor.com/agents/<bc id>`.
- **Engineer Supervisor**: writes as GitHub App `gasnet-supervisor-gassius[bot]`.
- **Pull Request Reviewer**: writes as GitHub App `gasnet-reviewer-gassius[bot]`.
- **Nightly Audit Engineer**: also uses Cursor cloud agents; identified by `Agent: Nightly Audit Engineer`.
- **GasNet Hermes**: external build/verification agent writing as GitHub App `gasnet-hermes-agent[bot]`. Comments only (no Approve or Request changes, no merges) unless a job allows commits. `Agent-Run: hermes-session:<session id>` — a new session for every PR and for every task within a PR (one job run on one head SHA). First job: Prosefield Docker build and smoke test on its own server.

### Merge policy

Only Carlos (`gassius`) merges PRs. Agents never merge, enable auto-merge, or mark PRs Ready unless Carlos asks.
