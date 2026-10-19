# Add User API — Test Plan

<!-- plan-contract: 1 -->

|                 |                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Feature**     | `POST /users` (Add User) of the Contact List App API — ticket AGE-10                                                            |
| **Spec**        | `tests/app/api/add-user.spec.ts`                                                                                                |
| **Explored**    | Linear AGE-10; Postman collection `4012288/TzK2bEa8`, request "Add User"; live HTTP requests (Python `urllib`) to fill its gaps |
| **Explored on** | 2026-10-18                                                                                                                      |

## Expected behaviour and its sources

- `POST /users` takes a JSON body `{ firstName, lastName, email, password }` and answers 201 with `{ user: { _id, firstName, lastName, email, __v }, token }` — requirement — Postman collection, "Add User" request and its saved 201 response; AGE-10.
- The endpoint needs no authentication — requirement — AGE-10. (The collection's example request carries `Authorization: Bearer {{token}}`; a request without it answered 201 — observation, 2026-10-18, production, live requests.)
- **No error response, required field, format or length is documented** — AGE-10 says so and lists them as open questions. Everything below about rejected requests is observed, not documented, unless a decision says otherwise.
- **Decisions — user, 2026-10-18** (on the planner's open questions):
    - Every field is required: a missing `email` must answer 400 with an error reporting `email` as required, like the other fields; an empty body must report all four fields. The observed answer is a defect.
    - Numbers and booleans converted to strings stay as observed (characterization).
    - The password must not be trimmed: the account logs in with the password exactly as sent. The observed trimming is a defect.
    - A password longer than 72 characters must be rejected: 72 → 201, 73 → 400 with an error for `password`. The observed cut to 72 characters is a defect.
    - A registered email keeps answering 400.
    - `PUT /users` must answer 405 (RFC 9110 §15.5.6), never 503.
    - The proposed risk levels are confirmed.
    - Coverage: the 21-case wrong-value matrix (its 4 empty-string cases as their own scenario, UAPI-4.2, the other 17 in UAPI-4.3), 2-value boundaries, and the "no account created" check only in UAPI-3.1 and UAPI-6.2.
    - UAPI-1.1 reads the new account back with `GET /users/me` and checks only its status and the returned user, never its schema: the `GET /users/me` contract belongs to that endpoint's tests, so a schema defect there does not fail this scenario.
    - The password cases of UAPI-4.4 and UAPI-5.1 log in inside their AND step ("the account holds …"); that step is skipped when a `POST /users` check before it failed (decision — user, 2026-10-19; DEF-05 override in the profile).
- The returned token authenticates `GET /users/me`, which returns the same user, and the sent email and password log in through `POST /users/login` — observation, 2026-10-18, production, live requests (both endpoints documented in the same collection).
- Validation errors answer **400** with `{ errors: { <field>: {…} }, _message: "User validation failed", message: "User validation failed: <field>: <reason>" }`. An error entry is a Mongoose `ValidatorError` (`name`, `message`, `properties`, `kind`, `path`, `value`) or, for an array or object, a cast error (`stringValue`, `kind: "string"`, `value`, `path`, `reason`) — observation, 2026-10-18, production, live requests.
- `firstName`, `lastName` and `password` are required: missing, `""`, `null` and (names) whitespace only answer 400 with `kind: "required"` — observation, 2026-10-18, production, live requests.
- `email` must be an email address: `""`, `123`, `true`, `plainaddress`, `@example.com`, `explore@`, `x@example` (no dot in the domain), `explore x@example.com` and `a@b@example.com` answer 400 with "Email is invalid"; `null` answers 400 "Expected a string but received a null" — observation, 2026-10-18, production, live requests.
- **A missing `email`** answers **400 `{ "message": "Email address is already in use" }`**, with no `errors` object; an empty body `{}` and a form-encoded body list errors for `firstName`, `lastName` and `password` only — observation, 2026-10-18, production, live requests. (The message suggests a unique-index clash with an existing account that has no email; what a request without email does on an empty database was not observable.)
- Arrays and MongoDB operator objects (`{ "$ne": null }`) in any field answer 400 with a cast error — observation, 2026-10-18, production, live requests.
- **Numbers and booleans are converted to strings**: `firstName` / `lastName` `123` or `true` answer 201 and store `"123"` / `"true"`; `password` `12345678` answers 201; `password` `123` or `true` answer 400 only because the converted string is shorter than 7 — observation, 2026-10-18, production, live requests.
- Lengths: `firstName` and `lastName` 1–20 accepted, 21 rejected (`kind: "maxlength"`); `password` 6 rejected (`kind: "minlength"`), 7, 8 and 100 accepted; an email local part of 64 characters accepted, 65 rejected ("Email is invalid") — observation, 2026-10-18, production, live requests.
- An email already registered — in the same or in upper case — answers **400 `{ "message": "Email address is already in use" }`**, and the existing account keeps working. A body that also has an invalid field answers the validation error instead (validation runs first) — observation, 2026-10-18, production, live requests.
- Emails are stored in lower case and trimmed; names are trimmed — observation, 2026-10-18, production, live requests (both names were sent with spaces in one request).
- **The password is trimmed when stored**: an account created with `"  <password>  "` logs in with the trimmed password (200) and not with the password as sent (401) — observation, 2026-10-18, production, live requests.
- **A password is cut to its first 72 characters**: an 80-character password answers 201, and the account logs in (200) with the password as sent, with only its first 72 characters, and with its first 72 characters plus a different ending; its first 71 characters, or the password with the 72nd character changed, are refused (401). A 72-character password answers 201 and logs in with exactly those 72 characters (200); it also logs in with a longer password that starts with them — observation, 2026-10-18, production, live requests (two throwaway accounts, 72 and 80 characters).
- An unknown extra field (`role: "admin"`) is ignored: 201, and the returned user has no such field — observation, 2026-10-18, production, live requests.
- `PUT`, `PATCH` and `DELETE /users` hang about 30 s and end with Heroku's **503** "Application Error" page; `GET /users` answers 200 with the web app's page titled "404" — observation, 2026-10-18, production, live requests.
- Malformed JSON answers 400 with an HTML "Bad Request" page — observation, 2026-10-18, production, live requests.
- The 201 response sets a cookie — observation, 2026-10-18, production, live requests (`Set-Cookie` header).

Exploration created 23 throwaway accounts (`explore.<random>@example.com` and boundary-length variants); each was deleted with `DELETE /users/me` (200) and then failed to log in (401). No shared account was used.

## Starting state (every scenario)

- A scenario that creates an account through the request under test deletes it in teardown — `DELETE /users/me` with the token from the 201 response (decision — user, 2026-10-19: no test in this spec logs out, so that token is still valid). Every 201 a test receives is deleted the same way, also in a test that expected a rejection, so a defect cannot leave an account behind.
- The duplicate-email scenario uses the `createdUser` helper fixture for the registered account (deleted in its teardown).
- Valid values come from `generateUser()` (Faker, lower-case email); a length boundary sets only the length — the content is generated.
- Scenarios that are rejected by validation or that use another method create nothing.

## Test design

Designed with the `test-design` skill — techniques from ISTQB CTAL-TA v4.0 and CTFL v4.0.1.

**Test basis:** Linear AGE-10; the Postman collection (the request body and the 201 contract); live requests on 2026-10-18 for everything the collection leaves out (characterization); RFC 9110 §15.5.6 for a method the resource does not support.

### Product risks

Proposed by the planner and confirmed by the user on 2026-10-18.

| Risk item                                                             | Likelihood (why)                                                | Impact (why)                                                                  | Level  | Depth, tag                                                                  | Source                      |
| --------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------- | --------------------------- |
| Creating an account with valid details                                | low — every helper fixture calls it in every run                | high — sign-up is the entry to the app and every test's setup                 | high   | contract + `GET /users/me` read-back (status and user, no schema), `@smoke` | decision — user, 2026-10-18 |
| Email uniqueness (duplicate, letter case)                             | low — the unique check and lower-casing were observed           | high — a second account or an overwritten password on one email is a takeover | high   | every DT-1 rule, the existing account checked afterwards, `@api`            | decision — user, 2026-10-18 |
| The password stored differs from the one sent (trimming, 72-char cut) | high — both observed                                            | high — a user is locked out of the password they chose, or it is weaker       | high   | one conformance scenario each (failing today), `@api`                       | decision — user, 2026-10-18 |
| Field validation (required, type, email format)                       | medium — type conversion and the missing-email message observed | medium — invalid or misleading data stored; a client cannot tell what to fix  | medium | one representative per partition per field, `@api`                          | decision — user, 2026-10-18 |
| Length limits                                                         | low — limits observed consistently                              | medium — rejected sign-ups or names cut in the UI                             | medium | 2-value boundaries on every observed border, `@api`                         | decision — user, 2026-10-18 |
| Email and name normalisation                                          | low — observed working                                          | low — cosmetic; login is case-insensitive                                     | low    | one case per normalised input, `@api`                                       | decision — user, 2026-10-18 |
| Request encoding, empty body, unknown fields                          | low — observed rejected or ignored                              | low — a client error, no stored data                                          | low    | one representative each, `@api`                                             | decision — user, 2026-10-18 |
| Unsupported methods                                                   | high — observed hanging                                         | low — a slow error for a client that calls the wrong method                   | medium | one representative method, `@api`                                           | decision — user, 2026-10-18 |

### Technique evaluation

| Technique                  | Status  | Model or reason                                                                                                                                                             |
| -------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain testing (EP + BVA)  | Applied | PT-1 (value and type partitions per field), EF-1 (email format partitions), BT-1 (length boundaries, 2-value) — observed, or decided by the user on 2026-10-18 where marked |
| Combinatorial testing      | N/A     | four independent string fields, each with its own rule; one invalid partition per test against a valid base payload; DT-1 holds the only interaction                        |
| Decision table             | Applied | DT-1: body valid × email already registered                                                                                                                                 |
| State transition           | Applied | ST-1: an email's state — free → registered (201); `POST` on registered → rejected. Registered → free belongs to `DELETE /users/me` (its own ticket)                         |
| Scenario-based testing     | N/A     | one request; the UI sign-up journey belongs in a UI plan                                                                                                                    |
| CRUD testing               | N/A     | only Create is in scope; read-after-create is the oracle of UAPI-1.1; update and delete belong to the `/users/me` tickets                                                   |
| Checklist / error guessing | Applied | CL-1 below                                                                                                                                                                  |
| Comparison with an oracle  | Applied | `GET /users/me` with the returned token — the stored record (UAPI-1.1); `POST /users/login` where the stored password is the effect (UAPI-2.2, 3.1, 4.4, 5.1, 6.2)          |

### Models

**PT-1 — value and type partitions** (basis: the collection's body shows four strings; `INVALID_STRING_VALUES` from `test-data/static/util/invalid-values.ts`, plus the CL-1 cases; the kind is the observed `errors.<field>.kind` — `required`, `string` (wrong type), `user defined` ("Email is invalid"), `minlength` / `maxlength` (too short / too long))

| Field     | Valid              | Missing (`undefined`)                                                               | `""`               | whitespace only | `null`             | number                        | boolean                             | array `["<valid>"]` | object `{ "$ne": null }` |
| --------- | ------------------ | ----------------------------------------------------------------------------------- | ------------------ | --------------- | ------------------ | ----------------------------- | ----------------------------------- | ------------------- | ------------------------ |
| firstName | Faker name, 1–20   | 400 `required`                                                                      | 400 `required`     | 400 `required`  | 400 `required`     | `123` → 201 as `"123"` (kept) | `true` → 201 as `"true"` (kept)     | 400 `string`        | 400 `string`             |
| lastName  | Faker name, 1–20   | 400 `required`                                                                      | 400 `required`     | 400 `required`  | 400 `required`     | `123` → 201 as `"123"` (kept) | `true` → 201 as `"true"` (kept)     | 400 `string`        | 400 `string`             |
| email     | unique, lower case | 400 `required` — decision, 2026-10-18 (observed: 400 "already in use", no `errors`) | 400 `user defined` | —               | 400 `user defined` | `123` → 400 `user defined`    | `true` → 400 `user defined`         | 400 `string`        | 400 `string`             |
| password  | 7–72 characters    | 400 `required`                                                                      | 400 `required`     | —               | 400 `required`     | `12345678` → 201 (kept)       | `true` → 400 `minlength` (see note) | 400 `string`        | 400 `string`             |

"Kept" — the conversion to a string stays as observed (decision — user, 2026-10-18).

`undefined` serializes as an omitted key, so it is the per-field omission test (UAPI-4.1); `""` is UAPI-4.2; the other invalid partitions are UAPI-4.3. For `password`, a number is sent as `12345678` so that only its type differs — `123` would also break the minimum length. A boolean always converts to `"true"` / `"false"`, shorter than 7, so for `password` it cannot be separated from the length rule; its recorded kind is `minlength`. Email whitespace only was not observed and is left out.

**EF-1 — email format partitions** (basis: observation, 2026-10-18; one value per rule it breaks — `test-data/static/app/`)

| Partition                 | Representative        | Observed               |
| ------------------------- | --------------------- | ---------------------- |
| no "@"                    | `plainaddress`        | 400 "Email is invalid" |
| no local part             | `@example.com`        | 400 "Email is invalid" |
| no domain                 | `<local>@`            | 400 "Email is invalid" |
| no dot in the domain      | `<local>@example`     | 400 "Email is invalid" |
| a space in the local part | `<a> <b>@example.com` | 400 "Email is invalid" |
| two "@"                   | `a@b@example.com`     | 400 "Email is invalid" |

**BT-1 — length boundaries** (basis: observation, 2026-10-18, and the user's decision of 2026-10-18 for the password's upper border; 2-value — both sides of every border; the content is generated)

| Field     | Border                       | Valid side | Invalid side                                                      |
| --------- | ---------------------------- | ---------- | ----------------------------------------------------------------- |
| firstName | lower (required)             | 1          | 0 — `""` in PT-1                                                  |
| firstName | upper (`maxlength`)          | 20         | 21 → 400 `maxlength`                                              |
| lastName  | lower (required)             | 1          | 0 — `""` in PT-1                                                  |
| lastName  | upper (`maxlength`)          | 20         | 21 → 400 `maxlength`                                              |
| password  | lower (`minlength`)          | 7          | 6 → 400 `minlength`                                               |
| password  | upper — decision, 2026-10-18 | 72         | 73 → 400 (observed: accepted, and cut to the first 72 characters) |
| email     | local part                   | 64         | 65 → 400 `user defined`                                           |

**DT-1** (basis: observation, 2026-10-18)

| Condition / action                            | R1  | R2  | R3  |
| --------------------------------------------- | --- | --- | --- |
| Every field valid                             | Y   | Y   | N   |
| Email already registered (any letter case)    | N   | Y   | –   |
| → 201, user and token                         | ✓   |     |     |
| → 400, "Email address is already in use"      |     | ✓   |     |
| → 400, validation error for the invalid field |     |     | ✓   |

R3 merges N/Y and N/N — observed: an invalid `firstName` or a short `password` with a registered email answers the validation error. Checksum: 1 + 1 + 2 = 4 = the full table's feasible rules. R3 is covered by PT-1, EF-1 and BT-1.

**ST-1 — an email's state** (basis: observation, 2026-10-18)

| From       | Event                      | To                                  | Covered by                        |
| ---------- | -------------------------- | ----------------------------------- | --------------------------------- |
| free       | `POST /users` (valid body) | registered                          | UAPI-1.1                          |
| registered | `POST /users` (same email) | registered (400, account unchanged) | UAPI-3.1                          |
| registered | `DELETE /users/me`         | free                                | not here — the `/users/me` ticket |

**CL-1** (error guessing)

| Item                                                | Expected result and its basis                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Registered email in another letter case             | 400 "already in use" — observed                                                                                     |
| A duplicate sign-up overwrites the existing account | the existing account still logs in with its own password and names — observed                                       |
| Surrounding spaces in email and names               | trimmed — observed                                                                                                  |
| Surrounding spaces in the password                  | the account logs in with the password exactly as sent — decision — user, 2026-10-18 (observed: trimmed when stored) |
| Password longer than 72 characters                  | 400 with an error for `password` — decision — user, 2026-10-18 (observed: accepted, cut to the first 72 characters) |
| Number or boolean instead of a string               | converted and accepted — observed; kept — decision — user, 2026-10-18                                               |
| Array, operator object (NoSQL injection)            | 400 cast error — observed                                                                                           |
| Missing email                                       | 400, `email` reported as required — decision — user, 2026-10-18 (observed: 400 "already in use")                    |
| Empty body `{}`                                     | 400, all four fields reported as required — decision — user, 2026-10-18 (observed: three fields)                    |
| Form-encoded body instead of JSON                   | 400, no account created — observed                                                                                  |
| Unknown extra field (mass assignment)               | ignored — observed                                                                                                  |
| The response leaks the password                     | never — the strict 201 schema has no password field (requirement — collection)                                      |
| Unsupported method (`PUT`)                          | 405 (RFC 9110 §15.5.6) — decision — user, 2026-10-18 (observed: 503 after ~30 s)                                    |

## Scenarios

### 1. Account creation

#### 1.1 POST /users with valid details returns 201 and a token for the new account

**ID:** UAPI-1.1 · **Tag:** `@smoke` · **Priority:** high · **Purpose:** conformance · **Readiness:** ready

**Source:** requirement — Postman collection, "Add User" 201 response; AGE-10; oracle `GET /users/me`, same collection; decision — user, 2026-10-18, tag `@smoke`, no login read-back, no schema check on the `GET /users/me` response

**Isolation:** the account the test creates — deleted in teardown

**Tests:** `tests/app/api/add-user.spec.ts`

**Technique:** domain testing, decision table, state transition, comparison with an oracle · **Covers:** PT-1 valid partition of every field · DT-1 R1 · ST-1 free → registered · oracle `GET /users/me`

1. **WHEN** POST /users is sent with a new user's details
2. **THEN** HTTP status is 201
3. **AND** the returned user has the sent names and email
4. **AND** the response body has the expected schema
5. **WHEN** GET /users/me is sent with the returned token
6. **THEN** HTTP status is 200
7. **AND** it returns the same user

The `GET /users/me` response is checked for its status and the user's `_id`, names and email only — its schema is checked by the `GET /users/me` tests (decision — user, 2026-10-18).

### 2. Normalisation of the stored values

#### 2.1 POST /users with <input> returns 201 and the normalised value

**ID:** UAPI-2.1 · **Tag:** `@api` · **Priority:** low · **Purpose:** characterization · **Readiness:** ready

**Source:** observation — 2026-10-18, production, live requests (email lower-cased and trimmed; both names trimmed when sent together)

**Isolation:** the account the test creates — deleted in teardown

**Tests:** `tests/app/api/add-user.spec.ts`

**Technique:** error guessing · **Covers:** CL-1 letter case and surrounding spaces in email and names

**Cases** (`input`):

- `a mixed-case email`
- `an email with surrounding spaces`
- `a first name with surrounding spaces`
- `a last name with surrounding spaces`

1. **WHEN** POST /users is sent with `<input>` and the other fields valid
2. **THEN** HTTP status is 201
3. **AND** the returned user holds the value in lower case and without the spaces

#### 2.2 POST /users with a password with surrounding spaces creates an account that logs in with the password exactly as sent

**ID:** UAPI-2.2 · **Tag:** `@api` · **Priority:** high · **Purpose:** conformance · **Readiness:** ready

**Source:** decision — user, 2026-10-18, the password is stored as sent, never trimmed; observation — 2026-10-18, production, live requests (trimmed when stored: login with the password as sent → 401)

**Isolation:** the account the test creates — deleted in teardown (deleted with the token of the 201)

**Tests:** `tests/app/api/add-user.spec.ts`

**Technique:** error guessing, comparison with an oracle · **Covers:** CL-1 surrounding spaces in the password · oracle `POST /users/login`

1. **WHEN** POST /users is sent with a password with surrounding spaces
2. **THEN** HTTP status is 201
3. **WHEN** POST /users/login is sent with the password exactly as sent
4. **THEN** HTTP status is 200

### 3. Email uniqueness

#### 3.1 POST /users with a registered email in <letter-case> returns 400 and keeps the existing account

**ID:** UAPI-3.1 · **Tag:** `@api` · **Priority:** high · **Purpose:** characterization · **Readiness:** ready

**Source:** observation — 2026-10-18, production, live requests (400 `{ "message": "Email address is already in use" }` for both cases; the existing account still logs in); decision — user, 2026-10-18, keep 400 for a registered email

**Isolation:** `createdUser` — the registered account, deleted in teardown; any 201 is deleted too

**Tests:** `tests/app/api/add-user.spec.ts`

**Technique:** decision table, state transition, error guessing, comparison with an oracle · **Covers:** DT-1 R2 · ST-1 `POST` on registered · CL-1 letter case, overwrite · oracle `POST /users/login`

**Cases** (`letter-case`):

- `the same letter case`
- `upper case`

1. **GIVEN** a registered user
2. **WHEN** POST /users is sent with their email in `<letter-case>` and new names and password
3. **THEN** HTTP status is 400
4. **AND** the message is "Email address is already in use"
5. **AND** the response body has the expected schema
6. **WHEN** POST /users/login is sent with the registered email and password
7. **THEN** HTTP status is 200
8. **AND** it returns the registered user's names

### 4. Field validation

#### 4.1 POST /users without "<field>" returns 400 and an error for that field

**ID:** UAPI-4.1 · **Tag:** `@api` · **Priority:** medium · **Purpose:** conformance · **Readiness:** ready

**Source:** decision — user, 2026-10-18, every field is required: a missing field answers 400 with an error reporting it as required; observation — 2026-10-18, production, live requests (`firstName`, `lastName`, `password`: as decided; `email`: 400 `{ "message": "Email address is already in use" }`, no `errors`)

**Isolation:** nothing created; any 201 is deleted in teardown

**Tests:** `tests/app/api/add-user.spec.ts`

**Technique:** domain testing, error guessing · **Covers:** PT-1 missing, per field · DT-1 R3 · CL-1 missing email

**Cases** (`field`):

- `firstName`
- `lastName`
- `email`
- `password`

1. **WHEN** POST /users is sent without `<field>` and the other fields valid
2. **THEN** HTTP status is 400
3. **AND** the error reports `<field>` as required, and no other field
4. **AND** the response body has the expected schema

#### 4.2 POST /users with an empty "<field>" returns 400 and an error for that field

**ID:** UAPI-4.2 · **Tag:** `@api` · **Priority:** medium · **Purpose:** characterization · **Readiness:** ready

**Source:** observation — 2026-10-18, production, live requests (400; `""` names and password reported as required, `""` email as "Email is invalid"); decision — user, 2026-10-18, empty values are a scenario of their own, apart from missing fields

**Isolation:** nothing created; any 201 is deleted in teardown

**Tests:** `tests/app/api/add-user.spec.ts`

**Technique:** domain testing (value partitions) · **Covers:** PT-1 `""` partition, per field · DT-1 R3

**Cases** (`field`):

- `firstName`
- `lastName`
- `email`
- `password`

1. **WHEN** POST /users is sent with `<field>` as an empty string and the other fields valid
2. **THEN** HTTP status is 400
3. **AND** the error reports `<field>` only: as required for a name or the password, as an invalid email for email
4. **AND** the response body has the expected schema

#### 4.3 POST /users with "<field>" as <value> returns 400 and an error for that field

**ID:** UAPI-4.3 · **Tag:** `@api` · **Priority:** medium · **Purpose:** characterization · **Readiness:** ready

**Source:** observation — 2026-10-18, production, live requests (400 for every case listed, with the reason recorded in PT-1); decision — user, 2026-10-18, the 21-case wrong-value matrix — its 4 empty-string cases are UAPI-4.2

**Isolation:** nothing created; any 201 is deleted in teardown

**Tests:** `tests/app/api/add-user.spec.ts`

**Technique:** domain testing (value and type partitions), error guessing · **Covers:** one PT-1 partition per case, per field, other than missing (UAPI-4.1) and `""` (UAPI-4.2) · DT-1 R3 · CL-1 array, operator object

**Cases** (`field`, `value`):

- `firstName` · `whitespace only`
- `firstName` · `null`
- `firstName` · `an array`
- `firstName` · `an operator object`
- `lastName` · `whitespace only`
- `lastName` · `null`
- `lastName` · `an array`
- `lastName` · `an operator object`
- `email` · `a number`
- `email` · `a boolean`
- `email` · `null`
- `email` · `an array`
- `email` · `an operator object`
- `password` · `a boolean`
- `password` · `null`
- `password` · `an array`
- `password` · `an operator object`

1. **WHEN** POST /users is sent with `<field>` as `<value>` and the other fields valid
2. **THEN** HTTP status is 400
3. **AND** the error reports `<field>` only, with the API's reason for this value: `<reason>`
4. **AND** the response body has the expected schema

`<reason>` follows from the case: required (a blank or null name, a null password), wrong type (an array or object), invalid email (an email that is a number, boolean or null), or too short (a boolean password).

#### 4.4 POST /users with "<field>" as <value> returns 201 and stores it as a string

**ID:** UAPI-4.4 · **Tag:** `@api` · **Priority:** medium · **Purpose:** characterization · **Readiness:** ready

**Source:** decision — user, 2026-10-18, keep the observed conversion; observation — 2026-10-18, production, live requests (201; names returned as `"123"` / `"true"`; password `12345678` accepted)

**Isolation:** the account the test creates — deleted in teardown

**Tests:** `tests/app/api/add-user.spec.ts`

**Technique:** domain testing (type partitions), error guessing · **Covers:** PT-1 number and boolean partitions the API converts · CL-1 number or boolean instead of a string

**Cases** (`field`, `value`):

- `firstName` · `a number`
- `firstName` · `a boolean`
- `lastName` · `a number`
- `lastName` · `a boolean`
- `password` · `an 8-digit number`

1. **WHEN** POST /users is sent with `<field>` as `<value>` and the other fields valid
2. **THEN** HTTP status is 201
3. **AND** the account holds the value as a string

For a name, step 3 checks the returned user; for the password, it logs in with it (`POST /users/login` returns 200).

#### 4.5 POST /users with an email <partition> returns 400 and an error for "email"

**ID:** UAPI-4.5 · **Tag:** `@api` · **Priority:** medium · **Purpose:** characterization · **Readiness:** ready

**Source:** observation — 2026-10-18, production, live requests (400 "Email is invalid", `kind: "user defined"`)

**Isolation:** nothing created; any 201 is deleted in teardown

**Tests:** `tests/app/api/add-user.spec.ts`

**Technique:** domain testing · **Covers:** one EF-1 partition per case · DT-1 R3

**Cases** (`partition`):

- `without "@"`
- `without a local part`
- `without a domain`
- `without a dot in the domain`
- `with a space in the local part`
- `with two "@"`

1. **WHEN** POST /users is sent with an email `<partition>` and the other fields valid
2. **THEN** HTTP status is 400
3. **AND** the error reports email only, as "Email is invalid"
4. **AND** the response body has the expected schema

### 5. Length boundaries

#### 5.1 POST /users with "<field>" at <boundary> returns 201

**ID:** UAPI-5.1 · **Tag:** `@api` · **Priority:** medium · **Purpose:** characterization · **Readiness:** ready

**Source:** observation — 2026-10-18, production, live requests (201 for every case; a 72-character password logs in with exactly those 72 characters; passwords of 80 and 100 characters were accepted too); decision — user, 2026-10-18, a 72-character password is accepted

**Isolation:** the account the test creates — deleted in teardown

**Tests:** `tests/app/api/add-user.spec.ts`

**Technique:** domain testing (BVA) · **Covers:** the valid side of every BT-1 border

**Cases** (`field`, `boundary`):

- `firstName` · `1 character`
- `firstName` · `20 characters`
- `lastName` · `1 character`
- `lastName` · `20 characters`
- `password` · `7 characters`
- `password` · `72 characters`
- `email` · `a 64-character local part`

1. **WHEN** POST /users is sent with `<field>` at `<boundary>` and the other fields valid
2. **THEN** HTTP status is 201
3. **AND** the account holds the sent value

For a name or the email, step 3 checks the returned user; for the password, it logs in with it (`POST /users/login` returns 200).

#### 5.2 POST /users with "<field>" at <boundary> returns 400 and an error for that field

**ID:** UAPI-5.2 · **Tag:** `@api` · **Priority:** medium · **Purpose:** characterization · **Readiness:** ready

**Source:** observation — 2026-10-18, production, live requests (400; names too long, password too short, email invalid)

**Isolation:** nothing created; any 201 is deleted in teardown

**Tests:** `tests/app/api/add-user.spec.ts`

**Technique:** domain testing (BVA) · **Covers:** the invalid side of the observed BT-1 borders (names and email upper, password lower)

**Cases** (`field`, `boundary`):

- `firstName` · `21 characters`
- `lastName` · `21 characters`
- `password` · `6 characters`
- `email` · `a 65-character local part`

1. **WHEN** POST /users is sent with `<field>` at `<boundary>` and the other fields valid
2. **THEN** HTTP status is 400
3. **AND** the error reports `<field>` only, as too long, too short or (for email) invalid
4. **AND** the response body has the expected schema

#### 5.3 POST /users with a 73-character password returns 400 and an error for "password"

**ID:** UAPI-5.3 · **Tag:** `@api` · **Priority:** high · **Purpose:** conformance · **Readiness:** ready

**Source:** decision — user, 2026-10-18, a password longer than 72 characters answers 400 with an error for `password`; observation — 2026-10-18, production, live requests (an 80-character password: 201, cut to its first 72 characters — the account logs in with them alone, or with any ending after them)

**Isolation:** nothing created; the 201 the live app answers today is deleted in teardown

**Tests:** `tests/app/api/add-user.spec.ts`

**Technique:** domain testing (BVA), error guessing · **Covers:** BT-1 password upper border, invalid side · CL-1 password longer than 72 characters

1. **WHEN** POST /users is sent with a 73-character password and the other fields valid
2. **THEN** HTTP status is 400
3. **AND** the error reports password only
4. **AND** the response body has the expected schema

### 6. Request body

#### 6.1 POST /users with an empty body returns 400 and an error for every field

**ID:** UAPI-6.1 · **Tag:** `@api` · **Priority:** low · **Purpose:** conformance · **Readiness:** ready

**Source:** decision — user, 2026-10-18, every field is required, so an empty body reports all four; observation — 2026-10-18, production, live requests (400; `errors` has `firstName`, `lastName`, `password` — not `email`)

**Isolation:** nothing created; any 201 is deleted in teardown

**Tests:** `tests/app/api/add-user.spec.ts`

**Technique:** error guessing · **Covers:** CL-1 empty body — stated purpose: several errors reported together

1. **WHEN** POST /users is sent with `{}`
2. **THEN** HTTP status is 400
3. **AND** the errors report firstName, lastName, email and password as required
4. **AND** the response body has the expected schema

#### 6.2 POST /users with a form-encoded body returns 400 and creates no account

**ID:** UAPI-6.2 · **Tag:** `@api` · **Priority:** low · **Purpose:** characterization · **Readiness:** ready

**Source:** observation — 2026-10-18, production, live requests (400, validation errors; no account)

**Isolation:** nothing created; any 201 is deleted in teardown

**Tests:** `tests/app/api/add-user.spec.ts`

**Technique:** error guessing, comparison with an oracle · **Covers:** CL-1 form-encoded body · oracle `POST /users/login`

1. **WHEN** POST /users is sent with a new user's details form-encoded
2. **THEN** HTTP status is 400
3. **AND** the response body has the expected schema
4. **WHEN** POST /users/login is sent with the sent email and password
5. **THEN** HTTP status is 401

#### 6.3 POST /users with an unknown extra field returns 201 and leaves it out of the user

**ID:** UAPI-6.3 · **Tag:** `@api` · **Priority:** low · **Purpose:** characterization · **Readiness:** ready

**Source:** observation — 2026-10-18, production, live requests (`role: "admin"` → 201, no `role` in the user)

**Isolation:** the account the test creates — deleted in teardown

**Tests:** `tests/app/api/add-user.spec.ts`

**Technique:** error guessing · **Covers:** CL-1 unknown extra field

1. **WHEN** POST /users is sent with valid details and an extra `role` field
2. **THEN** HTTP status is 201
3. **AND** the response body has the expected schema

### 7. Methods

#### 7.1 PUT /users returns 405

**ID:** UAPI-7.1 · **Tag:** `@api` · **Priority:** medium · **Purpose:** conformance · **Readiness:** ready

**Source:** decision — user, 2026-10-18, 405 (RFC 9110 §15.5.6), never 503; observation — 2026-10-18, production, live requests (503 after ~30 s)

**Isolation:** read-only; `test.slow()` — the live app hangs about 30 s before answering

**Tests:** `tests/app/api/add-user.spec.ts`

**Technique:** error guessing · **Covers:** CL-1 unsupported method

1. **WHEN** PUT /users is sent
2. **THEN** HTTP status is 405

## Why tests currently fail

| Behaviour of the live app                                                                                                               | Failing lines                                                                                                                                                                                                | Scenarios                         | Defect                               |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------ |
| A missing email is not reported as required: 400 `{ "message": "Email address is already in use" }`; an empty body lists no email error | UAPI-4.1: AND the error reports `email` as required, and no other field · AND the response body has the expected schema; UAPI-6.1: AND the errors report firstName, lastName, email and password as required | UAPI-4.1 (`email` case), UAPI-6.1 | AGE-11 — filed in Linear, 2026-10-19 |
| The password is trimmed when stored, so the password exactly as sent does not log in (401)                                              | THEN HTTP status is 200 (after the login)                                                                                                                                                                    | UAPI-2.2                          | AGE-12 — filed in Linear, 2026-10-19 |
| A password longer than 72 characters is accepted (201) and cut to its first 72 characters                                               | THEN HTTP status is 400 · AND the error reports password only · AND the response body has the expected schema                                                                                                | UAPI-5.3                          | AGE-13 — filed in Linear, 2026-10-19 |
| `PUT /users` hangs ~30 s and ends with Heroku's 503 page instead of 405                                                                 | THEN HTTP status is 405                                                                                                                                                                                      | UAPI-7.1                          | AGE-14 — filed in Linear, 2026-10-19 |

## Skipped tests

| Scenarios | Kind | Defect or reason |
| --------- | ---- | ---------------- |

## Not covered here

- Malformed JSON (observed: 400, HTML page) — `apiRequest` sends only valid JSON; a raw-body request would need a new option in the shared fixture (as in the login API plan).
- The cookie the 201 response sets — a UI session concern.
- `GET /users` (observed: 200 with the web app's "404" page) — answered by the web app, not the API; `PATCH` and `DELETE /users` — `PUT` represents the unsupported methods (all three observed hanging).
- An `Authorization` header on `POST /users` — not required (observed); the collection's example sends one without saying why.
- Registering an email again after `DELETE /users/me` — the `/users/me` ticket.
- Whole-email length limits beyond the local part, and non-ASCII names — not observed.
- The UI sign-up form (`/addUser`) — a UI plan.
- What a request without email does on an empty database — not observable on the shared database.
