# Login API — Test Plan

<!-- plan-contract: 1 -->

|                 |                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| **Feature**     | `POST /users/login` of the Contact List App API                                                          |
| **Spec**        | `tests/app/api/login.spec.ts`                                                                            |
| **Explored**    | Postman collection `4012288/TzK2bEa8`, request "Log In User"; live requests with `curl` to fill its gaps |
| **Explored on** | 2026-10-16                                                                                               |

## Expected behaviour and its sources

- `POST /users/login` takes a JSON body `{ email, password }` and answers 200 with `{ user: { _id, firstName, lastName, email, __v }, token }` — requirement — Postman collection, "Log In User" request and its saved 200 response.
- **No error response is documented** — no status code, no body. Everything below about rejected requests is observed, not documented; the missing documentation is flagged to the team.
- The API stores and returns emails in lower case (an account created with `Dayna.Reichel…@example.net` is returned as `dayna.reichel…@example.net`); the test data therefore uses lower-case emails — observation, 2026-10-16, production, first run of LAPI-1.1.
- The returned token authenticates `GET /users/me`, which returns the same user — observation, 2026-10-16, production, live requests (the Postman collection documents `GET /users/me` with a bearer token).
- A wrong password, an unregistered email, an empty string, a missing field, a field of type number, boolean or null, an empty body `{}`, a form-encoded body, and MongoDB operator objects (`{ "$ne": null }`, `{ "$gt": "" }`, `{ "$regex": ".*" }`) in either field all answer **401 with an empty body** — observation, 2026-10-16, production, live requests.
- An `email` sent as an **array** containing the account's email answers **200 and a token** — also when another address comes first (`["x@example.com", "<email>"]`). A `password` sent as an array answers 401 — observation, 2026-10-16, production, live requests.
- `PUT`, `PATCH` and `DELETE` on `/users/login` hang for about 30 s and end with Heroku's **503** "Application Error" page; `GET` answers 200 with the app's HTML page — observation, 2026-10-16, production, live requests.
- Malformed JSON answers 400 with an HTML "Bad Request" page — observation, 2026-10-16, production, live requests.

## Starting state (every scenario)

- Scenarios that need an account use the `createdUser` helper fixture: a new account per test through `POST /users` with Faker data, deleted in teardown through `DELETE /users/me`. No test uses the shared account in `env/.env.*`.
- Scenarios without an account (method, empty body) create nothing.

## Test design

Designed with the `test-design` skill — techniques from ISTQB CTAL-TA v4.0 and CTFL v4.0.1.

**Test basis:** the Postman collection (the 200 contract); live requests on 2026-10-16 for everything the collection leaves out (characterization); RFC 9110 §15.5.6 for a method the resource does not support.

### Product risks

| Risk item                                | Likelihood (why)                                                   | Impact (why)                                                | Level  | Depth, tag                                  | Source                      |
| ---------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- | ------ | ------------------------------------------- | --------------------------- |
| Login with valid credentials             | low — the UI and the API agree; unchanged since 2021               | high — every authenticated call needs the token             | high   | contract + oracle check, `@api`             | decision — user, 2026-10-16 |
| Rejecting wrong or malformed credentials | medium — input types are not checked (the array email is accepted) | high — a wrong acceptance hands out someone's token         | high   | every DT rule, every type partition, `@api` | decision — user, 2026-10-16 |
| Unsupported methods                      | high — observed hanging                                            | low — a slow error for a client that calls the wrong method | medium | one representative method, `@api`           | decision — user, 2026-10-16 |

### Technique evaluation

| Technique                  | Status  | Model or reason                                                                                                   |
| -------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| Domain testing (EP + BVA)  | Applied | value and type partitions below; BVA N/A — no length or range in the collection                                   |
| Combinatorial testing      | N/A     | two inputs — the decision table and the per-field partitions are already exhaustive                               |
| Decision table             | Applied | DT-1: email registered × password correct                                                                         |
| State transition           | N/A     | the endpoint only issues a token; ending a session belongs to `POST /users/logout` (covered in the UI login plan) |
| Scenario-based testing     | N/A     | one request, no workflow                                                                                          |
| CRUD testing               | N/A     | no entity is created or changed by the caller                                                                     |
| Checklist / error guessing | Applied | CL-1 below                                                                                                        |
| Comparison with an oracle  | Applied | `GET /users/me` with the returned token must return the same user — the token's effect, not only its presence     |

### Models

