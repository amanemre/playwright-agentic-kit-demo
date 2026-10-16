---
name: pull-requests
description: Delivering approved changes as a pull request on any host — GitHub, GitLab, Azure DevOps, Bitbucket or another — branch naming, commit messages (Conventional Commits by default), what one pull request holds, the description template with the run summary, and opening a draft with the host's command-line tool (gh, glab, az) or handing the description over where there is none. Every outward step — commit, push, opening the pull request, marking it ready, posting a comment — waits for the user's go-ahead. Use after Phase 8 of the workflow, when the user asks to commit, push, open or update a pull request / merge request, or asks how branches and commits are named here. For reviewing a branch use the pr-reviewer skill; for the run summary see test-standards ("Reporting a run").
---

# Pull Requests

**Purpose.** Turn approved, verified changes into a pull request a reviewer can trust: one ticket, a clean branch, readable commits, and a description that says what was planned, what ran and what still needs a person's decision. Works on any host; the profile says which.

## Critical

_Bullets tagged (DEF-…) are defaults of the `playwright-house-preset`: where `PROJECT-PROFILE.md` records a different choice, follow the profile (see the `project-profile` skill). Untagged bullets always apply._

- **Every outward step waits for the user's go-ahead** — commit, push, opening the pull request, marking it ready, posting a comment. Ask once per step (INV-10); authorization the user already gave for this exact scope counts. A standing approval in the profile counts for its one action — `push-fixes-as-draft-pr` (a task branch and a draft pull request for test fixes), `post-run-summary` (the run summary as a comment) — within its limits and until its date; name the approval in the description or the comment.
- **Never** commit to or push to the base branch, force-push, rewrite published history, merge, or close someone else's pull request.
- **One ticket per pull request**, and every changed line traces to it (INV-12). Unrelated changes in the working tree stay out — stage files by path, never everything at once when the tree holds other work.
- **Branch names follow the profile's pattern** — preset `{type}/{ticket}-{short-name}`, e.g. `test/SHOP-142-cart-discount` _(DEF-21)_.
- **Commit messages follow the profile's style** — preset Conventional Commits: `<type>(<optional scope>): <subject>`, the subject in the imperative and under about 72 characters, the body saying why; one logical change per commit _(DEF-21)_.
- **The description follows the kit's template** (`templates/pull-request.template.md`). Results come from `reports/run-summary.md` of the run on the branch's last commit — never from memory (INV-11). New failures are listed under "Needs confirmation", never presented as known defects.
- **A pull request stays a draft** until its checks pass and every new failure is confirmed or fixed; marking it ready is the user's call.
- **No secrets** in branch names, commits, descriptions or comments — no env values, tokens, or traces that recorded a real credential (INV-04).

## Triggers

- Phase 8 of the workflow, after the report: "commit this", "push it", "open a PR / MR", "update the PR".
- "How do we name branches / write commit messages here?"
- A review asked for a pull request that does not exist yet (the `pr-reviewer` skill hands over here).

## Inputs

- Required: the approved and verified changes; the profile's `delivery` facts (host, base branch, CLI, branch pattern, commit style).
- Optional: the ticket ID or link (the `tracker` skill reads the ticket); the plan path and who approved it; `reports/run-summary.md`.

## Discovery

1. **`PROJECT-PROFILE.md` → `delivery`** — the host, the base branch, the CLI the agent may use, the branch pattern and the commit style.
2. **The repository's state** — `git status` (what changed, and what does not belong to this task), `git branch --show-current`, whether the branch exists on the remote, `git log --oneline -5` (the style recent commits use).
3. **The host's template** — at the path in the table below; a project's own template wins over the kit's, as long as it keeps the kit's sections.
4. **The CLI** — `<cli> --version` and its login status (`gh auth status`, `glab auth status`, `az account show`). Missing or not logged in → hand the description over instead (Stop conditions).

## Decision rules

**Per host.** Flags change between CLI versions — check `<cli> <command> --help` before first use. The `gh` commands were checked against gh 2.98; the `glab` and `az` commands have not been run against a real installation yet — check them with `--help` before first use.

