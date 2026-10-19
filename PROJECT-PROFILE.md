---
# Written by kit-tailor on 2026-10-17. Names only — never secret values.
profileSchema: 1
kitVersion: 0.1.0 # KIT-MANIFEST.md, "Kit version"

project:
    name: playwright-agentic-kit-demo # GitHub repository amanemre/playwright-agentic-kit-demo
    app: Contact List App — a demo web app and JSON API for managing a user's contacts (https://thinking-tester-contact-list.herokuapp.com)

mode: scaffold # kit-install.mjs --mode scaffold, commit 12c1d5f
preset: playwright-house-preset

stack:
    framework: playwright # @playwright/test ^1.62.1 in package.json
    language: typescript # tsconfig.json

capabilities:
    ui: true # tests/app/functional/login.spec.ts
    api: true # tests/app/api/login.spec.ts
    auth: JWT from POST /users or POST /users/login — a bearer token for the API, the same token as the `token` cookie for the UI
    contractValidation: zod # zod ^4.4.3; fixtures/api/schemas/app/
    reporting: [list, html] # playwright.config.ts reporters; JSON on demand for the run summary

paths:
    area: app
    tests: tests
    plans: test-plans/app # run-summary.mjs reads only the top level of this folder
    testEntry: fixtures/fixtures.ts
    pageManager: pages/page-manager.ts
    pageObjects: pages/app
    fixtures: fixtures
    helperFixtures: fixtures/helper/helper-fixture.ts
    schemas: fixtures/api/schemas/app
    enums: enums/app
    helpers: helpers/util
    factories: test-data/factories/app
    staticData: test-data/static/app
    config: config

packageManager: npm # package-lock.json

commands:
    discover: npx playwright test --list
    typecheck: npm run typecheck
    lint: npm run lint
    test: npm test # excludes @destructive
    summary: node scripts/run-summary.mjs --report reports/results.json

env:
    selector: ENVIRONMENT # playwright.config.ts
    files: env/.env.<ENVIRONMENT>
    default: dev
    appUrl: APP_URL
    apiUrl: API_URL
    credentials: [APP_EMAIL, APP_PASSWORD] # declared in env/.env.example; no test uses them (see "Authentication and accounts")

hosts: [thinking-tester-contact-list.herokuapp.com]

exploration:
    tool: playwright-cli # scripts/playwright-cli.sh
    fallbacks: []

execution:
    repairAttempts: 2

architecture:
    pageAccess: pageManager
    pageObjects: getter-locators

validation:
    library: zod
    unknownFieldPolicy: strict
    assertionPattern: expect(Schema.parse(body)).toBeTruthy()

reporting:
    style: readable-steps
    helper: helpers/util/softChecks.ts
    capture: traces on the first retry, screenshots on failure, videos kept on failure — under reports/test-results (playwright.config.ts)

tags:
    allowed:
        ['@smoke', '@sanity', '@regression', '@e2e', '@api', '@destructive']
    perTest: 1

plans:
    headingIsTitle: true
    specHeader: '// plan:'
    knownDefects: fail # preset default; LAPI-3.3 (email) and LAPI-4.1 stay failing tests

data:
    staticFormat: ts-as-const
    factories: faker # @faker-js/faker; test-data/factories/app/

lifecycle:
    cleanup: helper fixtures `createdUser` and `createdContact` delete what they created in teardown, with a fresh login token
    setupVia: api

api:
    coverage: full-matrix

ci:
    system: github-actions # .github/workflows/tests.yml, from templates/ci/github-actions.yml
    gate: summary
    pullRequest: smoke+changed
    shards: 1 # 31 tests run in about 40 s; keep in step with the workflow's shard matrix
    smokeTag: '@smoke'
    serialTag: '@destructive'

tracker:
    system: linear # decision — user, 2026-10-17
    access: mcp # the Linear MCP server in .mcp.json (https://mcp.linear.app/mcp), connected by the user
    project: AGE # the key of the Linear team "Agentic Training" — a team, not a Linear project (the team has no projects)
    idPattern: 'AGE-\d+'
    defectType: Bug # the "Bug" label

delivery:
    host: github # origin → github.com/amanemre/playwright-agentic-kit-demo
    baseBranch: main # remote HEAD → main
    cli: gh
    branchPattern: '{type}/{ticket}-{short-name}' # decision — user, 2026-10-17: new branches use it with Linear IDs (e.g. test/AGE-1-add-contact); earlier branches keep their names
    commitStyle: conventional # every commit subject: chore: / test:

overrides:
    - rule: DEF-05
      choice: a read-back call may run inside its AND step
      reason: a call that only reads back the effect of the request under test (e.g. a login proving a password was stored) runs inside the AND step that checks that effect, gated with skipIfChecksFailed; the request under test keeps its own WHEN step — a functional test checks only its own point
      source: decision — user, 2026-10-19 (AGE-10)

projectTerms: [Contact List, contact-list-app, thinking-tester, herokuapp]

termExceptions:
    - path: PROJECT-PROFILE.md
      reason: the profile is where project terms belong

standingApprovals: []

openQuestions: []
---

# Project profile — playwright-agentic-kit-demo

## The application

