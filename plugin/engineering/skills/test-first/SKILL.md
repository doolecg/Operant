---
name: test-first
description: Write a failing test before the code that fixes or adds behaviour, then the least code to pass it. Use when adding logic, changing behaviour or fixing a bug, so every change is backed by a test that failed first.
---
This skill makes tests the proof that code works. The one rule that matters most:
see the test fail for the right reason before you write the code that makes it
pass.

## Use when
- You are adding logic or changing behaviour, including inside a build slice.
- A bug is reported and you need to prove it before fixing it.
- You are asked to add tests to existing code.
- Skip when the change has no behaviour: docs, comments, pure config or static
  text.

## Steps
1. Find how this project runs tests: the README, package scripts, CI files. Learn
   the command for one test file and the command for the full suite. Do not
   assume a default.
2. Name the seam. A seam is the public edge where you can see the behaviour
   without reaching inside. Use the seams agreed in the spec. If none were
   agreed, propose one in a line and ask.
3. Pick one behaviour. Write one test for it, named like a sentence: "rejects an
   empty title". Arrange, act, assert.
4. Run that test file. Confirm it fails because the behaviour is missing, not
   because of a typo or a missing import. Quote the failure.
5. Write the least code that makes it pass. Do not add code for tests you have not
   written yet.
6. Run the file again and quote the pass. Then check CPU load and run the full
   suite once, on its own.
7. Repeat steps 3 to 6 for the next behaviour. Never write all the tests first and
   all the code after.
8. When everything is green, refactor only the code you touched. Run the tests
   after each small refactor.
9. For a bug, apply the Prove-It rule at step 3: write a test that reproduces the
   bug, watch it fail, then fix, then watch it pass.

## Rules
- Red before green. A test that passes the first time proves nothing; find out
  why.
- Expected values come from an independent source: the spec, a worked example, a
  known literal. Never rebuild the answer with the same logic the code uses, or
  the test cannot disagree with the code.
- Assert behaviour at the seam, not internals. If a refactor with the same
  behaviour breaks the test, the test was wrong.
- Use real objects first, then a simple fake. Mock only at system boundaries: the
  network, the clock, the disk, other processes, paid services.
- Never skip, delete, loosen or mark a test as the only one to get green. If a
  test is wrong, say so and fix it openly.
- One run at a time. Do not run tests in parallel with a build.
- No placeholder data passed off as real. Test data is small, honest and written
  in the test.
- Do not touch tests for unrelated code. Match the style of the neighbouring
  tests.

## Stop and ask
- A test has failed three verify passes (one pass is one run plus the fix) and you
  still do not know why.
- No sensible seam exists and the only way to test is to reach into internals.
- The spec is unclear about the right answer, so you cannot write the expected
  value.
- Making a test pass would need a change outside the agreed scope, or something
  risky or irreversible.
- A wrong guess would be costly, for example about money, user data or stored
  formats.

## Excuses and answers
| Excuse | Answer |
|---|---|
| "I will add the test after the code works." | After-the-fact tests copy what the code does. Write it first and watch it fail. |
| "It passed straight away, great." | Suspicious. Break the code on purpose and check the test goes red. |
| "I will compute the expected value in the test." | That repeats the code's logic. Use a literal from the spec or a worked example. |
| "Mocking this class is quicker." | Mocks of your own code lock in internals. Use the real thing. |
| "This test is flaky, I will skip it." | Find the cause or ask the user. Skipping hides a real fault. |
| "It is too simple to test." | Simple code grows. A one-line test is cheap and documents the intent. |
