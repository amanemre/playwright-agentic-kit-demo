---
applyTo: 'helpers/**/*.ts'
---

# Helpers

## Critical

_Bullets tagged (DEF-…) are defaults of the `playwright-house-preset`: where `PROJECT-PROFILE.md` records a different choice, follow the profile (see the `project-profile` skill). Untagged bullets always apply._

- **Helpers are plain functions.** No Playwright fixture lifecycle — no `use()`, no `base.extend`. If you need setup → `use(data)` → teardown, it's a **fixture**, not a helper (see the `fixtures` skill). _(DEF-15)_
- **App-specific logic** lives in `helpers/{area}/`. **Generic utilities** live in `helpers/util/`. _(DEF-15)_
- **ALWAYS** add JSDoc with `@param` and `@returns` on every exported helper. _(DEF-13)_
- **ALWAYS** specify explicit return types (`Promise<void>`, `string`, etc.). No implicit `any`.
- **NEVER** hardcode URLs, credentials, or tokens. Read env-driven values from `process.env.*` (see the `config` skill). Use `enums/{area}/*` for endpoint paths and storage-state paths.
- **Prerequisite and cleanup API calls inside helpers check only the HTTP status and the outcome they rely on (including the API's outcome field, when the profile names one)** — **never** the full schema: a schema defect must fail the API spec that covers it, not every test that uses the helper. Schema validation (`expect(SchemaName.parse(body)).toBeTruthy();`) belongs in the API specs (`api-testing` skill).
- **Function naming:** camelCase verbs (`createAppStorageState`, `loginViaApi`, `formatDate`, `parseCurrency`). _(DEF-15)_
- **Do not promote a helper to a helper fixture** unless the same setup/teardown is copy-pasted across **3+** spec files and needs guaranteed lifecycle (see the `api-testing` skill, Phase 8 rule of thumb). _(DEF-15)_
- **Mutating `process.env` from a helper is a narrow exception**, not a general pattern. It is acceptable only for auth-bootstrap helpers that publish a token (e.g. writing `process.env.ACCESS_TOKEN` inside a login helper). Do not copy the env-mutation pattern into other helpers — return values through the function signature instead. _(DEF-15)_

## File Locations

> **`{area}` is a placeholder.** Before creating or referencing any path below, run `ls helpers/` to discover the real subdirectory names in this repo (e.g., `front-office`, `back-office`) and use those instead.

| Type            | Directory         | Purpose                                                                | Scaffold example                       |
| --------------- | ----------------- | ---------------------------------------------------------------------- | -------------------------------------- |
| App helpers     | `helpers/{area}/` | App-specific helper functions (auth bootstrap, storage state, seeding) | `helpers/{area}/createStorageState.ts` |
| Utility helpers | `helpers/util/`   | Generic utility functions reusable across apps/projects                | `helpers/util/util.ts`                 |

## Instructions

### Phase 1: Classify what you're adding

Use this table. The correct criterion is **"does this need the Playwright fixture lifecycle?"** — not _"is this used in setup or in tests?"_. A plain utility like `formatDate` is a helper even though it's called from inside tests.

| Symptom                                                                                          | Home                                                                                        |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Pure function — no setup/teardown lifecycle needed                                               | **Helper** in `helpers/{area}/` or `helpers/util/`                                          |
| Needs `page` / `request` context via DI, or owns setup → `use(data)` → teardown around each test | **Fixture** (see the `fixtures` skill; for lifecycle API helpers see `api-testing` Phase 8) |
| Encapsulates locators and user interactions on a specific page                                   | **Page object** (see the `page-objects` skill)                                              |
| One-off API call inside a single test                                                            | Call `apiRequest` **directly** in the test — neither helper nor fixture                     |
| Reusable happy-path data generation                                                              | **Factory** under `test-data/factories/{area}/` (see the `data-strategy` skill)             |

If the need fits none of these rows, stop and ask. Do not invent a new location.

### Phase 2: Pick the home — app-specific or utility

- **`helpers/{area}/`** — logic that only makes sense for the app under test: authentication flows, storage state creation, data seeding, app-specific request composition.
- **`helpers/util/`** — logic that's reusable across apps or projects: date formatting, string manipulation, retry logic, parsing utilities.

Prefer **extending an existing file** (`createStorageState.ts`, `util.ts`) over creating a new one when the function belongs to the same domain. Create a new file only when the domain is genuinely new.

### Phase 3: Define the function signature, types, and JSDoc

Every exported helper must declare:

- An **explicit return type** (`Promise<void>`, `string`, `UserResponse`, etc.). No implicit `any`.
- **Named parameters** with explicit types.
- A **JSDoc** block with a description, `@param` for every argument, `@returns`, and — when useful — an `@example` block.

Pattern:

```typescript
/**
 * Logs in (login form submitted over HTTP) and saves the browser storage state.
 * @param {LoginPage} loginPage - The login page object bound to `context`.
 * @param {BrowserContext} context - The browser context to save the state of.
 * @returns {Promise<void>} Resolves when storage state is saved.
 */
export async function createAppStorageState(
    loginPage: LoginPage,
    context: BrowserContext
): Promise<void> {
    // implementation
}
```

### Phase 4: Read env-driven values from `process.env.*`

Helpers **never** hardcode URLs, credentials, or tokens. Read from `process.env.*` and use enums for endpoint paths / storage-state paths:

```typescript
import { ApiEndpoints, StorageStatePaths } from '../../enums/{area}/{area}';

// CORRECT
baseUrl: process.env.API_URL,
url: ApiEndpoints.LOGIN,
body: { email: process.env.APP_EMAIL!, password: process.env.APP_PASSWORD! },
await context.storageState({ path: StorageStatePaths.APP });

// FORBIDDEN
baseUrl: 'https://shop.example.test/api',
url: '/api/users/login',
```

See the `config` skill for sources of truth and the `enums` skill for paths.

### Phase 5: If the helper makes API calls, check the status and the outcome — not the schema

A helper's API call is a prerequisite or a cleanup: it only has to know that it worked. Check the HTTP status and the outcome the helper relies on — never the full schema, which is the API specs' job (a schema defect there must not block every test that uses the helper):

```typescript
// helpers/{area}/createStorageState.ts — the credential check (Example Shop)
const { status, body } = await apiRequest<LoginResponse>({
    method: 'POST',
    url: ApiEndpoints.LOGIN,
    baseUrl: process.env.API_URL,
    body: {
        email: process.env.APP_EMAIL!,
        password: process.env.APP_PASSWORD!,
    },
});

expect(status).toBe(HttpStatusCodes.OK); // 401 = the credentials are not a registered account
expect(body.token).toBeTruthy(); // the one field the caller uses
```

Rules:

- Type the body with the narrowest type that holds what the helper reads (`ApiOutcome` in `fixtures/api/api-types.ts` covers an outcome-field-only check).
- Check only what the caller relies on: the status, the API's outcome field when the profile names one, and the fields it returns. A cleanup may accept several outcomes (a delete: 200 or 404 — the test may have deleted the record already).
- If the response can legitimately be `null` (e.g., a 204 DELETE), assert `expect(body).toBeNull()` instead.

### Phase 6: Consume the helper

Call the helper from the right context — helpers have no lifecycle of their own, so **where** you call them matters:

- **Auth bootstrap (`tests/{area}/auth.setup.ts`)** — app-login helpers run once before the main test suite to produce storage state and/or tokens. How the project logs in (token, session cookie, form login over HTTP) is in `PROJECT-PROFILE.md` (Authentication). Whatever the mechanism, an auth bootstrap never types the credentials into the UI: Playwright names its "Fill" steps after the typed value, which would put them in the HTML / Allure reports (the setup project also has `trace: 'off'` — a trace would record the login request).
- **Starting state over HTTP (`helpers/{area}/`)** — tests create their GIVEN state with requests, not through the UI. Example Shop: `loginViaApi(context, email, password)` logs a browser context in (e.g. a `createdUser`), `addToCartViaApi(page.request, productId, quantity)` fills the cart with the site's own request; the project's real helpers are listed in its profile. Such helpers use the browser context's request object, which shares its cookies, so the state lands in the test's browser session. Use the UI only where the step is the action under test.
- **Inside a test / `beforeEach` / `afterEach`** — utility helpers freely, API helpers when they do self-contained work.
- **Inside a fixture** — a fixture can call a helper as part of its setup/teardown. The fixture owns the lifecycle; the helper stays stateless.

Auth-bootstrap helpers that publish a token via `process.env.*` are the one place env mutation is acceptable (a project whose auth is a session cookie has none). Every other helper must return its results through the function signature.

## Examples

### Example 1: Add a utility helper

User says: _"Add a helper that parses a currency string like `$1,234.56` into a number so tests can assert on cart totals."_

Actions:

1. **Phase 1** — Pure function, no lifecycle → helper.
2. **Phase 2** — Generic, reusable across apps → `helpers/util/util.ts` (extend the existing file).
3. **Phase 3** — Signature: `export function parseCurrency(value: string): number`, with JSDoc + `@param` + `@returns`.
4. **Phase 6** — Consume inside tests: `expect(parseCurrency(await cart.totalText())).toBe(1234.56);`.

### Example 2: Add an app-specific seeding helper

User says: _"Wrap the factory + API create call so setup scripts can seed a product."_

Actions:

1. **Phase 1** — Plain function (takes `apiRequest` as a parameter; does not own lifecycle) → helper. If it needed guaranteed per-test teardown, it would be a fixture instead.
2. **Phase 2** — App-specific → `helpers/{area}/` (e.g. `helpers/{area}/seedProduct.ts`).
3. **Phase 3** — Signature: `export async function seedProduct(apiRequest: ApiRequestFn, overrides?: Partial<Product>): Promise<Product>`.
4. **Phase 4** — Read base URL / token from `process.env.*`, endpoint from `ApiEndpoints.PRODUCTS`.
5. **Phase 5** — Check the status and the outcome only: `expect(status).toBe(201);` — the product schema is the API spec's job.
6. **Phase 6** — Call from `tests/{area}/auth.setup.ts` or inside a fixture's setup block.

### Example 3: Counterexample — this is a fixture, not a helper

User says: _"I want to write a helper that creates a test user before each test and deletes it after — same API I wrote for `seedProduct`."_

Actions:

1. **Phase 1** — "Creates before, deletes after" = Playwright lifecycle → **fixture**, not a helper.
2. Stop. Route to the `fixtures` skill + the `api-testing` skill (Phase 8) and promote only if the setup/teardown is reused across **3+** spec files.
3. If it's used in only 1–2 files, keep it inline in `beforeEach` / `afterEach` using `apiRequest` directly.

## Troubleshooting

**My helper returns `undefined` for `process.env.*` values.**
Cause: Missing env variable in the active `env/.env.${ENVIRONMENT}` file.
Fix: Confirm the key exists there; update `env/.env.example` if you added a new variable. See the `config` skill.

**I want the helper to set up a resource and tear it down around each test.**
Fix: That's a fixture, not a helper. Route to the `fixtures` skill; if the setup/teardown is API-driven see the `api-testing` skill (Phase 8).

**`tests/{area}/auth.setup.ts` fails when it checks the credentials.**
Cause: `APP_EMAIL` / `APP_PASSWORD` in `env/.env.*` are not a registered account (wrong values, or the account was deleted — common on shared demo sites).
Fix: Correct the values, or register the account again (the profile says how). Re-run with `npx playwright test --project=setup`. Any other unexpected answer means the login contract changed — see the `api-testing` skill (Phase 7).

**My API helper validates the response's full schema.**
Cause: Old pattern — a schema defect then blocks every test that uses the helper.
Fix: Check only the status and the outcome the helper relies on (Phase 5); the API spec for that endpoint owns the schema.

**I want to mutate `process.env` inside a new helper for convenience.**
Fix: Don't. Publishing an auth token from an auth-bootstrap helper is the only sanctioned env mutation (this project has none — its auth is a session cookie). For any other case, pass values through return types or factory overrides — env mutation hides state and breaks parallel isolation.

**I'm about to promote a one-off helper to a helper fixture because "it feels reusable".**
Fix: Promote only when the same setup/teardown is copy-pasted across **3+** spec files with a lifecycle need. Otherwise keep it as a helper or an inline `apiRequest` call (see the `api-testing` skill, Phase 8 rule of thumb).

**TypeScript complains that my helper has an implicit `any` return type.**
Fix: Add an explicit return type (`Promise<void>`, `Promise<UserResponse>`, `string`, etc.) — Critical rule.

## See Also

- **`fixtures`** skill — Playwright fixtures with `use()` lifecycle (setup / yield / teardown); the sibling category to helpers.
- **`api-testing`** skill — mandatory `expect(Schema.parse(body)).toBeTruthy();` pattern and the Phase 8 rule of thumb for promoting to a helper fixture.
- **`config`** skill — env variable conventions (`process.env.*`), where `APP_URL` / `API_URL` / `APP_EMAIL` / `APP_PASSWORD` live.
- **`enums`** skill — `ApiEndpoints.*` for endpoint paths and `StorageStatePaths.*` for storage-state file paths.
- **`data-strategy`** skill — Faker + Zod factories used inside seeding helpers; three-tier rule for static invalid data.
- **`debugging`** skill — auth-bootstrap failures (the credential check and the login in `createAppStorageState`) and other helper-driven test failures.
