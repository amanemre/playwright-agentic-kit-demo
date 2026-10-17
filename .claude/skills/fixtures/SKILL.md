---
name: fixtures
description: Playwright fixture conventions for the Playwright scaffold — dependency-injection pattern, the single import point from fixtures/fixtures.ts (merged via mergeTests), the three fixture categories (page objects in fixtures/pom/, API request in fixtures/api/, lifecycle setup/teardown in fixtures/helper/), and the workflow for adding a new fixture. Use when adding a new page object to the page manager, registering a new fixture category, extending FrameworkFixtures or HelperFixtures, or deciding whether a reusable piece of code should be a Playwright fixture. For plain (non-fixture) utility functions used from tests or fixtures use the helpers skill; for the deep decision on when to promote API setup into a helper fixture vs calling apiRequest directly see the api-testing skill (Phase 8).
author: Ivan Davidov
---

# Fixtures and Dependency Injection

## Critical

_Bullets tagged (DEF-…) are defaults of the `playwright-house-preset`: where `PROJECT-PROFILE.md` records a different choice, follow the profile (see the `project-profile` skill). Untagged bullets always apply._

- **ALWAYS** use fixtures for dependency injection. **NEVER** instantiate a page object manually in a test file (`new AppPage(page)` is forbidden). _(DEF-01)_
- **ALWAYS** import `test` and `expect` from `fixtures/fixtures.ts`. **NEVER** import them from `@playwright/test` in spec files. _(DEF-02)_
- **Page objects** are reached through one fixture, `pageManager` (`fixtures/pom/page-object-fixture.ts`), which exposes each page object as a getter of `PageManager` (`pages/page-manager.ts`). Add a new page object as a getter there — **never** as a fixture of its own, and never copy it into a local variable in a test. _(DEF-01)_
- **Lifecycle (setup/teardown) fixtures** live in `fixtures/helper/helper-fixture.ts`. They use the Playwright `use()` callback pattern. _(DEF-15)_
- **Plain utility functions** (no fixture lifecycle) live in `helpers/` — not in `fixtures/`. See the `helpers` skill. _(DEF-15)_
- **Every new fixture** must be typed: extend `FrameworkFixtures` (for framework fixtures such as `pageManager`) or `HelperFixtures` (for lifecycle) — do not add untyped fixtures. _(DEF-15)_
- **Teardown uses `use()`.** Setup runs before `use()`, data is yielded via `use(data)`, teardown runs after `use()` — even if the test fails. _(DEF-15)_
- **New fixture categories** (not page objects, not lifecycle helpers) must be declared in their own `fixtures/{category}/{name}-fixture.ts` file and merged into `fixtures.ts` via `mergeTests()`. _(DEF-15)_
- **Do not promote one-off API calls to helper fixtures.** Helper fixtures are reserved for setup/teardown reused across 3+ spec files — see the `api-testing` skill (Phase 8). _(DEF-15)_

## Fixture Architecture

```
fixtures/fixtures.ts                          ← Single import point (merges all fixtures)
    ├── fixtures/network/ad-block-fixture.ts      ← Blocks ad / tracker requests (overrides `context`)
    ├── fixtures/pom/page-object-fixture.ts       ← `pageManager` + `resetStorageState`
    ├── fixtures/api/api-request-fixture.ts       ← API request fixture (apiRequest for tests)
    └── fixtures/helper/helper-fixture.ts         ← Setup/teardown fixtures (important recurring operations)
```

`fixtures.ts` uses `mergeTests()` to combine fixture layers:

```typescript
import { test as base, mergeTests, request } from '@playwright/test';
import { test as pageObjectFixture } from './pom/page-object-fixture';
import { test as apiRequestFixture } from './api/api-request-fixture';
import { test as helperFixture } from './helper/helper-fixture';
import { test as adBlockFixture } from './network/ad-block-fixture';

const test = mergeTests(
    adBlockFixture,
    pageObjectFixture,
    apiRequestFixture,
    helperFixture
);
const expect = base.expect;
export { test, expect, request };
```

## Instructions

### Phase 1: Classify what you're adding

Match the need to the correct home. This table exists to stop fixtures from creeping into places they don't belong.

| Need                                                                                    | Home                                                                                           |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| New page object wired into tests via DI                                                 | Getter in `PageManager` (`pages/page-manager.ts`) — no new fixture                             |
| One-off API call in a single test or describe                                           | **No fixture.** Call `apiRequest` directly (see the `api-testing` skill)                       |
| Multi-step API setup/teardown reused across **3+** spec files with guaranteed lifecycle | Helper fixture in `fixtures/helper/helper-fixture.ts` (see the `api-testing` skill, Phase 8)   |
| Reusable pure function (no fixture lifecycle) called from tests/fixtures                | **Plain function in `helpers/`** — not `fixtures/` (see the `helpers` skill)                   |
| A genuinely new fixture category (not a page object, not API setup)                     | New file `fixtures/{category}/{name}-fixture.ts`, merged into `fixtures.ts` via `mergeTests()` |
| Tweak to global Playwright config (timeouts, workers, retries, projects)                | `playwright.config.ts` — not a fixture (see the `config` skill)                                |

If the need fits none of these rows, stop and ask. Do not invent a new location.

### Phase 2: Prerequisites (only for page objects)

Before adding a page object to the page manager, confirm the page object itself was built correctly:

- The page object was created **after exploring the live application** with `playwright-cli` (see the `selectors` skill → "Exploration-First Workflow").
- The page object includes **feedback/validation message locators** (success, error, field validation) — not just form inputs and buttons (see the `selectors` skill → "Feedback & Validation Message Selectors").

