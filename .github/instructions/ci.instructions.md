---
applyTo: '**'
---

# CI

**Purpose.** One behaviour on every CI system: the pipeline file stays thin and calls the kit's script, and the profile decides what runs and what fails the pipeline — so a team can move between CI systems, or read another team's pipeline, without relearning it.

## Critical

_Bullets tagged (DEF-…) are defaults of the `playwright-house-preset`: where `PROJECT-PROFILE.md` records a different choice, follow the profile (see the `project-profile` skill). Untagged bullets always apply._

- **The pipeline calls `scripts/ci-test.mjs`** — once per shard for the runs, once to merge. Selection, shard names and the gate live in the script and the profile, never copied into the pipeline file.
- **The run summary decides the result** _(DEF-22)_: with `ci.gate: summary` the pipeline fails for a new failure or an unstable test, and passes when the only failures are known defects the plan lists. Green means "nothing new is broken" — the summary still shows every failing test (INV-02).
- **A pull request runs the smoke tests and the files the branch changed** _(DEF-22)_ — `ci.pullRequest: smoke+changed`; the nightly run runs everything; tests with the serial tag run alone, with one worker, outside pull requests.
- **Never hide a red pipeline**: no `continue-on-error` on the gate, no retries added to turn a failure into a pass, no test removed from the selection because it fails (INV-02, INV-03).
- **Secrets come from the CI's secret store**, mapped to the env var names the profile lists — never written into the pipeline file, echoed, or printed by a debug step (INV-04). Reports and traces a pipeline keeps are readable by everyone with access to it: keep tracing off where a real credential is typed.
- **Every run keeps its reports** — the blob reports for the merge, then `reports/` (JSON, HTML, the run summary) — and shows `reports/run-summary.md` where the CI shows job summaries.
- **Changing what a pipeline does on other people's branches is an outward step**: propose the pipeline change, and apply it after the user's go-ahead (INV-10).
- **A pipeline publishes nothing on its own authority.** Posting on a pull request, opening an issue or pushing a branch from CI happens only under a standing approval in the profile that is in force that day; `scripts/ci-publish.mjs` checks it. Drafts written by CI — the triage report, defect reports — decide nothing (INV-10, INV-11).

## Triggers

- "Add CI for the tests", "run the tests on pull requests", "why is the pipeline red?", "make the pipeline faster", "move the pipeline to <system>".
- Installing the kit in a repository with or without a pipeline (`kit-tailor`).

## Inputs

- Required: the profile's `ci` block (system, gate, pull request scope, shards, smoke and serial tags), `env` (variable names) and `delivery.baseBranch`.
- Optional: an existing pipeline; the CI's limits (parallel jobs, minutes, artifact retention).

## Discovery

1. **`PROJECT-PROFILE.md`** → `ci`, `env`, `tags`, `delivery`.
2. **The existing pipeline**, if any — what it runs, where secrets come from, which reports it keeps.
3. **The Playwright version** in `package.json` — container images must match it.
4. **For a red pipeline** — the run summary artifact first (`reports/run-summary.md`): which scenarios are `failed-new` or `unstable`, and which step failed.

## Decision rules

**What each job runs** — `node scripts/ci-test.mjs`:

| Call                                                    | Runs                                                                                                                                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--mode pull-request [--shard i/n] [--base origin/<b>]` | `smoke+changed`: the smoke tag, then files changed against the base (and files that import them) without the smoke and serial tags. `smoke`: the smoke tag only. `all`: as nightly  |
| `--mode nightly [--shard i/n]`                          | everything except the serial tag                                                                                                                                                    |
| `--mode serial`                                         | the serial tag alone, one worker; nothing when the profile has no serial tag                                                                                                        |
| `--merge`                                               | merges `blob-report/` into `reports/results.json` and `reports/playwright-report/`, writes the run summary, and — with the summary gate — fails for new failures and unstable tests |

After the merge, two more calls — both safe to run on every pipeline:

| Call                                                                     | Does                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node scripts/triage-draft.mjs`                                          | Writes `reports/triage.md` and one `reports/defect-<ID>.md` per new failure of a scenario, from the run summary — drafts with nothing decided; no AI involved; nothing when the run is clean                                                                                                |
| `node scripts/ci-publish.mjs --what run-summary` / `--what triage-issue` | Posts the run summary on the pull request, or opens or updates one "needs confirmation" triage issue — **only** under the matching standing approval in force; otherwise it says so and publishes nothing. Automated for GitHub with `gh`; on other hosts it names the file to post by hand |

**Per system** — templates in `templates/ci/`; `kit-tailor` copies the right one, which then belongs to the project. The GitHub Actions template's action versions were checked against their latest releases; none of the four templates has run on a real CI yet — the first pipeline run is the proof.

