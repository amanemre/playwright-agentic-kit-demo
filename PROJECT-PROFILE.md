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
    system: none # decision — user, 2026-10-17: no tracker yet; one will be chosen later
    access: manual # tickets and defect reports go through the user

delivery:
    host: github # origin → github.com/amanemre/playwright-agentic-kit-demo
    baseBranch: main # remote HEAD → main
    cli: gh
    branchPattern: '{type}/{ticket}-{short-name}' # decision — user, 2026-10-17: applies once a tracker is chosen; earlier branches keep their names
    commitStyle: conventional # every commit subject: chore: / test:

overrides: []

projectTerms: [Contact List, contact-list-app, thinking-tester, herokuapp]

termExceptions:
    - path: PROJECT-PROFILE.md
      reason: the profile is where project terms belong

standingApprovals: []

openQuestions:
    - question: Which ticket management tool will the project use? Record it in `tracker` once chosen.
      blocks: filing the two confirmed defects (LAPI-3.3 email case, LAPI-4.1); ticket IDs in branch names
    - question: Keep or remove the preset's example (pages/app/example.page.ts, tests/app/functional/example.spec.ts, test-plans/app/example.md)? The example plan also fails the Prettier check.
      blocks: nothing — it runs and passes
---

# Project profile — playwright-agentic-kit-demo

## The application

The Contact List App (`APP_URL`) is a small public demo app: users sign up, log in and manage their own contacts. The login page is `/`; after login the user lands on `/contactList`. The app says its database "will be purged as needed", so tests never rely on data they did not create.

Plans: `test-plans/app/login.md` (UI login), `test-plans/app/login-api.md` (`POST /users/login`).

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

## Known defects

| Defect                                                                                           | Scenario           | Plan                          |
| ------------------------------------------------------------------------------------------------ | ------------------ | ----------------------------- |
| `POST /users/login` with `email` as an array holding the account's email returns 200 and a token | LAPI-3.3 (`email`) | `test-plans/app/login-api.md` |
| `PUT /users/login` hangs ~30 s and returns 503 instead of 405                                    | LAPI-4.1           | `test-plans/app/login-api.md` |

Both were confirmed by the user on 2026-10-16 and are not filed yet — there is no tracker.

## Worked examples

- UI: `tests/app/functional/login.spec.ts` with `test-plans/app/login.md` — readable steps, `createdUser` / `createdContact`, a success check that proves the session's effect (the seeded contact is listed).
- API: `tests/app/api/login.spec.ts` with `test-plans/app/login-api.md` — the status / field / schema step order, an oracle read-back (`GET /users/me`), per-field type loops with a shared `verifyRejected` function, and two known-defect tests that stay failing.
