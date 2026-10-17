---
name: test-standards
description: Spec file conventions for the Playwright scaffold — imports from fixtures.ts, test file structure (describe / beforeEach / test / test.step), single-tag rule, functional vs E2E vs API vs setup test types, data-driven test loops against TS static data, web-first assertions, the readable report structure (one step per GIVEN / WHEN / THEN / AND line, one soft check per step, later parts skipped after a failed check), test plans, destructive-test cleanup, and test independence. Use when creating a new spec file, adding tests to an existing spec, deciding which test type or tag to use, writing data-driven loops, wiring destructive cleanup, or reviewing a test for compliance. For deriving a plan's scenarios with test techniques and product risk see the test-design skill. For the deep API test-coverage matrix and negative-testing patterns see the api-testing skill; for factories and static data see the data-strategy skill; for prompt templates see the common-tasks skill; for page object usage from tests see the fixtures and page-objects skills.
author: Ivan Davidov
---

# Test Standards

## Critical

_Bullets tagged (DEF-…) are defaults of the `playwright-house-preset`: where `PROJECT-PROFILE.md` records a different choice, follow the profile (see the `project-profile` skill). Untagged bullets always apply._

- **Imports:** Import `test` and `expect` from `fixtures/fixtures.ts`. **NEVER** from `@playwright/test` in spec files. _(DEF-02)_
- **Single-tag rule:** Each test has **exactly one** tag chosen from `@smoke` | `@sanity` | `@regression` | `@e2e` | `@api` | `@destructive`. **NEVER** combine tags. **NEVER** use `@functional`. **NEVER** put tags on `test.describe()` blocks. _(DEF-06)_
- **`@destructive` is the heaviest tag and always wins — but only for shared/global state.** A test that mutates state other tests or users depend on (locale, permissions, roles, guest access, feature flags, global settings) is tagged **only** `@destructive`. A test that creates and deletes **only its own data** is isolated, not destructive — tag it by importance (`@smoke` / `@sanity` / `@regression` / `@e2e` / `@api`). _(DEF-06)_
- **Every state-mutating test** must revert the change — with `test.afterEach()` / `test.afterAll()`, or with a helper fixture whose teardown deletes what it created (e.g. a `createdUser` fixture) — both `@destructive` shared-state tests and isolated tests that write their own data.
- **Known product defects:** **NEVER** wrap them (`test.fail`, `test.fixme`, `try/catch`) or loosen their checks. Keep the test as the correct behaviour says and let it fail (see the `api-testing` skill, Phase 7); list it in the feature's test plan under "Why tests currently fail". Only when the profile chooses `plans.knownDefects: quarantine` (DEF-20) is a known-defect test skipped instead, in the quarantine form — see "Skipping tests".
- **Web-first assertions only** (`await expect(locator).toBeVisible()`, `.toHaveText()`, `.toBeEnabled()`, `.toHaveCount(...)`, etc.). **NEVER** `page.waitForTimeout(...)`.
- **Readable report structure** (Phase 4): test titles are plain sentences; **every** GIVEN / WHEN / THEN / AND line is its own `test.step()` — never two keywords in one title; each THEN / AND step holds **one soft check** (`expect.soft`) with **no message**; a later part runs only when every check before it passed (`skipIfChecksFailed` / `skipIfEarlierStepSkipped`), otherwise it is shown as skipped; in API specs the schema check comes last. _(DEF-05 — a rule in scaffold mode)_
- **Test plan:** every spec starts with `// plan: test-plans/{area}/<feature>.md`. The plan's scenario headings are the exact test titles, its steps are the step titles, and it lists failing tests under "Why tests currently fail" and skipped tests, with their defect or reason, under "Skipped tests". _(DEF-07)_
- **Test design with test techniques:** a plan's scenarios are derived with ISTQB test techniques chosen by product risk — the `test-design` skill owns how (technique evaluation, models, coverage goals). Each scenario names its technique and what it covers; data-driven loops iterate labelled partition representatives (`{ partition, … }`), never every known value. For a task that writes tests, the plan is the proposal: write specs only after the user approves it.
- **Tests must be independent.** No ordering dependencies, no shared mutable state across tests.
- **NEVER** commit explore-only or debug test files (`.spec.ts` containing `console.log(await page.content())`, temporary probes, etc.).
- **Static test data is imported from `.ts` modules** (`test-data/static/**/*.ts`) via named `as const` exports. **NEVER** `.json`. _(DEF-08)_
- **Dynamic happy-path data** comes from Faker factories (`test-data/factories/{area}/`); universal type-mismatch arrays from `test-data/static/util/invalid-values.ts`; domain-specific curated sets from `test-data/static/{area}/*.ts`. See the `data-strategy` skill. _(DEF-08, DEF-09)_
- **Page objects are consumed via the `pageManager` fixture** (`async ({ pageManager }) => { await pageManager.loginPage.openLoginPage(); }`), using the getter on every line. **NEVER** `new PageObject(page)` inside a test, and never copy a page object into a local variable. _(DEF-01)_
- **After adding or modifying a test file, run the affected tests.** Investigate every failure: a known product defect listed in the test plan stays red; a newly found product or environment failure is reported with its evidence and added to the plan only after the user confirms it; fix any other failure before finishing the task (INV-11).
- **Mutation check.** A new, changed or fixed test is shown to fail once before it counts: one temporary mutation — of an expectation, or of the application's response — the test fails at that step, the mutation is reverted and never committed. One per test; one per check for high-risk scenarios (FW-12, "Mutation check" below).
- **Success checks prove the effect.** A check that an action succeeded observes something that exists only if the action took effect — the data the new session loads, the stored record, the changed state. A URL, a heading or other markup the page shows either way may accompany it, never replace it. Its mutation check fakes the success signal and removes the effect (FW-13, "Mutation check" below).