| System (`ci.system`) | Template → where it goes                             | Shards                                        | Run summary shown as                         |
| -------------------- | ---------------------------------------------------- | --------------------------------------------- | -------------------------------------------- |
| `github-actions`     | `github-actions.yml` → `.github/workflows/tests.yml` | a matrix; blob reports as artifacts           | the job summary (`$GITHUB_STEP_SUMMARY`)     |
| `gitlab-ci`          | `gitlab-ci.yml` → `.gitlab-ci.yml`                   | `parallel`; `CI_NODE_INDEX` / `CI_NODE_TOTAL` | a job artifact                               |
| `azure-pipelines`    | `azure-pipelines.yml` → `azure-pipelines.yml`        | `strategy.parallel`; job position / total     | the run's summary tab (`task.uploadsummary`) |
| `jenkins`            | `Jenkinsfile` → `Jenkinsfile`                        | one by default; parallel stages for more      | an archived artifact                         |
| `other`              | the four calls above, in that system's own format    | pass `--shard i/n` per parallel job           | wherever the system shows Markdown or files  |

- **The gate.** `summary` (preset): test jobs exit 0 once they wrote their report; the merge job is the gate. `exit-code` (a DEF-22 override): Playwright's exit code fails the test job, and known defects turn the pipeline red.
- **A run that writes no report** is a configuration or environment error — the script fails that job under either gate.
- **The changed-files run needs history**: fetch the base branch (full depth, or enough to reach the merge base).
- **Shards.** Keep the pipeline's shard count equal to `ci.shards`; more shards cost more setup time than they save on a small suite.
- **Retries** stay as the Playwright configuration sets them; a test that passes only on a retry is `unstable`, and the summary gate fails for it.
- **Browsers.** Install only the browsers the Playwright projects use, or use the Playwright container image of the same version.
- **Publishing from CI needs a standing approval** in the profile (`standingApprovals`): `post-run-summary` for the run summary as a pull request comment, `open-triage-issue` for a "needs confirmation" issue, `push-fixes-as-draft-pr` for test fixes on a task branch. Without one in force, the summary stays in the job summary and the artifacts.

## An agent on CI — the contract

Running the healer role unattended is optional, and every AI tool has its own way to run without a person at the keyboard; the kit ships no tool-specific job yet. Whatever runs it keeps to this contract:

| Point       | Rule                                                                                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runs        | after the summary job, only when the run has new failures or unstable tests, with its own time limit                                                                                     |
| Starts from | `reports/run-summary.json`, the draft `reports/triage.md`, the plans, the profile — files, not a prompt full of history                                                                  |
| Acts as     | the `test-healer` role (`roles/healer.md`) — nothing wider                                                                                                                               |
| May write   | test-side fixes for tests of the branch's task, within `execution.repairAttempts`; `reports/triage.md`; defect drafts; a new run summary                                                 |
| May publish | only what a standing approval in force covers — `push-fixes-as-draft-pr`, `post-run-summary`, `open-triage-issue` — naming the approval                                                  |
| Never       | the base branch, a merge, a force-push; confirming, marking or filing a defect; weakening or skipping a test; changing a plan's expectations, the pipeline, the profile or the approvals |
| Credentials | the AI tool's key comes from the CI's secret store and is given to that job only; the test credentials stay with the test jobs                                                           |
| Ends with   | the triage report updated and a run summary for its last change; without `push-fixes-as-draft-pr`, its fixes stay a proposal in the triage report, not a branch                          |
| In doubt    | it stops and leaves the decision in the triage report — its output is a draft for a person, like the rest of triage                                                                      |

## Workflow

**Adding or changing a pipeline**

1. Read the profile and the existing pipeline (Discovery).
2. Copy the system's template, or adapt the existing pipeline to the four calls; fill in the variable names and the shard count.
3. Run the same calls locally where the environment allows: `node scripts/ci-test.mjs --mode pull-request --base <base>` then `--merge`.
4. Propose the change; apply it after the go-ahead. The first real run is the verification — report its result.

**A red pipeline**

1. Open the run summary: `failed-new` and `unstable` scenarios, the failed steps.
2. Hand the failures to the `debugging` skill (the healer role) — product or test.
3. Never make the pipeline green by changing the gate, the selection or the test.

## Outputs

- The pipeline file, in the project's repository.
- Per run: `blob-report/` (kept briefly), `reports/results.json`, `reports/playwright-report/`, `reports/run-summary.json` and `.md`.

## Verification

- `npm run test:kit` — the kit's tests cover what each mode runs and that every template calls the script.
- The local run of step 3; then the first pipeline run on the real CI: every job green or red for the reason the summary gives.
- `npm run profile:check` — the `ci` block is valid and its tags are tags the project uses.

## Stop conditions

- The CI system is not one of the four and its format is unknown — ask for an example pipeline of the project.
- Secrets or variables the profile names do not exist in the CI — ask; never invent values or commit them.
- The pipeline needs rights the agent does not have (protected branches, pipeline settings).

## Extension points

- The profile sets the system, the gate, the pull request scope, the shard count and the tags; another gate or scope is a DEF-22 override with its reason.
- The copied pipeline belongs to the project: schedules, runners, caches, notifications and extra jobs are the project's to add — the four calls stay.
- An agent on CI follows the contract above; tool-specific job examples are later kit work.

## See Also

- **`test-standards`** — "Reporting a run": the run summary and its states.
- **`debugging`** — reading a failed run; failures that happen only on CI.
- **`pull-requests`** — the run summary in the description.
- **`kit-tailor`** — installing the pipeline template.
- `templates/ci/`, `scripts/ci-test.mjs`.