| Host                        | Template path                                                                     | Open a draft                                                                                             | Mark ready                                   | Find the pull request of a branch           |
| --------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------- |
| GitHub (`gh`)               | `.github/pull_request_template.md`                                                | `gh pr create --draft --base <base> --title "<title>" --body-file <file>`                                | `gh pr ready`                                | `gh pr view <branch> --json number,url`     |
| GitLab (`glab`)             | `.gitlab/merge_request_templates/Default.md`                                      | `glab mr create --draft --target-branch <base> --title "<title>" --description "$(cat <file>)"`          | `glab mr update <id> --ready`                | `glab mr list --source-branch <branch>`     |
| Azure DevOps (`az`)         | `.azuredevops/pull_request_template.md`                                           | `az repos pr create --draft true --target-branch <base> --title "<title>" --description "$(cat <file>)"` | `az repos pr update --id <id> --draft false` | `az repos pr list --source-branch <branch>` |
| Bitbucket, other, or `none` | Bitbucket: none in the repository (a default description is a repository setting) | Push the branch, then give the user the description and the host's "create pull request" link            | The user, in the host's web page             | The user, in the host's web page            |

- **Branch.** On the base branch → create the branch from the updated base (`git switch -c <name>`). On a branch that belongs to another task → stop and ask.
- **Commits.** Propose the message(s) first; after the go-ahead, stage the task's files by path and commit. Tool-specific footers (co-author lines, sign-offs) follow the tool's or the project's rules, not this skill.
- **Title.** The ticket ID, then what the change does: `SHOP-142: test the cart discount` — or, with Conventional Commits, the main commit's subject.
- **Description.** Write it to `reports/pull-request.md` from the template: the ticket, what and why, the plan, the test changes, the run summary's totals and its "Needs confirmation" list, known defects and skipped tests, the checks run, what is left out. Leave no section empty — write "none" and why.
- **Run summary.** Run `npm run test:summary` on the branch's last commit before writing the description; a summary from an older commit is stale.
- **Updating a pull request.** New commits on the same branch; refresh the run summary section. Never force-push to tidy history.
- **Changes for the review.** Address findings in new commits; reply to each finding with what changed — after the user's go-ahead to post.

## Workflow

1. **Check the state** — what changed and what belongs to this task (Discovery 2).
2. **Branch** — create or confirm it (Decision rules).
3. **Commit** — propose the messages; commit after the go-ahead.
4. **Summarise the run** — `npm run test:summary` on the last commit.
5. **Describe** — `reports/pull-request.md` from the template.
6. **Push and open a draft** — after the go-ahead: `git push -u origin <branch>`, then the host's command; report the link. Without a CLI: push, and give the user the description and the link.
7. **Ready for review** — only when the checks pass, new failures are confirmed or fixed, and the user says so.

## Outputs

- A branch named by the pattern, with readable commits.
- `reports/pull-request.md` — the description, kept with the run's reports.
- A draft pull request (its link), or the description and link handed to the user.

## Verification

- `git log --oneline <base>..HEAD` — only this task's commits, each in the commit style.
- `git diff --stat <base>...HEAD` — only this task's files (INV-12).
- The host's view of the pull request (`gh pr view`, `glab mr view`, `az repos pr show`) — draft, base branch, description as written.

## Stop conditions

- The working tree holds changes that are not this task's, and they cannot be kept out by staging paths.
- The current branch belongs to another task, or the base branch is ahead with conflicting changes.
- The CLI is missing, not logged in, or the push is rejected (a protected branch, missing rights) — report it; hand the description over.
- The run summary shows `failed-new` the user has not confirmed, and the user asks to mark the pull request ready.

## Extension points

- The profile sets the host, base branch, CLI, branch pattern and commit style; another pattern or style is a DEF-21 override with its reason.
- A project may add sections to its copy of the template; the kit's sections stay.
- On CI, `scripts/ci-publish.mjs` posts the run summary on a pull request under the standing approval `post-run-summary` (the `ci` skill).

## See Also

- **`ai-native-workflow`** — Phase 8 hands over here after the report.
- **`pr-reviewer`** — reviewing the branch and the description.
- **`test-standards`** — "Reporting a run": the run summary the description quotes.
- **`project-profile`** — the `delivery` facts and the DEF-21 choice.
- `templates/pull-request.template.md` — the description template.