## Test File Location and Type

> **`{area}` is a placeholder.** Before creating or referencing any path below, run `ls tests/` to discover the real subdirectory names in this repo (e.g., `front-office`, `back-office`) and use those instead.

| Test Type  | Directory                  | What it covers                                         |
| ---------- | -------------------------- | ------------------------------------------------------ |
| Functional | `tests/{area}/functional/` | One feature or behaviour in isolation                  |
| API        | `tests/{area}/api/`        | API contracts and response validation                  |
| E2E        | `tests/{area}/e2e/`        | A complete multi-feature user journey in a single test |
| Setup      | `tests/{area}/`            | Auth or precondition setup (`.setup.ts`)               |

**Functional vs E2E distinction:**

- A **functional test** isolates and verifies a single behaviour (e.g., "adding a todo updates the count"). Each test covers one thing.
- An **E2E test** chains multiple features together in one test that mirrors a real user journey from start to finish (e.g., add items → complete → filter → clear → verify final state). An E2E file typically contains one or a few high-level scenario tests.

## Test Design

The `test-design` skill owns test analysis and test design: the test basis, product risks, the technique evaluation, the models and the coverage goals. Its output is the plan — for a task that writes tests, the plan is the proposal the user approves before any spec is written. This skill owns how the approved scenarios become specs: structure, tags, steps and the report.

### Plan contract

New and migrated plans follow the plan contract: template `templates/plan.template.md`, checked by `npm run plans:check` (structure, sources and readiness; with discovery, the mapping to real tests). A plan opts in with `<!-- plan-contract: 1 -->`; plans not migrated yet keep their format and are reported as such. Each scenario carries, before its steps:

- **ID** (unique across plans), **Tag**, **Priority** (high / medium / low);
- **Purpose** — `conformance` (intended behaviour — needs a requirement or a decision) or `characterization` (recorded current behaviour — an observation is enough);
- **Readiness** — `ready`, `needs-clarification`, `blocked` or `manual`; anything not ready names what blocks it (**Blocked by:**) and blocks only itself;
- **Source** — `requirement — <reference>`, `decision — <who>, <YYYY-MM-DD>, <reference>` or `observation — <YYYY-MM-DD>, <environment>, <evidence>`; never invented;
- **Isolation**, **Technique** and **Covers**, and **Tests** (the spec file);
- for a parameterized scenario, `<placeholder>`s in the heading and a **Cases** list with one representative per partition — each case expands to one test title.

With the preset the scenario heading is the exact test title (DEF-07); an adopted repository maps its existing titles through the IDs instead of renaming tests. Worked example: the project's pilot plan listed in `PROJECT-PROFILE.md`.

### Skipping tests

A skipped test proves nothing, so a skip is rare, visible and explained. `npm run rules:check` (`skip-reason`, INV-02) enforces the two allowed kinds in spec files; `test.fail`, `test.fixme` and skipped `describe` blocks are never allowed.

| Kind                   | When                                                                                                                       | Form                                                                                                                                                                                                 | In the plan                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Not applicable**     | The test cannot apply here — e.g. a browser without the feature                                                            | `test.skip(<condition>, 'n/a: <why it does not apply>')`                                                                                                                                             | "Skipped tests" lists the reason (the text after `n/a:`) |
| **Quarantined defect** | Only with `plans.knownDefects: quarantine` (DEF-20) — a known defect the team keeps out of the CI result until it is fixed | The test as the correct behaviour says, as `test.skip(title, details, body)` under `// FIXME: <ID> — <what is wrong>`, with `annotation: { type: 'defect', description: '<ID> — …' }` in its details | "Skipped tests" lists the defect ID                      |

```typescript
test(
    'Upload a profile picture',
    { tag: '@regression' },
    async ({ browserName, pageManager }) => {
        test.skip(browserName === 'webkit', 'n/a: no file upload on WebKit');
        // …
    }
);

// FIXME: BUG-123 — the cart total ignores the discount
// eslint-disable-next-line playwright/no-skipped-test
test.skip(
    'Cart total includes the discount',
    {
        tag: '@regression',
        annotation: {
            type: 'defect',
            description: 'BUG-123 — the cart total ignores the discount',
        },
    },
    async ({ pageManager }) => {
        // … written as the correct behaviour says …
    }
);
```

Reports show both as skipped, with the reason or defect on the test (HTML and JSON reports; the terminal shows only the count). When reporting a run, list every skipped test with its reason. When the defect is fixed, remove the skip, the comment and the annotation, and its row in "Skipped tests".

### Mutation check

A test that passes proves little until it has been seen to fail. For every new, changed or fixed test, show once that it can fail (FW-12):

1. **Mutate** — make one temporary change that must break the test:
    - **the expectation** — what a check expects: another message, count, status or field value; or
    - **the behaviour** — what the application returns or does: intercept the request and change the response (`page.route`), send different input, or leave out the action the check depends on.
2. **Run it.** The test must fail **at the step the mutation targets**. A failure somewhere else — a timeout, an earlier step — says nothing about that check.
3. **Revert**, and run again: the test is back to its real result.
4. **A test that still passes with the mutation in place** does not check what its title says. Fix the test and repeat — never report it as done.

- **How many.** One mutation per test. One per THEN / AND check for a scenario whose risk level in the plan is high. Tests that share one body — a data-driven loop, a `verify…` function — need the mutations once for that body, not once per case.
- **Which kind.** A behaviour mutation shows the test reacts to the application, so prefer it where interception is possible; an expectation mutation is enough where it is not (most API specs).
- **A success check** (FW-13) gets the mutation that fakes success: keep the signal — the redirect, the success message, the 2xx status — and remove the effect: fail the call that loads the session's data, or the read-back of the stored record. A test that still passes checks the signal, not the effect.
- **Never commit a mutation.** It lives in the working tree for one run; check the diff holds none before reporting.
- **A test that fails as a known defect** has already been seen to fail, at that step — that is its evidence until the defect is fixed. A skipped test cannot be checked: say so.
- **Report it** — in the task's report and the pull request's "Checks run": which tests, which mutation, the step that failed; and any test that survived, with what was wrong.

