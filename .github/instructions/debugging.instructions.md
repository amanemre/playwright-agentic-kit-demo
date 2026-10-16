---
applyTo: 'tests/**/*.ts'
---

# Debugging

When a test fails, you investigate first and fix second. This skill is the canonical entry point for **after** a test breaks — what to look at, in what order, with which Playwright tool.

## Critical

_Bullets tagged (DEF-…) are defaults of the `playwright-house-preset`: where `PROJECT-PROFILE.md` records a different choice, follow the profile (see the `project-profile` skill). Untagged bullets always apply._

- **ALWAYS read the failure message first.** Playwright errors identify the failing locator, assertion, timeout type, and source line. Skim the message before changing any code or guessing.
- **NEVER suppress a failure.** Don't `test.skip` / `test.fixme` / `test.fail` a failing test to get a green run (see "No Silent Coverage Drops") — a confirmed product defect is skipped only in a project whose profile chooses quarantine (DEF-20), in the quarantine form, don't loosen an assertion, don't bump timeouts to make a flake pass, don't `try/catch` an `expect` to swallow it. If the API genuinely misbehaves, follow the `api-testing` Phase 7 behaviour-mismatch protocol.
- **Fix the test, not the pass/fail status.** Before changing any code, decide whether the product or the test is wrong (Phase 2b). A product defect or a site outage leaves the test untouched and red — a passing test that no longer catches the defect is worse than a failing one, because nobody sees it.
- **Check the app before blaming a locator.** Read the browser console and network (`playwright-cli console`, `playwright-cli network`) before assuming a locator drifted: a JavaScript error or a 4xx / 5xx answer means the app is broken, and the test should fail.
- **Stop after two failed fix attempts.** Report both attempts and what each showed, then ask the human — never keep iterating in the hope that something works.
- **NEVER add `page.waitForTimeout(...)` to "fix" a timing issue.** Hard waits hide the real cause. Use a web-first assertion (`await expect(locator).toBeVisible()`) or `page.waitForResponse(...)` instead.
- **NEVER push a fix you can't reproduce locally.** Pull the CI trace and replay it before believing the issue is resolved.
- **`trace` is opt-in for retries.** This scaffold's `playwright.config.ts` sets `trace: 'on-first-retry'`. Locally `retries: 0`, so traces are **NOT** captured by default. To get a trace locally, either run with `--trace on` (or `--trace retain-on-failure`) or use UI Mode (`npm run test:ui`). _(DEF-19)_
- **Prefer UI Mode (`npm run test:ui`) for interactive debugging.** It's the fastest feedback loop — every test step is replayable, locators are live-pickable, the DOM at each step is inspectable. Reach for it before the Inspector or `console.log`. _(DEF-19)_
- **Re-run multiple times before declaring a flake fixed.** A passing run after one fix is not enough; aim for at least 5 consecutive green runs of the affected test before closing the issue.
- **Keep `forbidOnly: !!process.env.CI` in mind.** `test.only(...)` is your friend locally for narrowing — but **do not commit it**. CI will fail the build.
- **Re-run lint and the full affected file after each fix** — `npx eslint .` and `npx playwright test <file>` before moving on.
- **Reproduce first, fix only the cause.** See the failure (locally or in its trace) before changing anything, and let the same run prove the fix. The fix touches only what the failure needs (INV-12) — no clean-up of neighbouring tests on the way.
- **Stop at the repair limit.** One failing test gets at most `execution.repairAttempts` fix attempts (from the profile) in a task; after that, stop on that test and report what was tried — more attempts are the user's call.

## Capture Defaults (this scaffold)

What the scaffold automatically captures and where it lives. From `playwright.config.ts`:

| Artifact    | Default                                 | Where it ends up                                                |
| ----------- | --------------------------------------- | --------------------------------------------------------------- |
| Trace       | `on-first-retry`                        | `reports/test-results/<test-id>/trace.zip` — only after a retry |
| Screenshot  | `only-on-failure`                       | `reports/test-results/<test-id>/test-failed-1.png`              |
| Video       | `retain-on-failure`                     | `reports/test-results/<test-id>/video.webm`                     |
| HTML report | open `on-failure` (local), `never` (CI) | `reports/playwright-report/index.html`                          |
| Blob report | CI only                                 | `reports/blob-report/` (used to merge sharded runs)             |