**Value partitions** (basis: the collection and DT-1)

| Input    | Valid                  | Invalid                             |
| -------- | ---------------------- | ----------------------------------- |
| email    | V1 registered          | I1 empty string · I3 not registered |
| password | V2 matches the account | I4 empty string · I5 does not match |

**Type partitions** (basis: the collection's body shows two strings; `INVALID_STRING_VALUES` from `test-data/static/util/invalid-values.ts`, plus the domain cases of CL-1)

| Field    | Partitions (one representative each)                                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| email    | number `123` · boolean `true` · `null` · missing (`undefined`, which JSON drops) · array `[<email>]` · operator object `{ "$ne": null }` |
| password | number `123` · boolean `true` · `null` · missing (`undefined`) · array `[<password>]` · operator object `{ "$ne": null }`                |

`undefined` in `INVALID_STRING_VALUES` serializes as an omitted key, so it is the per-field omission test — no separate omission scenario. The array representative holds the account's real value, so it is rejected only because of its type.

**DT-1**

| Condition / action    | R1  | R2  | R3  |
| --------------------- | --- | --- | --- |
| Email registered      | Y   | Y   | N   |
| Password correct      | Y   | N   | –   |
| → 200, user and token | ✓   |     |     |
| → 401, empty body     |     | ✓   | ✓   |

R3 merges N/Y and N/N. Checksum: 1 + 1 + 2 = 4 = the full table's feasible rules.

**CL-1** (error guessing)

| Item                                                  | Expected result and its basis                                                             |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Array instead of a string (MongoDB casts it to `$in`) | 401, like every other non-string type — decision — user, 2026-10-16 (observed: email 200) |
| Operator object (NoSQL injection)                     | 401 — observed                                                                            |
| Empty body `{}`                                       | 401 — observed                                                                            |
| Form-encoded body instead of JSON                     | 401 — observed                                                                            |
| Unsupported method (`PUT`)                            | 405 (RFC 9110 §15.5.6) — decision — user, 2026-10-16 (observed: 503 after ~30 s)          |

## Scenarios

### 1. Successful login

#### 1.1 POST /users/login with a registered email and password returns 200 and a token for that user

**ID:** LAPI-1.1 · **Tag:** `@api` · **Priority:** high · **Purpose:** conformance · **Readiness:** ready

**Source:** requirement — Postman collection, "Log In User" 200 response; oracle — `GET /users/me`, same collection

**Isolation:** `createdUser` — a new account, deleted in teardown

**Tests:** `tests/app/api/login.spec.ts`

**Technique:** domain testing, decision table, comparison with an oracle · **Covers:** EP V1+V2 · DT R1 · oracle `GET /users/me`

1. **GIVEN** a registered user
2. **WHEN** POST /users/login is sent with their email and password
3. **THEN** HTTP status is 200
4. **AND** the returned user has the account's name and email
5. **AND** the response body has the expected schema
6. **WHEN** GET /users/me is sent with the returned token
7. **THEN** HTTP status is 200
8. **AND** it returns the same user

### 2. Rejected credentials

#### 2.1 POST /users/login with <partition> returns 401 and an empty body

**ID:** LAPI-2.1 · **Tag:** `@api` · **Priority:** high · **Purpose:** characterization · **Readiness:** ready

**Source:** observation — 2026-10-16, production, live requests (401, empty body)

**Isolation:** `createdUser` — a new account, deleted in teardown

**Tests:** `tests/app/api/login.spec.ts`

**Technique:** domain testing, decision table · **Covers:** one invalid value partition per case · DT R2, R3

**Cases** (`partition`):

- `a wrong password` — EP I5 · DT R2
- `an unregistered email` — EP I3 · DT R3
- `an empty email` — EP I1
- `an empty password` — EP I4

1. **GIVEN** a registered user
2. **WHEN** POST /users/login is sent with `<partition>` and the other field valid
3. **THEN** HTTP status is 401
4. **AND** the response body is empty

### 3. Request body validation

#### 3.1 POST /users/login with an empty body returns 401 and an empty body

**ID:** LAPI-3.1 · **Tag:** `@api` · **Priority:** medium · **Purpose:** characterization · **Readiness:** ready

**Source:** observation — 2026-10-16, production, live requests

**Isolation:** read-only — no account needed

**Tests:** `tests/app/api/login.spec.ts`

**Technique:** error guessing · **Covers:** CL-1 empty body

1. **WHEN** POST /users/login is sent with `{}`
2. **THEN** HTTP status is 401
3. **AND** the response body is empty

#### 3.2 POST /users/login with "<field>" as <type> returns 401 and an empty body

**ID:** LAPI-3.2 · **Tag:** `@api` · **Priority:** high · **Purpose:** characterization · **Readiness:** ready

**Source:** observation — 2026-10-16, production, live requests (401 for every case listed)

**Isolation:** `createdUser` — a new account, deleted in teardown

**Tests:** `tests/app/api/login.spec.ts`

**Technique:** domain testing (type partitions), error guessing · **Covers:** one type partition per case, per field

**Cases** (`field`, `type`):

- `email` · `123`
- `email` · `true`
- `email` · `null`
- `email` · `undefined`
- `email` · `{"$ne":null}`
- `password` · `123`
- `password` · `true`
- `password` · `null`
- `password` · `undefined`
- `password` · `{"$ne":null}`

1. **GIVEN** a registered user
2. **WHEN** POST /users/login is sent with `<field>` as `<type>` and the other field valid
3. **THEN** HTTP status is 401
4. **AND** the response body is empty

#### 3.3 POST /users/login with "<field>" as an array holding the account's value returns 401 and an empty body

**ID:** LAPI-3.3 · **Tag:** `@api` · **Priority:** high · **Purpose:** conformance · **Readiness:** ready

**Source:** decision — user, 2026-10-16, 401 like every other non-string type; observation — 2026-10-16, production, live requests (email → 200 and a token; password → 401)

**Isolation:** `createdUser` — a new account, deleted in teardown

**Tests:** `tests/app/api/login.spec.ts`

**Technique:** error guessing · **Covers:** CL-1 array instead of a string

**Cases** (`field`):

- `email`
- `password`

1. **GIVEN** a registered user
2. **WHEN** POST /users/login is sent with `<field>` as an array holding the account's value
3. **THEN** HTTP status is 401
4. **AND** the response body is empty

#### 3.4 POST /users/login with a form-encoded body returns 401 and an empty body

**ID:** LAPI-3.4 · **Tag:** `@api` · **Priority:** low · **Purpose:** characterization · **Readiness:** ready

**Source:** observation — 2026-10-16, production, live requests

**Isolation:** `createdUser` — a new account, deleted in teardown

**Tests:** `tests/app/api/login.spec.ts`

**Technique:** error guessing · **Covers:** CL-1 form-encoded body

1. **GIVEN** a registered user
2. **WHEN** POST /users/login is sent with their email and password form-encoded
3. **THEN** HTTP status is 401
4. **AND** the response body is empty

### 4. Methods

#### 4.1 PUT /users/login returns 405

**ID:** LAPI-4.1 · **Tag:** `@api` · **Priority:** medium · **Purpose:** conformance · **Readiness:** ready

**Source:** decision — user, 2026-10-16, RFC 9110 §15.5.6; observation — 2026-10-16, production, live requests (503 after ~30 s)

**Isolation:** read-only

**Tests:** `tests/app/api/login.spec.ts`

**Technique:** error guessing · **Covers:** CL-1 unsupported method

1. **WHEN** PUT /users/login is sent
2. **THEN** HTTP status is 405

## Why tests currently fail

| Behaviour of the live app                                             | Failing lines                                            | Scenarios               | Defect                                        |
| --------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------- | --------------------------------------------- |
| An `email` array holding the account's email logs in: 200 and a token | THEN HTTP status is 401 · AND the response body is empty | LAPI-3.3 (`email` case) | not filed — confirmed by the user, 2026-10-16 |
| `PUT /users/login` hangs ~30 s and ends with Heroku's 503 page        | THEN HTTP status is 405                                  | LAPI-4.1                | not filed — confirmed by the user, 2026-10-16 |

## Skipped tests

| Scenarios | Kind | Defect or reason |
| --------- | ---- | ---------------- |

## Not covered here

- Malformed JSON (observed: 400, HTML page) — `apiRequest` sends only valid JSON; a raw-body request would need a new option in the shared fixture.
- The `token` cookie the response sets — the UI login plan covers the session it starts.
- Email letter case and surrounding spaces — characterized in the UI login plan (`test-plans/app/login.md`, LOGIN-4.2 / 4.3).
- `GET /users/login` (observed: the app's HTML page) — the path is also a UI route.
- Logout and token expiry — `POST /users/logout`, its own feature.