### Reporting a run

Report what ran from the run summary, never from memory (INV-11). `scripts/run-summary.mjs` reads Playwright's JSON report and gives every planned scenario one state:

| State                                             | Meaning                                                                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `passed`                                          | Every test of the scenario passed on the first try                                                               |
| `unstable`                                        | A test passed only on a retry — reported, never counted as passed (INV-02)                                       |
| `failed-known`                                    | A test failed, and the plan lists the scenario under "Why tests currently fail"                                  |
| `failed-new`                                      | A test failed, and the plan does not list it — a new finding the user confirms before it joins the plan (INV-11) |
| `skipped-na` / `skipped-defect` / `skipped-other` | Skipped with an `n/a:` reason / quarantined with its defect (DEF-20) / skipped without either                    |
| `blocked` / `needs-clarification` / `manual`      | The plan's readiness — no test is expected yet                                                                   |
| `not-run`                                         | The scenario has tests, but none ran in this run (a tag filter, another shard)                                   |

```bash
PLAYWRIGHT_JSON_OUTPUT_NAME=reports/results.json npx playwright test --reporter=list,json
npm run test:summary   # → reports/run-summary.json (for tools) and reports/run-summary.md (for people)
```

- Sharded runs: merge the shards' blob reports into one JSON report first (`npx playwright merge-reports --reporter=json`).
- Tests map to scenarios by title within the scenario's spec file; a test whose title differs from the plan carries `annotation: { type: 'scenario', description: '<ID>' }`.
- Tests in `*.setup.*` files are listed apart; tests no scenario covers are listed as "Tests without a scenario".
- For a failed test the summary keeps its step titles and which of them failed — the readable steps are what a triage or a defect report quotes.
- In CI, `--fail-on new,unstable` exits 1 when there is a new failure or an unstable test. `node scripts/run-summary.mjs --schema` prints the JSON format for other tools.

## Instructions

### Phase 1: Classify the test type and pick the location

Determine whether the work is a **functional**, **E2E**, **API**, or **setup** test, then run `ls tests/` to resolve `{area}` and place the file in `tests/{area}/<type>/[name].spec.ts` (or `tests/{area}/[name].setup.ts` for setup). Never guess the area.

### Phase 2: Write the imports and file skeleton

Every spec file starts with:

```typescript
// plan: test-plans/{area}/feature-name.md
import { expect, test } from '../../../fixtures/fixtures';

test.describe('feature name', () => {
    test.beforeEach(async ({ pageManager }) => {
        await pageManager.loginPage.openLoginPage();
    });

    test(
        'user does something and sees the expected result',
        { tag: '@smoke' },
        async ({ pageManager }) => {
            // one test.step per GIVEN / WHEN / THEN / AND line — see Phase 4
        }
    );
});
```

- The first line names the test plan. Write the plan first: its scenario headings are the exact test titles.
- If `test-plans/{area}/<feature>.md` already exists, ask before overwriting it — extend it instead. A new plan's header table names the feature, the spec, the pages, how they were explored (`playwright-cli`, the site's scripts, the API) and the date of the exploration, since the app may have changed since.
- Imports come from `fixtures/fixtures.ts`, **not** `@playwright/test`.
- `test.describe(...)` groups related tests; the describe name has **no tag**.
- `test.beforeEach(...)` handles navigation and per-test setup (see Phase 7 for destructive cleanup and Phase 6 for `resetStorageState`).

### Phase 3: Tag the test (single-tag rule)

