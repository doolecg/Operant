---
name: simplify
description: Make code you just changed easier to read without changing what it does. Use after tests are green, to tidy only the code this task touched. Not for drive-by cleanup of other files.
---
This skill makes finished, passing code easier to read. The one rule that matters
most: behaviour stays exactly the same and the tests are not edited.

## Use when
- The task works and its tests are green.
- The code you wrote or changed is heavier, deeper or messier than it needs to be.
- A change left dead code behind: an unused function, import or branch.
- Skip when tests are red, when you do not yet understand the code, or when the
  code is already clear.

## Steps
1. Confirm the tests pass first. Run the relevant test file and quote the result.
   If it is red, stop and use diagnose instead.
2. List the code this task changed, using the diff. Only that code is in scope.
3. Before touching anything, learn why it exists. Read its callers, its tests and
   its git history. If a line looks odd, find out the reason before you remove
   it.
4. Pick the opportunities: deep nesting, long functions, unclear names, repeated
   checks, wrappers that add nothing, comments that only restate the code, and
   code the change made dead.
5. Make one simplification at a time. After each, run the relevant test file. If
   it fails, undo that change and rethink it.
6. Delete code your change made dead, after a search shows nothing else uses it.
7. Read the diff as a new reader. If the new version is not clearly easier to
   follow, undo it.
8. Check CPU load, then run the full suite once, on its own. Quote the result.
   Make a separate local commit with a short plain message, for example
   "Simplify export retry loop".

## Rules
- Same inputs give the same outputs, errors and side effects, in the same order.
  If unsure, do not change it.
- Existing tests stay unchanged. A test that needs editing means behaviour
  changed; undo.
- Clearer beats shorter. A plain if-else beats a dense one-liner. Do not inline a
  helper that gave an idea a name.
- Match the style of the surrounding code. Use the project's own names and
  patterns, not your taste.
- Keep error handling and checks at the edges. Do not remove them to look
  cleaner.
- Keep comments that explain why. Remove comments that only repeat what the code
  says.
- Stay inside the changed code. Mention a mess elsewhere in one line; do not fix
  it.
- Never mix this with feature work. Simplify is its own commit, local only on the
  current dev-<version> branch.

## Stop and ask
- A simplification would change behaviour, however slightly, and you cannot prove
  it does not.
- The code only looks pointless and you cannot find why it exists.
- The tests fail after three verify passes on the same change (one pass is one run
  plus the fix).
- Doing it well needs touching files outside the task, or something risky or
  irreversible.
- A wrong guess would be costly, for example in code that handles money, data or
  security.

## Excuses and answers
| Excuse | Answer |
|---|---|
| "Fewer lines is always better." | Readers matter, not line counts. Pick the version that takes less thought. |
| "This old code is ugly, I will fix it too." | Not in this task. Note it in one line and leave it. |
| "That check looks useless, I will drop it." | Find out why it was added first. It may guard a real case. |
| "I had to tweak a test to keep it passing." | Then behaviour changed. Undo the simplification. |
| "I will do it together with the feature." | Mixed changes are hard to read and hard to undo. Keep them apart. |
| "This helper might be handy later." | Unused code is a cost now. Remove it; add it back when needed. |
