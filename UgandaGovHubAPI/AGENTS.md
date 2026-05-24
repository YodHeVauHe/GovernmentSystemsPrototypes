# Repository Instructions

## Commit Messages

For this repository, do not create vague or one-line commits for multi-file,
behavioral, UI, backend, security, or test changes.

Every commit message must include:

- A concise subject line naming the main change.
- A body with bullets describing the concrete changes by feature area or file
  area.
- A verification section listing the commands run and their result.

Before committing, inspect `git diff --cached --stat` and make sure the commit
body explains every meaningful staged file group. If a commit includes changes
the assistant did not make, mention that they were already present or included
at the user's request.

Use a one-line commit only when the user explicitly requests it or when the
commit is truly trivial, such as a single typo fix.