Each test gets **exactly one** tag. Pick the right one:

| Tag            | Used for                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@smoke`       | Critical path functional tests, run first and frequently                                                                                                                  |
| `@sanity`      | Key functionality verification                                                                                                                                            |
| `@regression`  | Full regression coverage of a single behaviour                                                                                                                            |
| `@e2e`         | End-to-end multi-feature user journey tests                                                                                                                               |
| `@api`         | API contract and schema validation tests                                                                                                                                  |
| `@destructive` | Mutates **shared/global** state (locale, permissions, roles, guest access, feature flags, global settings) — excluded from `npm test`, run via `npm run test:destructive` |

**`@destructive` overrides any other importance tag — for shared/global state mutation only.** If a test would otherwise be `@smoke` but changes global settings, it is tagged **only** `@destructive`. A test that creates and cleans up **only its own data** is isolated, not destructive — keep its importance tag (`@smoke`/`@regression`/`@api`/…).

```typescript
// CORRECT
test(
    'registered user can log in',
    { tag: '@smoke' },
    async ({ pageManager }) => {
        /* ... */
    }
);
test(
    'user adds a product to the cart and checks out',
    { tag: '@e2e' },
    async ({ pageManager }) => {
        /* ... */
    }
);
test(
    'GET /users/me returns the logged-in user',
    { tag: '@api' },
    async ({ apiRequest }) => {
        /* ... */
    }
);
test(
    'admin deletes all users',
    { tag: '@destructive' },
    async ({ apiRequest }) => {
        /* ... */
    }
);

// WRONG -- @functional is not a valid tag
test('user logs in', { tag: '@functional' }, async ({ pageManager }) => {
    /* ... */
});

// WRONG -- combining tags is forbidden
test(
    'admin deletes all users',
    { tag: ['@regression', '@destructive'] },
    async () => {
        /* ... */
    }
);

// WRONG -- tag belongs on the test, not the describe
test.describe('Feature @smoke', () => {
    /* ... */
});
```

### Phase 4: Structure the test body for a readable report

The report is read by people who do not read the code, so a test reads like its test plan.

**Mode.** In a new project set up with the preset (scaffold mode) this structure is a rule. In an adopted repository it is recommended, not imposed: `PROJECT-PROFILE.md` → `reporting.style` records the project's choice — follow it (see the `project-profile` skill). Moving existing tests to it is a separate task the user approves.

**Titles.** A test title is a plain sentence that says what happens — `newly registered user can delete their account from the header`, `POST /api/users with an empty "name" returns 400 and an error message naming the field`. No `should`. The title is also the plan's scenario heading.

**One line, one step.** Every GIVEN / WHEN / THEN / AND line is its own `test.step()`. Never put two keywords in one title (`WHEN … THEN …`), and never hide several checks behind one THEN.

**One soft check per THEN / AND step, no message.** Each THEN / AND step holds exactly one `expect.soft(...)`. The step title says what is checked, so the check gets no `expect` message — Playwright appends the locator to a message and the report line turns into noise. A failed soft check marks its step failed and lets the next checks run, so the report shows every failing check, not only the first.

**Parts.** A test is a sequence of parts: an action (GIVEN or WHEN) and the checks on its result. All checks of one part run. The next part runs only when every check before it passed — otherwise it would act on a broken state and add confusing failures. It is still shown, as skipped with "Not run: a check above failed":

- the action that starts a later part calls `skipIfChecksFailed(step)` first;
- each check of that part calls `skipIfEarlierStepSkipped(step)` first;
- a skipped step returns `undefined`, so read its result only inside steps that are skipped with it.

With the preset both helpers live in `helpers/util/softChecks.ts` (the profile's `reporting.helper`); without it, use the equivalent the profile names or report the gap — never import a helper that is not there. The first part needs neither.

**Setup guards.** A GIVEN step may end with one hard check that its setup worked — `expect(status).toBe(HttpStatusCodes.CREATED)` — with no message. When setup fails, nothing after it can run, so the test stops there.

**Starting state.** Create the GIVEN state through the API where possible — a helper fixture such as `createdUser` (created before the test, deleted after it) — instead of clicking through the UI. A test that needs an existing account uses such a fixture, never a shared registered account (e.g. the one in `APP_EMAIL`). When every test in a file starts logged out, put `test.use({ storageState: { cookies: [], origins: [] } })` at the top of the file.

**Prerequisites without schema checks.** API calls that set up or clean up a test (`beforeEach`, helper fixtures, helpers, GIVEN steps) check only the HTTP status and the outcome they rely on — never the schema: a schema defect must fail the API spec that covers it, not block every test that uses the data.

**API checks in UI tests.** The API specs own status codes and schemas. A UI test that reads back through the API only to confirm its UI action checks the message or the stored data — no status, outcome-field or schema steps.

**API specs.** Each response gets `THEN HTTP status is …`, the API's outcome field when the profile names one, `AND the message is …`, any field checks, and last `AND the response body has the expected schema` — the one hard check (`expect(Schema.parse(body)).toBeTruthy()`), last because a failed parse stops the test. See the `api-testing` skill, Phase 4.

UI example (Example Shop, shortened — the project's worked examples are listed in `PROJECT-PROFILE.md`):

```typescript
test.use({ storageState: { cookies: [], origins: [] } });