The Contact List App (`APP_URL`) is a small public demo app: users sign up, log in and manage their own contacts. The login page is `/`; after login the user lands on `/contactList`. The app says its database "will be purged as needed", so tests never rely on data they did not create.

Plans: `test-plans/app/login.md` (UI login), `test-plans/app/login-api.md` (`POST /users/login`), `test-plans/app/add-user-api.md` (`POST /users`).

## API conventions

- Documentation: a Postman collection, `https://documenter.getpostman.com/view/4012288/TzK2bEa8` (JSON at `https://documenter.gw.postman.com/api/collections/4012288/TzK2bEa8`). It documents request bodies and one success response per request — **no error responses**. Expected errors are therefore observed (characterization) or decided by the user, and the plan says which.
- Base URL `API_URL`, which equals `APP_URL`; paths in `enums/app/app.ts` (`ApiEndpoints`).
- Requests are JSON (`body:`); a form-encoded body is rejected.
- Outcomes are HTTP statuses — there is no outcome field in the body.
- Authentication: `Authorization: Bearer <token>` (`apiRequest`'s `headers`). A rejected login is 401 with an **empty body** (`expect(body).toBeNull()`).
- Emails are stored and returned in lower case; factories generate lower-case emails so responses echo them unchanged.

## Authentication and accounts

- Every test that needs an account creates its own with the `createdUser` helper fixture (`POST /users`, Faker data) and deletes it in teardown (`DELETE /users/me`). Its email and password are test data, not secrets, and may be typed into the UI.
- There is no shared account today (decision — user, 2026-10-17): `APP_EMAIL` / `APP_PASSWORD` are declared in `env/.env.example` but unused. If one is added, it is never typed into the UI (INV-04).
- UI tests log in through the form, or set the `token` cookie to `createdUser.token` and open `/contactList` when login is only the starting state.

## Starting state over HTTP

- `createdUser` — `POST /users` → 201; the token is read with `z.looseObject({ token: z.string() })`.
- `createdContact` — `POST /contacts` with `createdUser.token` → 201; the id is read from `_id`.
- Teardown logs in again (`POST /users/login`) for a fresh token, because a test that logs out invalidates the setup token; then `DELETE /contacts/<id>` and `DELETE /users/me`, each expecting 200.

## Environment

- Heroku-hosted: `PUT` / `PATCH` / `DELETE /users/login` hang about 30 s and end in Heroku's 503 page; a test calling them needs `test.slow()`.
- Playwright browsers: run `npx playwright install chromium` after a Playwright upgrade.
- CI (`.github/workflows/tests.yml`): `APP_URL` and `API_URL` are set in the workflow (public URLs); `APP_EMAIL` / `APP_PASSWORD` come from the repository's secrets, which the user adds. No env file is written in CI — the variables come from the job's environment.
- `playwright-cli` warns that `.claude/skills/playwright-cli` does not match the tool version (`playwright-cli install --skills` updates it).

## Tracker

Linear, through the MCP server in `.mcp.json`. Tickets live in the **team** "Agentic Training" (key `AGE`, IDs `AGE-<n>`); the team has no Linear projects, so find and file tickets by team, never by project. Defects are filed in that team with the `Bug` label, only after the user confirms each one.

## Known defects

| Defect                                                                                                           | Scenario                     | Plan                             | Ticket |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------- | ------ |
| `POST /users/login` with `email` as an array holding the account's email returns 200 and a token                 | LAPI-3.3 (`email`)           | `test-plans/app/login-api.md`    | AGE-8  |
| `PUT /users/login` hangs ~30 s and returns 503 instead of 405                                                    | LAPI-4.1                     | `test-plans/app/login-api.md`    | AGE-9  |
| `/contactList` without a session is not redirected to the login page                                             | CLIST-4.1                    | `test-plans/app/contact-list.md` | AGE-7  |
| `POST /users` without `email` answers "Email address is already in use" instead of reporting `email` as required | UAPI-4.1 (`email`), UAPI-6.1 | `test-plans/app/add-user-api.md` | AGE-11 |
| `POST /users` trims the password, so the account does not log in with the password as sent                       | UAPI-2.2                     | `test-plans/app/add-user-api.md` | AGE-12 |
| `POST /users` accepts a password longer than 72 characters and cuts it to 72                                     | UAPI-5.3                     | `test-plans/app/add-user-api.md` | AGE-13 |
| `PUT /users` hangs ~30 s and returns 503 instead of 405                                                          | UAPI-7.1                     | `test-plans/app/add-user-api.md` | AGE-14 |

Confirmed by the user (LAPI on 2026-10-16, CLIST and UAPI on 2026-10-18) and filed in Linear (AGE-7 to AGE-9 on 2026-10-18, AGE-11 to AGE-14 on 2026-10-19).

## Worked examples

- UI: `tests/app/functional/login.spec.ts` with `test-plans/app/login.md` — readable steps, `createdUser` / `createdContact`, a success check that proves the session's effect (the seeded contact is listed).
- API: `tests/app/api/login.spec.ts` with `test-plans/app/login-api.md` — the status / field / schema step order, an oracle read-back (`GET /users/me`), per-field type loops with a shared `verifyRejected` function, and two known-defect tests that stay failing.
