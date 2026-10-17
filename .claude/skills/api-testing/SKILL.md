---
name: api-testing
description: API testing patterns for Playwright -- apiRequest fixture usage, Zod response schema creation and validation, test.step wrapping for multi-call tests, per-field negative/validation testing, path parameter fuzzing, and helper fixtures for shared setup/teardown. Use when writing or updating API test specs, adding tests for a new endpoint, creating Zod schemas for responses, wiring apiRequest or helper fixtures, or investigating API behavior mismatches vs the OpenAPI spec. Do NOT use for UI selectors (use the page-objects or selectors skill) or for generic Playwright fixture authoring unrelated to API setup/teardown (use the fixtures skill).
author: Ivan Davidov
---

# API Testing

## Critical

Untagged rules are non-negotiable; tagged rules are preset defaults that the profile may override with a recorded reason.

_Bullets tagged (DEF-…) are defaults of the `playwright-house-preset`: where `PROJECT-PROFILE.md` records a different choice, follow the profile (see the `project-profile` skill). Untagged bullets always apply._

- **NEVER** hardcode API URLs, access tokens, emails, passwords, or endpoint paths. The only allowed sources of truth are `process.env.*` (for URLs and credentials) and the `enums/{area}/*` enums (for endpoint paths, e.g. `ApiEndpoints.LOGIN`).
- **ALWAYS** validate API response bodies in API specs against the documented contract, as the last step for that response — with the preset (`playwright-house-preset`): Zod and the exact assertion pattern `expect(SchemaName.parse(body)).toBeTruthy();` (a project's choice is in `PROJECT-PROFILE.md` → `validation`). Type generics alone are not enough, and `schema.parse(body)` without the `expect(...).toBeTruthy()` wrapper is not enough. A UI test that reads back through the API only to confirm its UI action checks the message or the stored data, with no schema step. Prerequisite and cleanup calls (`beforeEach`, helper fixtures, helpers, GIVEN steps) check only the HTTP status and the outcome they rely on (including the API's outcome field, when the profile names one) — never the schema, so a schema defect fails the API spec that covers it instead of blocking every test that uses the data. A field the setup needs — an id, a token — is read alone with a runtime check, never through an `as` cast: with the preset, `const { token } = z.looseObject({ token: z.string() }).parse(body);` (see the `type-safety` skill).
- **ALWAYS** wrap each API call in its own `test.step()` (a WHEN line) and each check in its own THEN / AND step holding one soft check with no message — see Phase 4 and the `test-standards` skill (Phase 4). _(DEF-05)_
- **NEVER** silently drop a test because the API misbehaves. Write the test as the spec says and let it fail until the API is fixed — see Phase 7. **NEVER** wrap (`test.fail`, `try/catch`) or loosen a check to hide a known defect; skip it only in the quarantine form, and only when the profile chooses `plans.knownDefects: quarantine` (DEF-20).
- **NEVER** stop at `{}` empty-body validation. Every request-body endpoint requires per-field omission and per-field invalid-type tests. _(DEF-18)_
- **ALWAYS** fuzz path parameters with the invalid-format data-driven loop — regardless of whether OpenAPI mentions it. _(DEF-18)_
- **ALWAYS** use the `apiRequest` fixture directly in tests. Only promote to a helper fixture when the same setup/teardown is reused across 3+ test files. _(DEF-15)_

## Project Specifics

Examples in this skill and its `references/` use the fictional **Example Shop** — a JSON API with meaningful HTTP status codes (`200`, `201`, `400`, `401`, `404`), bearer tokens and JSON request bodies. They are illustrative: real endpoints, schemas and fixtures come from the repository, and the API's conventions come from `PROJECT-PROFILE.md` (**API conventions** section — see the `project-profile` skill). The profile overrides the examples wherever they differ, for instance:

- **Where the outcome lives.** Some APIs answer HTTP 200 for every outcome they handle and report the real one in a body field the profile names. Then check the HTTP status and that outcome field as separate steps, and apply the Phase 5 status-code matrix to the outcome field.
- **Request encoding** (`body:` for JSON, `form:` for form-encoded), **authentication** (token, cookie, none), and how the base URL and endpoint paths combine.
- **Content-type quirks** — `apiRequest` parses any valid JSON body whatever its `Content-Type`.