test(
    'newly registered user can delete their account from the header',
    { tag: '@regression' },
    async ({ page, createdUser, pageManager, apiRequest }) => {
        await test.step('GIVEN the user is logged in', async () => {
            await pageManager.loginPage.open();
            await pageManager.loginPage.loginAndVerify(
                createdUser.email,
                createdUser.password
            );
        });

        await test.step('WHEN they click Delete Account in the header', async () => {
            await pageManager.loginPage.nav.deleteAccount();
        });

        await test.step(`THEN the URL is ${AppRoutes.ACCOUNT_DELETED}`, async () => {
            await expect
                .soft(page)
                .toHaveURL(
                    `${process.env.APP_URL}${AppRoutes.ACCOUNT_DELETED}`
                );
        });

        await test.step(`AND the "${Messages.ACCOUNT_DELETED}" heading is shown`, async () => {
            await expect
                .soft(pageManager.accountPage.deletedHeading)
                .toBeVisible();
        });

        // Next part: runs only when every check above passed, otherwise shown as "Not run"
        const response =
            await test.step(`WHEN the user is requested through GET ${ApiEndpoints.USERS}/<id>`, async (step) => {
                skipIfChecksFailed(step);
                return apiRequest<NotFoundResponse>({
                    method: 'GET',
                    url: `${ApiEndpoints.USERS}/${createdUser.id}`,
                    baseUrl: process.env.API_URL,
                    headers: process.env.ACCESS_TOKEN,
                });
            });

        await test.step(`THEN the API answers "${ApiMessages.USER_NOT_FOUND}"`, (step) => {
            skipIfEarlierStepSkipped(step);
            expect.soft(response.body.message).toBe(ApiMessages.USER_NOT_FOUND);
        });
    }
);
```

When the heading check fails, the report reads:

```
newly registered user can delete their account from the header
  ✓ GIVEN the user is logged in
  ✓ WHEN they click Delete Account in the header
  ✓ THEN the URL is /account/deleted
  ✗ AND the "Account deleted" heading is shown
  ↷ WHEN the user is requested through GET /api/users/<id>     Not run: a check above failed
  ↷ THEN the API answers "User not found"     Not run: a check above failed
```

**Forbidden:**

```typescript
// WRONG — two keywords in one title, several checks in one step
await test.step('WHEN they submit the form THEN the account is created', async () => {
    await pageManager.signupPage.submit();
    await expect(page).toHaveURL(...);
    await expect(heading).toBeVisible();
});

