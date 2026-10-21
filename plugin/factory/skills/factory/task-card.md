Task Card. One task per helper. Small enough to finish in one run. Fill in every field.

TASK: one sentence.
CONTEXT: why this is needed, the files to read (paths only), and decisions already made.
FILES ALLOWED: the only files the helper may change.
FILES FORBIDDEN: files the helper must not touch.
STEPS:
1. First step.
2. Next step.
EXPECTED OUTCOME: a check anyone can run (tests pass, a file exists, output matches, a value equals X). Never "make it better".
IF STUCK: return BLOCKED. Do not improvise.

Example

TASK: Make parseDuration in F:\work\app\src\time.ts return null for an empty string instead of throwing.
CONTEXT: The settings form crashes on an empty field. The tests are in F:\work\app\src\time.test.ts. Keep the return type as number | null. Do not change how valid input is parsed.
FILES ALLOWED: F:\work\app\src\time.ts, F:\work\app\src\time.test.ts
FILES FORBIDDEN: everything else, and any .env file.
STEPS:
1. Read parseDuration and its tests.
2. Add a test that an empty string returns null. Run the time tests and see it fail.
3. Change parseDuration so the empty string returns null.
4. Run the time tests again.
EXPECTED OUTCOME: the time tests pass, including the new empty-string test, and no other file changed.
IF STUCK: return BLOCKED with the exact error. Do not improvise.