When the profile says nothing about a convention a test depends on, ask — never infer a convention from a single response. Worked examples from the project are listed in the profile.

Example Shop — an API spec with the step layout of Phase 4:

```typescript
// plan: test-plans/{area}/login.md
import { expect, test } from '../../../fixtures/fixtures';
import { ApiEndpoints } from '../../../enums/{area}/{area}';
import { HttpStatusCodes } from '../../../enums/util/http-status-codes';
import {
    LoginResponse,
    LoginResponseSchema,
} from '../../../fixtures/api/schemas/{area}/loginSchema';

test(
    'POST /api/users/login with a registered email and password returns 200 and a token',
    { tag: '@api' },
    async ({ apiRequest, createdUser }) => {
        const { status, body } =
            await test.step(`WHEN POST ${ApiEndpoints.LOGIN} is sent with the email and password`, () =>
                apiRequest<LoginResponse>({
                    method: 'POST',
                    url: ApiEndpoints.LOGIN,
                    baseUrl: process.env.API_URL,
                    body: {
                        email: createdUser.email,
                        password: createdUser.password,
                    },
                }));

        await test.step('THEN HTTP status is 200', () => {
            expect.soft(status).toBe(HttpStatusCodes.OK);
        });

        await test.step('AND a token is returned', () => {
            expect.soft(body.token).toBeTruthy();
        });

        await test.step('AND the response body has the expected schema', () => {
            expect(LoginResponseSchema.parse(body)).toBeTruthy();
        });
    }
);
```

## Instructions

### Phase 1: Source the contract (documentation first, exploration only as fallback)

The API contract — not observed behavior — is the source of truth for schemas and tests.

1. **If OpenAPI / Swagger / equivalent documentation exists (the normal case):**
    - Build schemas and tests **strictly from the documented contract**: field names, types, required vs optional, nullability, status codes, error shapes.
    - **Do NOT** curl the endpoint first to "see what it returns" and then write schemas that match reality.
    - If, during test execution, the actual response disagrees with the documentation (missing field, wrong type, wrong status code, extra field), that is a **bug to report**, not a reason to loosen the schema. Handle it via Phase 7 (the test stays as the spec says and fails).

2. **Only if no documentation is provided** (legacy endpoint, undocumented service, etc.):
    - Make a real request to discover actual response structure, field names, data types, optional vs required fields, nested objects/arrays, and error response formats.
    - Capture the findings and treat them as the working contract for this skill's remaining phases.
    - Flag the missing documentation back to the team — running tests against "whatever the API currently does" is a stopgap, not a target state.

### Phase 2: Define the Zod schema and TypeScript type

Schemas live under `fixtures/api/schemas/`.

> **`{area}` is a placeholder.** Run `ls fixtures/api/schemas/` to discover the real subdirectory names in this repo (e.g., `front-office`, `back-office`) and use those instead.

```
fixtures/api/schemas/
├── {area}/         ← App-specific response/request schemas
│   ├── userSchema.ts
│   └── loginSchema.ts
└── util/           ← Shared schemas — only once a shape is genuinely shared across areas
```

Build the schema directly from the OpenAPI / Swagger contract — including the response envelope (`success / message / data / errors` or whatever the spec describes). Spell every field out per endpoint; do not invent a factory helper. If the same envelope repeats across many endpoints in one domain, extract a per-domain `_envelope.ts` (`z.strictObject`) and compose via `.extend(...)` — only after the repetition is real:

```typescript
// fixtures/api/schemas/{area}/productSchema.ts
import { z } from 'zod/v4';
import type { output as zOutput } from 'zod/v4';

export const ProductSchema = z.strictObject({
    id: z.uuid(),
    name: z.string().min(1),
    price: z.number().positive(),
    category: z.enum(['electronics', 'clothing', 'food']),
    inStock: z.boolean(),
});

// Response envelope is spelled out per the OpenAPI contract -- 1:1 mirror.
export const CreateProductResponseSchema = z.strictObject({
    success: z.boolean(),
    message: z.string(),
    data: ProductSchema,
    errors: z.unknown().nullable(),
});

export type Product = zOutput<typeof ProductSchema>;
export type CreateProductResponse = zOutput<typeof CreateProductResponseSchema>;
```