// WRONG — the message becomes the report line, with the locator appended
await expect.soft(heading, 'THEN the heading is shown').toBeVisible();

// WRONG — a later part runs on top of a failed check
const response = await test.step('WHEN the account is requested', () => apiRequest({ ... }));
```

### Phase 5: Use web-first assertions

Web-first assertions auto-wait and retry until the condition is met or a timeout elapses. Never use hard waits.

```typescript
// CORRECT -- web-first assertions
await expect(locator).toBeVisible();
await expect(locator).toHaveText('Expected text');
await expect(locator).toBeEnabled();
await expect(locator).toHaveCount(3);

// FORBIDDEN -- hard waits mask real timing issues
await page.waitForTimeout(1000);
```

If a response must be awaited, use `page.waitForResponse(...)` inside a page-object action method, not inside the spec.

### Phase 6: Handle setup / teardown and storage state

- Use `test.beforeEach()` for per-test navigation and setup.
- Create starting data through the API with a helper fixture (e.g. `createdUser`); its teardown deletes the data, so no cleanup hook is needed for it.
- Use `test.afterEach()` for per-test cleanup when fixtures don't handle it.
- When **every** test in a file starts logged out, put `test.use({ storageState: { cookies: [], origins: [] } })` at the top of the file. When only some tests do, or a test must drop the session part-way, use the `resetStorageState` fixture:

```typescript
test.beforeEach(async ({ resetStorageState, pageManager }) => {
    await resetStorageState();
    await pageManager.loginPage.openLoginPage();
});
```

For API-driven setup/teardown reused across many files, see the `api-testing` skill (Phase 8, helper-fixture rule of thumb).

### Phase 7: Handle destructive tests

**`@destructive` is reserved for shared/global state.** A test is destructive only when it mutates state that lives **outside** the test and that other tests, users, or sessions depend on. Concretely:

- changing the **locale** / language / region
- granting or **removing permissions, roles, or guest access**
- toggling **feature flags** or global settings / configuration
- mutating **shared seed data** every test reads (e.g. "delete all users", resetting a global catalog)

**Counter-example — NOT destructive.** A test that creates its **own** record, asserts on it, then deletes **only that record** in cleanup is _isolated_, not destructive. It touches no state another test depends on. Tag it by importance (`@smoke` / `@regression` / `@api` / …) — never `@destructive`. It still needs a cleanup hook (see below), but it runs in the parallel suite.

**Cleanup is required for any state-mutating test.** Both `@destructive` shared-state tests and isolated own-data tests **MUST** revert what they wrote — with `test.afterEach()` / `test.afterAll()`, or by getting their data from a helper fixture whose teardown deletes it (e.g. `createdUser`):

```typescript
test.describe('admin data management', () => {
    test.afterEach(async ({ apiRequest }) => {
        // REQUIRED: Revert state changes made by the test.
        // ApiEndpoints.RESET_DATA is illustrative -- use whatever reset
        // endpoint your app provides, defined in enums/{area}/*.ts.
        await apiRequest({
            method: 'POST',
            url: ApiEndpoints.RESET_DATA,
            baseUrl: process.env.API_URL,
        });
    });

    test(
        'admin deletes all inactive users',
        { tag: '@destructive' },
        async ({ apiRequest }) => {
            // Test that modifies shared state
        }
    );
});
```

**Execution rules:**

- **Excluded from `npm test`** — the base command uses `--grep-invert @destructive` to keep destructive tests out of the parallel suite.
- **Tag-specific commands** (`test:smoke`, `test:regression`, `test:api`, etc.) use `--grep` to match their own tag. Because each test has **exactly one** tag, a `@destructive` test only runs under `npm run test:destructive` — not under `test:smoke`, `test:regression`, etc.
- **Dedicated command** — `npm run test:destructive` runs only destructive tests with `--workers=1` for sequential execution.

### Phase 8: Data-driven tests

Loop **outside** test blocks to generate individual test cases — one per equivalence partition, with the partition named in the title (see "Test Design"). Static data is imported from `.ts` modules via named `as const` exports; each entry is one partition's representative (here `description` names the partition).

```typescript
// Illustrative — create this file with the first negative login spec (data-strategy skill)
import { INVALID_LOGIN_ATTEMPTS } from '../../../test-data/static/{area}/invalidCredentials';