**Timeouts in effect:**

| Setting                | Value    | What it bounds                                           |
| ---------------------- | -------- | -------------------------------------------------------- |
| `actionTimeout`        | 10000 ms | One Playwright action (`click`, `fill`, etc.)            |
| `navigationTimeout`    | 30000 ms | `page.goto(...)`, `page.waitForURL(...)`, etc.           |
| `expect.timeout`       | 10000 ms | One web-first assertion (`toBeVisible`, `toHaveText`...) |
| `timeout` (test-level) | 60000 ms | The whole test                                           |

If you hit a timeout, knowing which one tells you whether the issue is action / navigation / assertion / overall test pacing.

## Built-in npm scripts for debugging

| Command                                         | What it does                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:ui`                               | Open Playwright **UI Mode** — interactive runner with timeline, locator picker, watch mode. **Default first choice for any debugging.**                                                                                                                                                                                                                          |
| `npm run test:debug`                            | Run with **Playwright Inspector** (`--debug`). Pauses before each step; `F10` to step. Best for breakpoint-style stepping through a single test.                                                                                                                                                                                                                 |
| `npm run test:headed`                           | Run headed Chromium (`--headed`). Watch the browser do the run. Excludes `@destructive`.                                                                                                                                                                                                                                                                         |
| `npm run report`                                | Open the last `reports/playwright-report/index.html`. Use after any failed run for screenshots, videos, traces, error stacks.                                                                                                                                                                                                                                    |
| `npx playwright show-trace <path/to/trace.zip>` | Open the **GUI** Trace Viewer on a specific trace file (e.g. one downloaded from CI artifacts).                                                                                                                                                                                                                                                                  |
| `npx playwright trace open <path/to/trace.zip>` | Open the **CLI** Trace inspector (Playwright 1.59+) — extracts the trace for headless `actions`, `action <id>`, `snapshot <id>`, `requests`, `console`, `errors`, `screenshot` subcommands. **Best for agent-driven post-mortem** in headless / CI / SSH contexts where launching the GUI Viewer isn't practical. Close with `npx playwright trace close`.       |
| `npx playwright test --debug=cli`               | **CLI debugger (Playwright 1.59+)** — emits `playwright-cli attach <session-id>` instructions and pauses. Step with `playwright-cli --session=<id> step-over`, inspect with `playwright-cli --session=<id> snapshot`. Best for agentic workflows that can't drive the GUI Inspector. The default `npm run test:debug` (`--debug` alone) keeps the GUI Inspector. |
| `npm test`                                      | The full suite, excluding `@destructive`. Use only after a focused debug run is green.                                                                                                                                                                                                                                                                           |

For ad-hoc options: `npx playwright test <file> --trace on --workers=1 --retries=0 --headed` is the standard "force-everything-on, deterministic" command for local investigation.

## Instructions

### Phase 1: Read the failure message

Open the terminal output **before** opening any browser. Playwright's error structure is:

1. The test that failed (file + line + title).
2. The exact assertion / action that failed and the **received** vs **expected** values (or the locator that timed out).
3. The call stack — the source line where the assertion lives.
4. Snippet of related code with the failing line highlighted.

Read all four parts. Most failures get diagnosed here without opening any tool.

### Phase 2: Classify the failure mode

Map the message to the right category — each routes to a different tool and sometimes a different skill.

| Failure type                               | Symptom                                                                                                                                           | Most likely cause                                                                                                                     | Where to investigate                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `TimeoutError` on **action**               | `locator.click() Timeout 10000ms exceeded`                                                                                                        | Locator wrong, element disabled, page hasn't loaded                                                                                   | Trace Viewer (action panel + DOM snapshot at the moment of timeout)                                                       |
| `TimeoutError` on **assertion**            | `expect(locator).toBeVisible() Timeout 10000ms exceeded`                                                                                          | Element legitimately not visible, wrong locator, race with navigation                                                                 | UI Mode + retake snapshot just before the assertion                                                                       |
| `TimeoutError` on **navigation**           | `page.goto(...) Timeout 30000ms exceeded`                                                                                                         | Wrong URL, env not set, app down, slow first-load (cold cache)                                                                        | Verify `process.env.APP_URL`; curl it; check `env/.env.${ENVIRONMENT}`                                                    |
| **Strict mode violation: 2 elements**      | `Error: strict mode violation: getByRole(...) resolved to 2 elements`                                                                             | Locator matches multiple — selector too loose                                                                                         | `selectors` skill; add `{ exact: true }`, scope to a parent, switch to a more specific role                               |
| `expect()` mismatch                        | `Expected: "X" / Received: "Y"`                                                                                                                   | Page state, data, or the **enum value** drifted                                                                                       | Compare received vs expected; if a `Messages.*` value drifted, follow `refactor-values`                                   |
| `ZodError`                                 | `expect(SchemaName.parse(body)).toBeTruthy()` throws                                                                                              | API response disagrees with the schema (contract drift)                                                                               | If the contract is documented, this is a **bug** → `api-testing` Phase 7. If not, schema needs updating to the real shape |
| Network error                              | `ECONNREFUSED`, `getaddrinfo ENOTFOUND`, 5xx                                                                                                      | Wrong base URL, app/API down, missing env var, missing token                                                                          | Verify `process.env.API_URL`, `process.env.ACCESS_TOKEN`; see the `config` and `helpers` skills                           |
| Element not found                          | `Error: locator.X: ... element is not attached to the DOM`                                                                                        | Page replaced before action, frame swap, navigation race                                                                              | Trace Viewer; check if action fired before/after navigation                                                               |
| `ReferenceError` / `TypeError`             | `pageManager is undefined`, `cannot read property X of undefined`                                                                                 | Fixture not registered, bad import (from `@playwright/test` instead of `fixtures.ts`), missing factory output                         | `fixtures` / `test-standards` Critical                                                                                    |
| Test passes alone, fails in suite          | Green with `--grep`, red without                                                                                                                  | Test independence violated (shared state, missing `resetStorageState`, parallel collision)                                            | `test-standards` Phase 9; promote shared mutators to `@destructive` with cleanup                                          |
| Action does nothing, no error              | A click / `press` passes, but the next check fails: no dialog, no navigation, no change                                                           | The control is driven by the page's own script and the click landed before the script bound it — common right after a link navigation | Trace Viewer: compare the action's time with the page's `DOMContentLoaded`; rerun headed with network throttling          |
| Red only in the full run, or only at times | Green alone and on a rerun; timeouts or missing elements under load; gateway / CDN error pages (5xx — the profile lists the site's known outages) | Load on the shared live site, an outage, or a race that only slow answers expose                                                      | Rerun the failing tests alone; look at the page and status in the trace — a 5xx page is category E (Phase 2b)             |
| `forbidOnly` failed the build              | `Error: focused tests are not allowed in CI`                                                                                                      | A `test.only(...)` was committed                                                                                                      | Remove `test.only(...)` from the spec                                                                                     |

### Phase 2b: Decide who is wrong — the product or the test

A red test means the product, the environment or the test is wrong, and only the last one is fixed in the test code. Gather the evidence first — the failure message, the trace or a `playwright-cli snapshot` of the same page, `playwright-cli console` (JavaScript errors) and `playwright-cli network` (4xx / 5xx answers) — then give the failure one category:

| Category             | What happened                                                                                                           | What you change                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **A Locator drift**  | The element is there; its role, name or text changed                                                                    | The page object's getter (`selectors`)                                                                                                |
| **B UI restructure** | The element moved, or the flow has a new step                                                                           | The page object's action; the test's steps only if the user's flow changed                                                            |
| **C Copy change**    | The text on screen changed on purpose (confirm it in the live app)                                                      | The `Messages.*` / headings enum via `refactor-values` — never a string in the spec                                                   |
| **D Product defect** | The feature is broken, or behaves against the agreed behaviour in the plan                                              | Nothing in the test. It stays red; list it in the plan's "Why tests currently fail" and report it (`api-testing` Phase 7 for the API) |
| **E Environment**    | The site is down or overloaded (gateway / CDN 5xx pages — see the profile's Environment section), an env var is missing | Nothing in the test. Report it and rerun once the site is back                                                                        |
| **F Timing**         | The test acted or checked before the page was ready (script race, animation, slow answer)                               | A wait for a real state in the page object (Phase 5) — never a hard wait or a longer timeout                                          |

If you cannot give a category with confidence, stop and ask the human. D and E are reported, never fixed in the test: a test changed until it passes a broken feature hides the defect from every later run.

### Phase 3: Reproduce locally

Before opening any tool, narrow the run so you have a tight feedback loop.

```bash
# Option A -- run a single spec file with retries off and a single worker
npx playwright test tests/{area}/functional/login.spec.ts --workers=1 --retries=0

