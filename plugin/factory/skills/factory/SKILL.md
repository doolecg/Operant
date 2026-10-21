---
name: factory
description: Run work as a factory: you plan, split, review and stitch; helper agents do the bulk work from strict Task Cards. Use when a job is big or has parallel parts, or when its output would flood your context. Skip for small jobs.
---
This skill is the lead's playbook for working through helper agents. The one rule
that matters most: the lead plans, splits, answers escalations, stitches and
reviews, and helpers do the bulk work from one Task Card each.

The three reference files sit in the same folder as this file. Read each one when
you reach the step that names it:
- task-card.md: the blank Task Card and an example.
- worker-brief.md: the rules block you paste at the end of every helper brief.
- reports.md: the BLOCKED and DONE formats and the model tiers.

## Use when
- The job is big: many files, long searches, or long logs you should not read
  yourself.
- The job has parts that are truly independent and can run side by side.
- A helper would keep large output out of your context.
- Skip when the job is under about 10 tool calls. Do it yourself. Every helper
  reloads the whole startup context, so each one costs real tokens.

## Steps
1. Plan briefly. Write the goal and the parts in the task notes at
   .operant/engineering/<task-name>/notes.html. Decide which parts a helper takes
   and which you keep.
2. Split the work into Task Cards, one task per helper, each small enough to
   finish in one run. Use the template in task-card.md. Every card needs an
   outcome that can be checked, never "make it better".
3. Pick a model tier for each card from the table in reports.md. Use the smallest
   tier that fits the job. Very hard jobs need the user's OK first.
4. Check CPU and RAM before you start helpers or any build. If CPU is above 70
   percent, wait. Make sure no two cards share a file.
5. Dispatch the independent cards in parallel, within the caps. Dependent cards
   go one after the other. End every helper brief with worker-brief.md. Point to
   files by path. Do not paste their contents.
6. Collect the reports. Check each is in the DONE or BLOCKED format from
   reports.md. Read what the helper changed, not only what it says it changed.
7. Answer each escalation with a concrete fix or decision, then resume the same
   helper so it keeps its context. If one kind of task keeps escalating, rewrite
   the card.
8. Do the integration check yourself. Run the build and tests once, alone, after
   all helpers have stopped. Integration is where multi-agent runs break.
9. Tick the cards off in the notes. Give the user a short summary: the result
   first, what you checked, what you did not.

## Rules
- At most 3 helpers at once and at most 3 per job in total. If the job seems to
  need more, stop and tell the user why.
- Helpers never start helpers. Only the lead starts helpers.
- One build or test run at a time across the lead and all helpers. No dev servers
  unless the user asked; then one, on one fixed port, stopped when done.
- Never give two helpers the same file at the same time.
- Scouts are read-only helpers and never edit. Smallest-tier models do mechanical
  or read-only work only. If a job needs judgement, step up one tier.
- Keep talk to and from helpers short. Pass paths, not file contents. Scouts
  return summaries, never whole files.
- The lead does not do bulk searching, mechanical edits or log reading. That is
  helper work.
- Two-strike rule: if the same approach fails twice, stop and escalate. No third
  variation. A helper's DONE report is a claim: check it before you tell the user
  it works.

## No helper agents in your tool
Do the same work alone, one card at a time, in order. Write each card and its
DONE or BLOCKED report in the task notes. Treat FILES ALLOWED as a fence. Finish
the card's outcome check before you begin the next card.

## Stop and ask
- Three failed verify passes on the same problem.
- Anything risky or irreversible. Every helper needs your approval first to
  delete files or data, push or rewrite history, install anything, run scripts
  with effects outside the project, touch secrets or .env, or call the network.
  Never push. Commits stay local on the current dev branch.
- A wrong guess would be costly.
- The job needs more than 3 helpers, or it is very hard (a big refactor, a
  migration, security work).
- The plan contradicts the code, or a fix needs files outside every card.

## Excuses and answers
| Excuse | Answer |
|--------|--------|
| "It is faster to read all these logs myself." | Reading logs is helper work. Send a scout and ask for a summary. |
| "I will send four helpers to go faster." | The cap is 3 at once and 3 per job. Merge the cards or tell the user. |
| "A quick brief is enough, the helper will work it out." | A helper with a vague card guesses. Fill in every field of the card. |
| "Two helpers can edit the same file if they touch different parts." | They cannot. Split by file or run them in order. |
| "The helper said DONE, so I will skip the check." | Reports can be wrong. Read the changes and run the outcome check yourself. |
| "It failed twice, so I will try a third way." | Stop and escalate. A third variation is a guess. |