**Error responses.** Model every documented error shape as a strict schema, pinning fixed values with `z.literal(...)`. An error shape shared by several endpoints goes in `fixtures/api/schemas/util/`; one used by a single endpoint sits next to that endpoint's schemas. How errors are reported (HTTP status, an outcome field, a message) is part of the profile's API conventions. Example Shop:

```typescript
import { ApiEndpoints } from '../../../enums/{area}/{area}';
import { HttpStatusCodes } from '../../../enums/util/http-status-codes';
import { NotFoundResponseSchema } from '../../../fixtures/api/schemas/util/errorSchema';

const { status, body } = await apiRequest({
    method: 'GET',
    url: `${ApiEndpoints.USERS}/${unknownId}`,
    baseUrl: process.env.API_URL,
    headers: process.env.ACCESS_TOKEN,
});

// THEN HTTP status is 404 / AND the message is … — one soft check per step
// (Phase 4) — then the schema step last:
await test.step('AND the response body has the expected schema', () => {
    expect(NotFoundResponseSchema.parse(body)).toBeTruthy();
});
```

For **401** and **403** responses that return a null body, assert `expect(body).toBeNull()` directly — no schema needed.

### Phase 3: Write the test using the `apiRequest` fixture

Use the `apiRequest` fixture for all API calls in tests. It provides type-safe requests with automatic response parsing via Playwright's dependency injection:

```typescript
import { expect, test } from '../../../fixtures/fixtures';
import {
    UserResponse,
    UserResponseSchema,
} from '../../../fixtures/api/schemas/{area}/userSchema';

test(
    'GET /api/users/me returns the logged-in user',
    { tag: '@api' },
    async ({ apiRequest }) => {
        const { status, body } =
            await test.step('WHEN GET /api/users/me is sent', () =>
                apiRequest<UserResponse>({
                    method: 'GET',
                    url: '/api/users/me',
                    baseUrl: process.env.API_URL,
                    headers: process.env.ACCESS_TOKEN,
                }));

        await test.step('THEN HTTP status is 200', () => {
            expect.soft(status).toBe(HttpStatusCodes.OK);
        });

        await test.step('AND the response body has the expected schema', () => {
            expect(UserResponseSchema.parse(body)).toBeTruthy();
        });
    }
);
```

Use the `apiRequest` fixture **directly** for all API work in tests — assertions, setup calls in `beforeEach`, teardown calls in `afterEach`, and one-off requests. Do **not** create a separate helper fixture for every endpoint.

**Request parameters:**

| Option     | Type                                              | Required | Description                                           |
| ---------- | ------------------------------------------------- | -------- | ----------------------------------------------------- |
| `method`   | `'GET' \| 'POST' \| 'PUT' \| 'DELETE' \| 'PATCH'` | Yes      | HTTP method                                           |
| `url`      | `string`                                          | Yes      | Endpoint path                                         |
| `baseUrl`  | `string`                                          | No       | Base URL to prepend                                   |
| `body`     | `Record<string, unknown>`                         | No       | JSON payload — not accepted by this app, use `form`   |
| `form`     | `Record<string, string \| number \| boolean>`     | No       | Form-encoded payload (mutually exclusive with `body`) |
| `params`   | `Record<string, string \| number \| boolean>`     | No       | Query string parameters                               |
| `headers`  | `string`                                          | No       | Auth token for Authorization header                   |
| `authType` | `'Bearer' \| 'Token' \| 'Basic'`                  | No       | Auth scheme (default: `'Bearer'`)                     |

**Response validation** — combine compile-time and runtime safety:

```typescript
const { status, body } = await apiRequest<UserResponse>({ ... });

expect(UserResponseSchema.parse(body)).toBeTruthy();
```

The generic `<UserResponse>` gives you compile-time type safety on `body`, while `UserResponseSchema.parse()` gives you runtime validation. Always use both.

**Credentials and URLs** — pull from env, never inline:

```typescript
// CORRECT
baseUrl: process.env.API_URL,
body: { email: process.env.APP_EMAIL!, password: process.env.APP_PASSWORD! },

// FORBIDDEN
baseUrl: 'https://shop.example.test/api',
body: { email: 'someone@example.com', password: 'secret' },
```