# Option B -- narrow further with --grep (matches tag or test title)
npx playwright test --grep "login with a wrong password shows an error message" --workers=1 --retries=0

# Option C -- last resort, narrow with `test.only(...)` in the spec file (DO NOT COMMIT)
test.only('login with a wrong password shows an error message', { tag: '@regression' }, async (...) => { ... });
```

If the test is green locally but red in CI, skip to Phase 7.

### Phase 4: Investigate with the right tool

Pick one — don't bounce between three.

#### UI Mode — `npm run test:ui` (default first choice)

Best when you can reproduce locally and want fast iteration.

- Click the failing test in the sidebar to replay it.
- Use the **timeline** to scrub through every action; each step shows the DOM snapshot at that moment.
- Use the **Pick locator** tool to test a candidate selector against the live DOM.
- Watch mode re-runs on save — change the page object or test, see the result instantly.
- The **Network** tab shows API calls (URL, status, request/response) — directly answers many `ZodError` questions.

#### Trace Viewer — `npx playwright show-trace <path/to/trace.zip>` (GUI post-mortem)

Best when you have an existing trace (failed CI run, locally captured with `--trace on`) and a desktop browser handy.

- Action panel: every Playwright call with input args and outcome.
- DOM snapshots: before / during / after each action.
- Console + Network panels: app logs and API traffic at exactly the right moment.
- Source panel: the test code highlighted at the failed line.

If `reports/playwright-report/` opened automatically and showed a failure, the trace is linked from the report — click "Trace" on the failed test card.

#### CLI Trace inspection — `npx playwright trace ...` (agent-friendly post-mortem, Playwright 1.59+)

Best when you're driving headless (CI agent, remote SSH, container with no display) or you want to grep across trace contents programmatically.

```bash
# Extract the trace for inspection
npx playwright trace open path/to/trace.zip

