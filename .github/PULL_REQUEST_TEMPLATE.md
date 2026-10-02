## Summary

<!-- What changed and why (link ClickUp when applicable). -->

## Scope / tests

<!-- List each scope item (or behaviour change) and the test(s) that cover it.
     Required by AGENTS.md → Testing requirements. -->

| Scope item | Tests |
|---|---|
| … | `tests/…`, `e2e/…` |

## Checklist

- [ ] Same-PR tests for every behaviour change (unit/component, E2E, axe for new pages, visual for UI)
- [ ] Bug fixes include a regression test that fails before the fix
- [ ] Coverage thresholds not lowered; new files inside coverage includes
- [ ] No `.skip` / `.only`, no loosened assertions / diffs / retries
- [ ] Draft until Reviewer Approve + Hermes Pass + green CI on the same head SHA

See [AGENTS.md → Testing requirements](../AGENTS.md#testing-requirements).