Use enums for endpoint paths:

```typescript
import { ApiEndpoints } from '../../../enums/{area}/{area}';

url: ApiEndpoints.LOGIN,
```

### Phase 4: Write every call and every check as its own `test.step`

The layout rules live in the `test-standards` skill (Phase 4): plain-sentence titles, one `test.step()` per GIVEN / WHEN / THEN / AND line, one soft check per THEN / AND step with no message, later parts skipped after a failed check. For API specs this means:

- each API call is a **WHEN** step that returns the response;
- each response is checked in this order, one step per check: `THEN HTTP status is …`, the API's outcome field when the profile names one (`AND the <outcome field> is …`), `AND the message is …`, any field checks, and last `AND the response body has the expected schema` — the only hard check, last because a failed parse stops the test;
- a second call (a read-back, a follow-up) starts a new part: with the preset it calls `skipIfChecksFailed(step)` and its checks call `skipIfEarlierStepSkipped(step)` (`helpers/util/softChecks.ts`), so it is shown as "Not run" when a check before it failed. Without the preset helper, use the equivalent the profile names (`reporting.helper`) or report the gap — never import a helper that is not there.

**MANDATORY:** when a test contains more than one API call, each call **MUST** be its own step, followed by its checks. A test with one call uses the same layout.

**Correct pattern** (Example Shop, shortened):

```typescript
test(
    'POST /api/users with all fields returns 201 and stores every field',
    { tag: '@api' },
    async ({ apiRequest }) => {
        const created =
            await test.step(`WHEN POST ${ApiEndpoints.USERS} is sent with every field`, () =>
                apiRequest<UserResponse>({
                    method: 'POST',
                    url: ApiEndpoints.USERS,
                    baseUrl: process.env.API_URL,
                    body: user,
                }));

        await test.step('THEN HTTP status is 201', () => {
            expect.soft(created.status).toBe(HttpStatusCodes.CREATED);
        });

        await test.step(`AND the message is "${ApiMessages.USER_CREATED}"`, () => {
            expect.soft(created.body.message).toBe(ApiMessages.USER_CREATED);
        });

        await test.step('AND the response body has the expected schema', () => {
            expect(UserResponseSchema.parse(created.body)).toBeTruthy();
        });

        // Next part — shown as "Not run" when a check above failed
        const stored =
            await test.step(`WHEN the user is requested through GET ${ApiEndpoints.USERS}/<id>`, async (step) => {
                skipIfChecksFailed(step);
                return apiRequest<UserResponse>({
                    method: 'GET',
                    url: `${ApiEndpoints.USERS}/${created.body.data.id}`,
                    baseUrl: process.env.API_URL,
                    headers: process.env.ACCESS_TOKEN,
                });
            });

        await test.step('THEN HTTP status is 200', (step) => {
            skipIfEarlierStepSkipped(step);
            expect.soft(stored.status).toBe(HttpStatusCodes.OK);
        });

        await test.step('AND every field is returned as sent', (step) => {
            skipIfEarlierStepSkipped(step);
            // every field that was sent — two shown here
            expect.soft(stored.body.data).toMatchObject({
                name: user.name,
                email: user.email,
            });
        });

        await test.step('AND the response body has the expected schema', (step) => {
            skipIfEarlierStepSkipped(step);
            expect(UserResponseSchema.parse(stored.body)).toBeTruthy();
        });
    }
);
```

**Forbidden patterns:**

- several API calls in one `test` body without steps — the report shows one block, and you have to read the assertions to find which call failed (full code in `references/test-step-patterns.md`);
- one step per call with every check inside it (`'Create user via POST /api/users'` holding status, schema and field checks) — the first failed check hides the others, and the report does not say what was checked;
- an `expect` message as the report line (`expect.soft(status, 'THEN HTTP status is 400')`) — put the check in its own step instead.

### Phase 5: Cover the full status-code matrix

The values come from the plan's design (the `test-design` skill): domain testing for documented constraints, combinatorial testing for multi-parameter queries, CRUD testing for resource lifecycles. This phase adds what every API suite needs regardless of design.

For every endpoint × HTTP method combination, tests **MUST** cover **every status code listed in the OpenAPI spec** plus the baseline scenarios below. If the OpenAPI spec lists a status code not in this table, it still requires a test.