# List all actions; --grep narrows to a substring
npx playwright trace actions
npx playwright trace actions --grep "expect"

# Drill into one action (use the action number from the listing)
npx playwright trace action 9

# DOM snapshots before / after the action (uses playwright-cli under the hood)
npx playwright trace snapshot 9 --name before
npx playwright trace snapshot 9 --name after

# Network / console / errors / screenshots / attachments
npx playwright trace requests
npx playwright trace console
npx playwright trace errors
npx playwright trace screenshot 9

# Done — clean up the extracted data
npx playwright trace close
```

This is the same trace data as `show-trace`, but addressable from the terminal. Switch between GUI and CLI based on context — they're not exclusive.

#### Playwright Inspector — `npm run test:debug` (interactive breakpoint stepping)

Best when you suspect logic in your test/page object and want to step through it line-by-line in the GUI Inspector.

- The browser opens with the inspector overlay.
- `F10` to step over each action.
- Set breakpoints in code (`debugger;`) and they trigger.
- Locator highlight in the page makes selector verification trivial.

For agent-driven stepping (no GUI), use `npx playwright test --debug=cli` instead — Playwright pauses and prints `playwright-cli attach <session-id>` so an agent can drive `playwright-cli --session=<id> step-over` / `... snapshot` / etc. from the terminal. Same lifecycle, headless-friendly.

#### Headed mode — `npm run test:headed`

Best when you need to **watch** the browser do something specific you can't see in trace replay (animations, async loading races, tooltip behaviour).

### Phase 5: Apply the fix at the root cause

Map the diagnosis to a fix in the right place. **Do not patch in the test if the bug lives in a page object or schema.**

| Diagnosis                                                              | Fix lives in                                                                                                                                                                                  |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Locator returned wrong/zero/many elements                              | The page object's getter (see `selectors` + `page-objects`)                                                                                                                                   |
| Action raced ahead of navigation                                       | The page object's action method — add `page.waitForResponse(...)` for the API or a web-first assertion for the post-nav state                                                                 |
| `Messages.X` value drifted from the live UI                            | `enums/{area}/*.ts` via the `refactor-values` workflow                                                                                                                                        |
| Schema disagreed with documented contract                              | Nothing — the test stays red until the API is fixed (`api-testing` Phase 7). **NEVER** loosen the schema                                                                                      |
| Schema disagreed with the real response (no docs)                      | The schema (`fixtures/api/schemas/...`) — update to match                                                                                                                                     |
| Auth setup fails when it checks the credentials                        | `APP_EMAIL` / `APP_PASSWORD` in `env/.env.*` are not a registered account — see the `helpers` skill                                                                                           |
| Fixture missing (`pageManager` is undefined) or a page missing from it | `fixtures/pom/page-object-fixture.ts` / a getter in `pages/page-manager.ts` — see the `fixtures` skill                                                                                        |
| Tag combined / wrong                                                   | The test header — `test-standards` single-tag rule                                                                                                                                            |
| Hardcoded string in `getByText(...)`                                   | Replace with `Messages.*` enum (`enums` skill)                                                                                                                                                |
| Click landed before the page's script bound the control (F)            | The page object's action — `await this.page.waitForLoadState('domcontentloaded')` before acting; for an animation, wait until its in-between state is gone (`expect(...).toHaveCount(0)`)     |
| Product defect (D) or site outage (E)                                  | Nothing in the test — list the defect in the plan's "Why tests currently fail" (a project that quarantines known defects: the quarantine form, `api-testing` Phase 7); after an outage, rerun |
| Test depends on another test's side-effect                             | Move the setup into `beforeEach` / a fixture; use a factory for unique data per test                                                                                                          |

### Phase 6: Re-run and confirm stability

A green run after one fix is not enough.

```bash
# Re-run the affected file with retries off
npx playwright test tests/{area}/functional/login.spec.ts --workers=1 --retries=0

# Re-run 5 consecutive times for confidence on flakiness fixes
for i in 1 2 3 4 5; do npx playwright test tests/{area}/functional/login.spec.ts --workers=1 --retries=0 || break; done

# Then re-run the full affected suite
npm test
```

Confirm:

- The originally failing test passes.
- No other test in the file was broken by the fix.
- Lint is clean (`npx eslint .`).
- No `test.only(...)` left behind (CI's `forbidOnly` will catch it, but you should catch it first).

**Load and outage flakes.** A test that fails only in the full parallel run, but passes alone and in 5 consecutive reruns, is reported as a load flake with its evidence (trace, status, error page) — not patched. Add a wait only when the trace shows a real race (category F); an outage (category E) needs no change at all.

### Phase 7: Investigate a CI-only failure (red CI, green local)

When the test passes locally but fails in CI, you need CI's artifacts to reproduce. Start from the run's summary (`run-summary.md`, when CI keeps it): it names the failing scenarios, the steps that failed, and whether each failure is known.

1. **Download the CI artifacts.** GitHub Actions: `Actions → <run> → Summary → Artifacts → playwright-report` (and `test-results` if separate). Or via `gh`: `gh run download <run-id> -n playwright-report`.
2. **Open the report locally.** Unzip `playwright-report.zip`; the trace zips for failed tests live under `data/`.
3. **Open the failed trace.**

    ```bash
    # GUI -- desktop browser, fastest manual review
    npx playwright show-trace path/to/trace.zip

    # CLI -- headless / SSH / agent-driven, scriptable (Playwright 1.59+)
    npx playwright trace open path/to/trace.zip
    npx playwright trace actions
    npx playwright trace action <id>
    npx playwright trace snapshot <id> --name after
    npx playwright trace close
    ```

4. **Compare environments.**
    - Different env file? CI usually has its own `env/.env.ci` or relies on shell env.
    - Different storage state? Check whether `auth.setup.ts` ran and produced `.auth/app/appStorageState.json`.
    - Different viewport / device? `playwright.config.ts` `chromium` project uses `1920x1080`; if your local default differs, layout-sensitive locators may behave differently.
    - Different browser version? CI installs whatever the Docker image / `@playwright/test` version brings.
5. **Replay the same conditions locally.**
    ```bash
    ENVIRONMENT=ci CI=1 npx playwright test <file> --workers=1 --retries=0
    ```
6. If still green locally, the failure is genuinely environment-driven (network, timing, state). Add temporary instrumentation (`console.log`, screenshot, `--trace on`), commit, run in CI, inspect new artifacts, then **remove the instrumentation** before merging.

## Fix report

End every debugging session with this report, so the human sees at a glance that nothing was quietly weakened:

```
## Fix report — <spec path> › <test title>
- Category: <A–F> — <one line>
- Root cause: <plain words>
- Evidence: <snapshot / trace>, console errors: <none / which>, network errors: <none / which>
- Fix: <files and what changed — or "none: product defect" / "none: outage">
- Intent check: check changed? <no/yes> · softened? <no/yes> · skipped? <no/yes> · timeout raised? <no/yes>
- Mutation check: <the temporary change> → failed at <step> — or: not possible, <why>
- Runs: <n> consecutive green — or: red as expected (known defect, listed in the plan)
- Next: <ready / needs review: why / product defect to report: what>
```

Any "yes" in the intent check is a stop: explain why and wait for the human. A skip is never allowed. A fixed test gets a mutation check (FW-12, the `test-standards` skill): a fix after which the test can no longer fail is a weakened check, not a fix.

When a run has several failures — a CI run, or the healer role after a first run — collect the fix reports in one triage report, `reports/triage.md` from `templates/triage-report.template.md` (on CI, `scripts/triage-draft.mjs` writes its first draft from the run summary — start from that file and fill in what it leaves "to decide"): one row per failing or unstable scenario, the fixes made, the product defects for the user to confirm, and what is not resolved.

## See Also

- **`api-testing`** skill — Phase 7 behaviour-mismatch protocol (known defects stay failing tests), Phase 6 negative-coverage patterns where the same `ZodError` types appear.
- **`refactor-values`** skill — when a fix involves changing an enum value, an enum key, or a static-data file (cascading updates and verification).
- **`selectors`** skill — locator priority, scoping for strict-mode violations, exploration-first workflow when a locator no longer matches.
- **`page-objects`** skill — where action methods live; `page.waitForResponse(...)` belongs there, not in the spec.
- **`fixtures`** skill — fixture lifecycle, registration; "fixture is undefined" errors live here.
- **`helpers`** skill — auth bootstrap (credential check + storage state); debug auth-setup failures here.
- **`test-standards`** skill — single-tag rule, destructive cleanup, test independence (Phase 9) — the source of most "passes alone, fails in suite" issues.
- **`type-safety`** skill — Zod 4 patterns, `expect(Schema.parse(body)).toBeTruthy();` enforcement, `zInput` vs `zOutput` confusion behind unexpected `ZodError`s.
- **`config`** skill — env file selection (`ENVIRONMENT`), `process.env.*` correctness, where `APP_URL` / `API_URL` are sourced.
- **`common-tasks`** skill — Phase 7 (Run tests) routes failures here; verification checklist.
- **`ai-native-workflow`** skill — the meta workflow: how to ask, how to escalate, how to commit a fix, and the audit-then-edit pattern that keeps debugging sessions consistent across agents.
