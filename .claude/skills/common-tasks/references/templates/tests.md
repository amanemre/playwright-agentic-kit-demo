# Test Templates

Prompt templates for functional, E2E, data-driven, and API tests. The `test-standards`, `data-strategy`, and `api-testing` skills own the deep rules. Resolve `{area}` with `ls tests/` first.

> **Important:** Before generating tests, navigate through the user flow to understand the actual steps and expected outcomes.

## Create a Functional Test

Functional tests verify one feature or behaviour in isolation. Each test covers a single thing.

```
Create a functional test for [FEATURE]:
- Location: tests/{area}/functional/[name].spec.ts  (run `ls tests/` first)
- Import from fixtures/fixtures.ts
- Use factory data from test-data/factories/{area}/ — never hardcode test content
- Tag with exactly ONE tag: @smoke | @sanity | @regression — or @destructive if the test modifies shared state (destructive overrides and is the only tag)
- Write the test plan first: test-plans/{area}/[name].md — scenario headings are the exact test titles
- Start the spec with `// plan: test-plans/{area}/[name].md`
- Test titles are plain sentences (no "should")
- Design the plan with the test-design skill (product risks, technique evaluation, models); each scenario names its technique and what it covers; data-driven loops use one labelled representative per partition. Show the plan and wait for approval before writing the spec
- Every GIVEN / WHEN / THEN / AND line is its own test.step; each THEN / AND step holds one expect.soft with no message
- A later part (an action and its checks) calls skipIfChecksFailed / skipIfEarlierStepSkipped from helpers/util/softChecks.ts
- Create the GIVEN state through the API (e.g. a createdUser helper fixture), not through the UI
- An API read-back in a UI test checks only the message or the stored data
- Use beforeEach for navigation/setup

Test scenarios:
1. [Scenario 1]
2. [Scenario 2]
```

## Create an E2E Test

E2E tests chain multiple features together in a single test that mirrors a complete real user journey.

```
Create an E2E test for [USER JOURNEY].

First, run `ls tests/` to find the correct area subdirectory.

Then navigate through the full flow at [STARTING_URL] to discover:
- The complete sequence of steps from start to finish
- Elements and state at each milestone
- Final expected state

Then generate the test with:
- Location: tests/{area}/e2e/[name].spec.ts  (use real area name from ls)
- A SINGLE test covering the entire journey (not one test per step)
- Factory data from test-data/factories/{area}/
- Tag: @e2e
- Steps that chain naturally: setup → action → action → ... → final assertion
- Same step layout as functional tests: one test.step per GIVEN / WHEN / THEN / AND line, one expect.soft per check step, each later part skipped after a failed check
```

## Add Data-Driven Tests

```
Add data-driven tests to [TEST FILE] for [SCENARIO]:
- Use static data from test-data/static/{area}/[file].ts  (run `ls test-data/static/` first)
- Import the named `as const` export; never redeclare inline
- Loop outside test blocks to generate individual tests
- Each test should have descriptive name including test data

Test data structure (test-data/static/{area}/[file].ts):

export const CASES = [
    { description: '', input: '', expected: '' },
] as const;
```

## Add API Test

```
Create an API test for [ENDPOINT]:
- HTTP method: [GET|POST|PUT|DELETE|PATCH]
- Endpoint: [/api/path]
- Request body schema: [describe fields and their types]
- Expected response schema: [describe fields]

FIRST: Source the contract. If OpenAPI / Swagger documentation exists, build
schemas and tests strictly from it. Only explore the live endpoint if no
documentation is available. Then build a coverage plan by listing every status
code from the spec for this endpoint, stating what test will cover each.
Present the plan before generating code.

Requirements:
- Create Zod schema in fixtures/api/schemas/{area}/ (run `ls fixtures/api/schemas/` first; use z.strictObject())
- Use the apiRequest fixture (destructured from test context)
- Start the spec with `// plan: test-plans/{area}/[name].md`; test titles are plain sentences
- Design the plan with the test-design skill: domain testing for every documented constraint (one value per partition, both sides of every range or length), combinatorial testing for multi-parameter queries, CRUD testing for resource lifecycles, one test per decision-table rule. Show the plan and wait for approval before writing the spec
- Each API call is a WHEN step; each response gets its own steps: THEN HTTP status, AND the API's outcome field (when the profile names one), AND the message, then the schema step last: expect(SchemaName.parse(body)).toBeTruthy();
- Each THEN / AND step holds one expect.soft with no message; a second call uses skipIfChecksFailed / skipIfEarlierStepSkipped
- Pull endpoint paths from enums/{area}/* (e.g., ApiEndpoints.PRODUCTS) — never hardcode
- Pull URLs and tokens from process.env.* — never hardcode
- Tag with @api
- For endpoints with a body (POST/PUT/PATCH), include comprehensive validation:
  - Empty body test ({})
  - Each required field omitted individually (destructure + rest)
  - Each field tested with type-inappropriate values via for...of loop,
    importing the universal arrays from test-data/static/util/invalid-values.ts
    (INVALID_STRING_VALUES, INVALID_NUMBER_VALUES, etc.) — never redefine inline
  - Field-specific boundary / range violations may stay inline in the spec
  - Use factory data (generateX()) for the valid base payload
- For endpoints with path params: invalid format data-driven loop (numeric, boolean-like, special chars, SQL injection)
- For endpoints with auth: 401 (no token) and 403 (wrong role) tests
- For all endpoints: at least one 405 test with unsupported HTTP method
- Any test that would fail due to a known bug: write it as the spec says and let it fail — never omit, never wrap; skip it only in the quarantine form when the profile chooses `plans.knownDefects: quarantine`
```