Registering a page object that was generated from guesses rather than observed UI defeats the purpose of the DI pattern. Stop and run the exploration first.

### Phase 3: Create or extend the fixture file

For most additions, you are **extending an existing file** — `pages/page-manager.ts` (page objects) or `helper-fixture.ts` (lifecycle). A brand-new file is only needed when you're introducing a new fixture **category** (Phase 5).

Scaffold of a standalone fixture file (used only for new categories):

```typescript
// fixtures/[category]/[name]-fixture.ts
import { test as base } from '@playwright/test';
import { MyNewPage } from '../../pages/{area}/my-new.page';

export type MyFixtures = {
    myNewPage: MyNewPage;
};

export const test = base.extend<MyFixtures>({
    myNewPage: async ({ page }, use) => {
        await use(new MyNewPage(page));
    },
});
```

### Phase 4: Register the fixture type and implementation

A page object is **not** a fixture of its own. Add it as a getter to `PageManager` in `pages/page-manager.ts` — the `pageManager` fixture already exposes it to every test:

```typescript
// pages/page-manager.ts
export class PageManager {
    private loginPageInstance?: LoginPage;
    private myNewPageInstance?: MyNewPage; // Add the cache field

    constructor(private readonly page: Page) {}

    /** /login — "Login to your account" and signup step 1 */
    get loginPage(): LoginPage {
        return (this.loginPageInstance ??= new LoginPage(this.page));
    }

    /** /my-new — what the page is for */
    get myNewPage(): MyNewPage {
        return (this.myNewPageInstance ??= new MyNewPage(this.page)); // Add the getter
    }
}
```

Tests then use `pageManager.myNewPage` on every line — never copy it into a local variable (`const myNewPage = pageManager.myNewPage`), so each line names the page it acts on.

Any other framework fixture extends `FrameworkFixtures` in `fixtures/pom/page-object-fixture.ts` (today: `pageManager` and `resetStorageState`). For a lifecycle fixture, extend `HelperFixtures` in `fixtures/helper/helper-fixture.ts` following the same shape. Helper fixtures use `plain-function.ts` internally (not the `apiRequest` fixture) because fixture-level code needs the raw `request` context — this is already wired in the scaffold.

### Phase 5: (Only for new categories) Merge into `fixtures.ts`

If you added a completely new fixture category (not a page object, not a lifecycle helper), merge it so consumers pick it up automatically:

```typescript
// fixtures/fixtures.ts
const test = mergeTests(
    pageObjectFixture,
    apiRequestFixture,
    helperFixture,
    newCategoryFixture // ← add here
);
```

Page objects added in Phase 4 need no `mergeTests()` change — `pageObjectFixture` is already merged.

### Phase 6: Handle teardown via the `use()` callback

Any fixture that needs cleanup uses the Playwright lifecycle:

```typescript
myFixture: async ({ page }, use) => {
    // Setup -- runs BEFORE the test
    const resource = await createResource();

    // Yield -- passes data into the test
    await use(resource);

    // Teardown -- runs AFTER the test (even on failure)
    await resource.cleanup();
},
```

Order matters: code after `await use(...)` is the teardown. Do not teardown before `use()` — it won't run at all.

## Built-in Fixtures

| Fixture              | Source                        | Purpose                                                                                                                                                                               |
| -------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pageManager`        | `page-object-fixture.ts`      | Every page object as a getter, created on first access: `pageManager.loginPage` (with the header `nav` component), `pageManager.productsPage`, `pageManager.cartPage`                 |
| `resetStorageState`  | `page-object-fixture.ts`      | Clears cookies and permissions (for login tests)                                                                                                                                      |
| `apiRequest`         | `api-request-fixture.ts`      | Type-safe API request function (primary tool for API calls in tests)                                                                                                                  |
| `createdUser`        | `helper-fixture.ts`           | Example Shop: throwaway user created via API before the test and deleted after it (for per-user state such as the cart) — the project's own helper fixtures are listed in its profile |
| `context` (override) | `network/ad-block-fixture.ts` | Aborts ad / consent requests (hosts in `enums/util/ad-hosts.ts`) in every browser context                                                                                             |

### `apiRequest` fixture vs. helper fixtures

Use `apiRequest` directly for all API calls in tests. Create helper fixtures only for critical, recurring setup/teardown reused across many test files. See the `api-testing` skill (Phase 8) for the full decision guide, lifecycle pattern, and rule of thumb.

## See Also

- **`api-testing`** skill — Phase 8 owns the deep decision for helper fixtures (3+ files rule of thumb, lifecycle, apiRequest-vs-helper table).
- **`helpers`** skill — plain utility functions that are **not** Playwright fixtures (no `use()` lifecycle).
- **`page-objects`** skill — what a page object must look like before it's wrapped in a fixture.
- **`selectors`** skill — exploration-first workflow and feedback-locator requirements for page objects.
- **`playwright-cli`** skill — how to run the live-app exploration before building the page object.
- **`common-tasks`** skill — prompt templates for "Add a New Page Object Fixture", "Add a Helper Fixture", "Add a New Fixture Category".
- **`debugging`** skill — `pageManager is undefined` / `cannot read property of undefined` / fixture-lifecycle / merge-not-applied failures live here.
- **`references/examples.md`** — three worked walkthroughs (new page object in the page manager, when NOT to create a fixture for a one-off call, brand-new fixture category).
- **`references/troubleshooting.md`** — common fixture pitfalls (wrong `test` import, fixture creep, teardown not running, missing `mergeTests`, helper-vs-fixture decision, manual instantiation temptation).