| Scenario                                    | Status  | What to assert                                                                    |
| ------------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| Happy path (valid auth + valid body)        | 200/201 | Schema parse passes + key fields match sent data                                  |
| Missing Authorization header                | 401     | `status === 401`, validate body with schema or `expect(body).toBeNull()`          |
| Insufficient permissions (wrong-role token) | 403     | `status === 403`, validate body with schema or `expect(body).toBeNull()`          |
| Empty body (for POST/PUT/PATCH)             | 400/422 | Error schema parse passes — single test with `{}` body                            |
| Each required field omitted individually    | 400/422 | One test per field via destructure + rest — see Phase 6                           |
| Each field with type-inappropriate values   | 400/422 | `for...of` loop per field — see Phase 6                                           |
| Non-existent resource ID                    | 404     | `status === 404` (a backend bug makes it fail — Phase 7)                          |
| Invalid path parameter formats              | 404     | Data-driven loop: numeric string, boolean-like, special chars, injection attempts |
| Unsupported HTTP method                     | 405     | At least one test with a method the endpoint does not support                     |
| Conflict (if listed in OpenAPI)             | 409     | Test the conflicting condition; a backend bug → failing test (Phase 7)            |
| Validation errors (if listed in OpenAPI)    | 422     | Covered by per-field validation tests above                                       |
| No content (for DELETE)                     | 204     | `status === 204`, `expect(body).toBeNull()`                                       |

**Structure:** One `test.describe` per HTTP method + path. Use `beforeAll`/`afterAll` (not `beforeEach`/`afterEach`) to create/delete shared resources needed by multiple tests in the same describe block.

**Key conventions from real tests:**

- Auth: none — this API takes no tokens; account endpoints take `email` / `password` as form fields (see App Specifics)
- Config: `process.env.API_URL` + an `ApiEndpoints.*` path (`API_URL` already ends in `/api`) — never bare `process.env.API_URL`
- Cleanup: `afterAll` in POST describes (holds `resourceId` from the happy-path test); `afterAll` in GET/PUT/DELETE describes (resource created in `beforeAll`)
- When a backend bug breaks an assertion: the test fails — no wrapper, no loosened check; list it in the feature's test plan ("Why tests currently fail"). With `plans.knownDefects: quarantine` it is skipped in the quarantine form instead (Phase 7)
- Tag: `@api` for API tests (check real tag in existing spec files for other areas)

### Phase 6: Add per-field negative / validation coverage

Testing only with an empty body (`{}`) is never sufficient. Every endpoint that accepts a request body (POST, PUT, PATCH) requires systematic per-field validation testing.

**Coverage checklist for endpoints with a body:**

1. **Empty body** — single test sending `{}`
2. **Each required field omitted** — one test per field, omitting only that field while keeping all others valid
3. **Each field with type-inappropriate values** — `for...of` loop per field using contextually appropriate invalid values
4. **Boundary values** where applicable (empty string for min-length, negative for positive-only numbers, past dates for future-only, etc.)

**Universal invalid arrays** live as `as const` exports in `test-data/static/util/invalid-values.ts` — `INVALID_STRING_VALUES`, `INVALID_UUID_VALUES`, `INVALID_NUMBER_VALUES`, `INVALID_BOOLEAN_VALUES`, `INVALID_ENUM_VALUES`, `INVALID_ARRAY_VALUES`, `INVALID_OBJECT_VALUES`. **Always import**; never redefine inline.

**Patterns to use** (full code in `references/negative-testing.md`):

- **`for...of` spread-and-override** — base valid payload, override one field at a time with `INVALID_*` values, assert `400` + `BadRequestResponseSchema.parse(body)`.
- **Omitting required fields** — destructure + rest (`const { [field]: _, ...rest } = validPayload`) per required field.
- **Path-parameter validation** — data-driven loop over `[{ description, value }]` with numeric strings, boolean-likes, special chars, injection attempts. **Mandatory regardless of OpenAPI mention.**

**One value per partition.** Each value in a `for...of` loop must stand for its own equivalence partition — the universal `INVALID_*` arrays already do (number, boolean, null, undefined are different type partitions); a domain set such as invalid emails lists one value per rule it breaks. Ranges and lengths get boundary values on both sides (e.g. `birth_month` 0 / 1 and 12 / 13). See the `test-design` skill.

