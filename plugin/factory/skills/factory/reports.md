Report formats. Keep every field short.

BLOCKED (a helper sends this when it must stop)
BLOCKED: one line on what stopped you.
EXPECTED: what the card said should happen.
GOT: the exact error or output.
TRIED: up to 3 things you tried.
SUSPECT: your best guess at the cause.
NEED: the decision or fix you need from the lead.

Example
BLOCKED: the time tests fail after my change.
EXPECTED: all tests in src/time.test.ts pass.
GOT: "TypeError: Cannot read properties of undefined (reading 'trim')" at time.ts:14
TRIED: guarded the empty string first; guarded undefined too.
SUSPECT: the form passes undefined, not an empty string.
NEED: confirm undefined should also return null.

The lead answers with a concrete fix or decision, then resumes the same helper.

DONE (a helper sends this when the outcome check passes)
DONE: one line.
CHANGED: file: what changed.
VERIFIED: the check you ran and its result.
NOTES: anything the lead must know, or "none".

Example
DONE: parseDuration returns null for an empty string.
CHANGED: src/time.ts: early return null. src/time.test.ts: new empty-string test.
VERIFIED: ran the time tests, 12 passed, 0 failed.
NOTES: none.

Model tiers (generic)
| Tier | Jobs |
|------|------|
| Small (cheapest) | Lookups, read and summarise, run a build or tests, renames, screenshots. Mechanical or read-only work only. If it needs judgement, step up one tier. |
| Mid | Simple edits, docs, a one-file fix, tests for existing code, a normal bug fix. Also hard jobs and UI design at first: multi-file features, simulation rules, tricky debugging. |
| Strongest | Architecture, or a hard job after the mid tier failed. Say so in one line. Very hard jobs (big refactor, migration, security-sensitive) need the user's OK first. |