for (const { description, email, password } of INVALID_LOGIN_ATTEMPTS) {
    test(
        `login with ${description} shows an error message`,
        { tag: '@regression' },
        async ({ pageManager }) => {
            await test.step(`WHEN they log in with ${description}`, async () => {
                await pageManager.loginPage.login(email, password);
            });

            await test.step('THEN the error message is shown', async () => {
                await expect
                    .soft(pageManager.loginPage.loginErrorMessage)
                    .toBeVisible();
            });
        }
    );
}
```

**A smoke test from a data-driven scenario.** Tags must be literals (`playwright/valid-test-tags`), so a loop cannot give one partition `@smoke` and the rest `@regression`. Put the scenario's steps and checks in a function named `verify…` and call it from a separate `@smoke` test for the main-path partition and from the `@regression` loop over the other partitions — the steps stay in one place, and `verify…` functions count as assertions for `playwright/expect-expect` (`assertFunctionPatterns: ['^verify']` in `eslint.config.mts`). Example Shop: a `verifySearchShowsMatches(page, pageManager, term)` function shared by the smoke test and the loop.

For **universal** invalid-value loops (wrong type for any `string`/`number`/etc. field) import from `test-data/static/util/invalid-values.ts` (`INVALID_STRING_VALUES`, `INVALID_NUMBER_VALUES`, etc.). Full three-tier rule in the `data-strategy` skill.

### Phase 9: Verify test independence and run

Tests must be **independent** — no test may depend on the outcome or side-effects of another test. Use fixtures and `beforeEach` for shared setup.

After adding or modifying a test file:

```bash
# Run the specific spec file
npx playwright test tests/{area}/functional/login.spec.ts

# Run by tag (exactly one tag match since tags never combine)
npx playwright test --grep @smoke

# Run the destructive suite
npm run test:destructive
```

Do not finish until every failure is explained: a known product defect listed in the test plan, or a newly found product or environment failure reported to the user with its evidence (it joins the plan only after the user confirms it). Anything else (a flaky step, a wrong selector, a broken setup) is fixed first. Do not suppress failures.

## See Also

- **`api-testing`** skill — full API test coverage matrix, `test.step` requirements for multi-call tests, per-field negative-testing patterns, helper-fixture promotion rule (Phase 8).
- **`data-strategy`** skill — Faker + Zod factories, three-tier static data rule, universal invalid-value arrays, TS-only policy.
- **`fixtures`** skill — DI pattern, `fixtures.ts` merge layer, page-object fixture registration.
- **`page-objects`** skill — POM class structure, action methods, component composition, fixture registration.
- **`selectors`** skill — exploration-first workflow, locator priority, feedback / validation message selectors.
- **`common-tasks`** skill — copy-paste prompt templates for creating spec files of each type.
- **`refactor-values`** skill — safe workflow for changing enum values or static data used in assertions.
- **`debugging`** skill — failure-mode taxonomy and the right Playwright tool (UI Mode, Trace Viewer, Inspector) when a test fails or behaves unexpectedly during Phase 9 verification.
- **`references/examples.md`** — four worked spec patterns (functional smoke, data-driven regression, destructive with cleanup, E2E multi-feature journey).
- **`references/troubleshooting.md`** — common test-standards pitfalls (`@functional`, tag arrays, wrong imports, hard waits, JSON data, manual instantiation, parallel collisions, destructive leaks, committed explore files).