**Three-tier rule for _where_ invalid-value arrays live:**

1. **Universal type-mismatch arrays** → `test-data/static/util/invalid-values.ts` (`INVALID_*` `as const` tuples). Import; never redefine.
2. **Domain-specific curated invalid sets** (invalid emails, weak passwords, forbidden categories) → `test-data/static/{area}/*.ts` (`as const`). Import; never inline. Never `.json`.
3. **Field-specific boundary / range values** used in exactly one field → **inline** in the spec. Promote to static data only when reused across 2+ fields or spec files.

A typical validation describe combines tier 1 and tier 3 in separate `for...of` loops. For full code blocks, the `INVALID_*` constants table, and the email-field type-vs-format combination rule, see `references/negative-testing.md`.

**Forbidden: empty-body-only validation.** A single `body: {}` test asserting `400` is **not** sufficient. Per-field omission and per-field invalid-type loops are mandatory. Full anti-pattern in `references/test-step-patterns.md`.

### Phase 7: Handle behavior mismatches

When the API's actual behavior differs from the OpenAPI spec or from the expected status code in the Phase 5 coverage matrix:

1. **NEVER silently drop the test.** The test must exist in the file.
2. **Write the test as the spec says it should work** (expected status code and schema).
3. **Let it fail.** Don't wrap it, don't loosen it — a known product defect is a red test until the product is fixed (in a project that quarantines known defects, a skipped test — see below). Each check is its own step (Phase 4), so the failed step's title names what is wrong:

```typescript
test(
    'POST /api/users with an empty "name" returns 400 and an error message naming the field',
    { tag: '@api' },
    async ({ apiRequest }) => {
        const { status, body } = await test.step(
            `WHEN POST ${ApiEndpoints.USERS} is sent with an empty name`,
            () => apiRequest<BadRequestResponse>({ ... })
        );

        await test.step('THEN HTTP status is 400', () => {
            expect.soft(status).toBe(HttpStatusCodes.BAD_REQUEST);
        });

        await test.step('AND the error message names the "name" field', () => {
            expect.soft(body.message).toContain('name');
        });

        await test.step('AND the response body has the expected schema', () => {
            expect(BadRequestResponseSchema.parse(body)).toBeTruthy();
        });
    }
);
```

While the API accepts the empty name, the report reads:

```
POST /api/users with an empty "name" returns 400 and an error message naming the field
  ✓ WHEN POST /api/users is sent with an empty name
  ✗ THEN HTTP status is 400
  ✗ AND the error message names the "name" field
  ✗ AND the response body has the expected schema
```

List the failing scenarios and the live behaviour that breaks them in the feature's test plan (`test-plans/{area}/*.md`, "Why tests currently fail"). When the product is fixed, the test turns green on its own — nothing to remove.

**Projects that quarantine known defects.** With `plans.knownDefects: quarantine` in the profile (a DEF-20 override with its reason — e.g. CI must stay green while a minor defect waits for its fix), the test is still written as the spec says, then skipped in the quarantine form so its reason shows in the code, in the report and in the plan:

```typescript
// FIXME: BUG-123 — POST /api/users accepts an empty name with 201
// eslint-disable-next-line playwright/no-skipped-test
test.skip(
    'POST /api/users with an empty "name" returns 400 and an error message naming the field',
    {
        tag: '@api',
        annotation: {
            type: 'defect',
            description:
                'BUG-123 — POST /api/users accepts an empty name with 201',
        },
    },
    async ({ apiRequest }) => {
        // … the same steps and checks as above …
    }
);
```

List the defect ID in the plan's "Skipped tests" section. `npm run rules:check` (`skip-reason`) refuses a quarantined test without the comment, the annotation or the plan entry, and refuses the form while the profile says `fail`. Report quarantined tests as skipped, with their defect IDs. When the defect is fixed, remove the skip, the comment and the annotation, and the plan row.

4. **Never adjust the expected status code to match buggy behavior.** The test documents the contract, not the current bug.
5. **If the API returns a different valid status code than the spec** (e.g., 422 instead of 400), use the actual status code and add a comment noting the spec discrepancy.

### Phase 8: (When needed) Promote to a helper fixture

For **critical, recurring setup/teardown operations** that multiple tests depend on (e.g., creating a user account that several test files need as a precondition, or seeding complex data that must be cleaned up), use helper fixtures in `fixtures/helper/helper-fixture.ts`.

Helper fixtures wrap the `apiRequest` plain function with Playwright's fixture lifecycle: setup before `await use(...)`, yield via `use(data)`, teardown after — runs even if the test fails. For the full code pattern see `references/helper-fixture-example.md`.

**When to use `apiRequest` fixture vs. helper fixture:**

| Approach                                | Use Case                                                                        | Example                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **`apiRequest` fixture** (primary)      | All API calls in tests — assertions, `beforeEach`/`afterEach`, one-off calls    | Validate status codes, response schemas, teardown in hooks |
| **Helper fixture** (important ops only) | Critical setup/teardown reused across many test files with guaranteed lifecycle | Seed a user account that 10+ test files depend on          |
| **Factory function**                    | Generate dynamic test data (no API call)                                        | `generateUser()` from `test-data/factories/`               |

**Rule of thumb:** Use `apiRequest` directly unless you find yourself copy-pasting the same multi-step setup/teardown into 3+ test files.

## API Architecture

```
fixtures/
├── api/
│   ├── api-request-fixture.ts    ← Playwright fixture providing apiRequest (used in tests via DI)
│   ├── plain-function.ts         ← Core HTTP function (internal implementation, used by fixture and helpers)
│   ├── api-types.ts              ← TypeScript types (ApiRequestParams, ApiRequestResponse, etc.)
│   └── schemas/                  ← Zod schemas for validation
│       ├── app/                  ← App-specific schemas
│       └── util/                 ← Shared error response schemas
└── helper/
    └── helper-fixture.ts         ← Setup/teardown fixtures for important recurring operations
```

- `api-request-fixture.ts` — Playwright fixture wrapping the plain function. Provides `apiRequest` via DI with generics for type-safe responses. **Primary tool for API calls in tests.**
- `plain-function.ts` — Core HTTP function. Handles method routing, auth headers, response parsing. Used internally by the fixture and by helper fixtures.
- `api-types.ts` — Shared types: `ApiRequestParams`, `ApiRequestResponse<T>`, `ApiRequestFn`.
- `helper-fixture.ts` — Setup/teardown fixtures for important, recurring preconditions. Uses `plain-function.ts` internally.

## See Also

- **`type-safety`** skill — Zod 4 schemas, `z.strictObject()`, the mandatory `expect(SchemaName.parse(body)).toBeTruthy();` pattern, `zOutput` / `zInput` inference.
- **`data-strategy`** skill — Faker + Zod factories for happy-path payloads, the three-tier rule for negative testing (universal `INVALID_*` arrays + domain-specific sets + inline boundary values).
- **`enums`** skill — `ApiEndpoints.*` for endpoint paths and error message constants used in assertions.
- **`fixtures`** skill — the `apiRequest` fixture itself, helper fixtures for setup/teardown, and the 3+ files rule of thumb for promotion (Phase 8).
- **`helpers`** skill — auth bootstrap (`createAppStorageState` and its credential check) that logs in over HTTP and saves the storage state for UI tests.
- **`test-standards`** skill — `@api` tag, `test.step` requirements for multi-call tests, single-tag rule.
- **`refactor-values`** skill — when an endpoint enum value or a Zod literal needs to change, the impact-analysis workflow.
- **`references/examples.md`** — three end-to-end walkthroughs (new endpoint, multi-step workflow, validation lockdown).
- **`references/troubleshooting.md`** — common API-testing pitfalls (ZodError, 401/null body, status-code drift, empty-body-only coverage, hardcoded URLs/tokens).
- **`references/negative-testing.md`** — full Phase 6 code blocks (per-field invalid-type, omitting required fields, path-parameter validation), the `INVALID_*` constants table, and the three-tier rule.
- **`references/test-step-patterns.md`** — full anti-pattern code blocks for Phase 4 (multi-call without `test.step`) and Phase 6 (empty-body-only validation).
- **`references/helper-fixture-example.md`** — full lifecycle-wired helper-fixture code pattern from Phase 8.
