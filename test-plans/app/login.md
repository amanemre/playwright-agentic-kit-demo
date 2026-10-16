# Login — Test Plan

<!-- plan-contract: 1 -->

|                 |                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Feature**     | The login page of the Contact List App (`/`): logging in, rejected credentials, the session it starts, the sign-up entry point |
| **Spec**        | `tests/app/functional/login.spec.ts`                                                                                           |
| **Explored**    | `playwright-cli` (login page, `/contactList`, `/addUser`, `login.js`, `contactList.js`); Postman collection; live requests     |
| **Explored on** | 2026-10-16                                                                                                                     |

## Expected behaviour and its sources

- Submitting the form posts `{ email, password }` to `POST /users/login`; any non-200 answer shows "Incorrect username or password" and the page stays on `/`; a 200 answer redirects to `/contactList` — observation, 2026-10-16, production, `login.js`.
- A successful login sets a `token` cookie; `/contactList` loads the user's contacts with it (`GET /contacts`) — observation, 2026-10-16, production, `contactList.js` and the cookie list.
- After "Logout" the old token is rejected (`GET /contacts` → 401) and `/contactList` renders no contact table — observation, 2026-10-16, production.
- The form has no client-side validation: no `required`, no `type="email"`, no `maxlength` — empty and malformed values reach the server — observation, 2026-10-16, production, the form's HTML.
- "Sign up" opens `/addUser` with the heading "Add User" — observation, 2026-10-16, production, `onclick` and snapshot.
- `POST /users/login` documents only a 200 answer; no rule on email format, letter case or whitespace is documented — Postman collection `4012288/TzK2bEa8`.
- Observed but not documented: the email is matched without letter case and with surrounding spaces trimmed; the password is matched exactly (other letter case or surrounding spaces → 401) — observation, 2026-10-16, production, live requests.

## Starting state (every scenario)

- Each test creates its own account through `POST /users` with Faker data (a `createdUser` helper fixture) and deletes it in teardown through `DELETE /users/me`. Scenarios that check the session's data also add one contact to that account through `POST /contacts`.
- No test uses the shared account in `env/.env.*`; the credentials typed into the UI belong to the test's own throwaway account (INV-04).

## Test design

Designed with the `test-design` skill — techniques from ISTQB CTAL-TA v4.0 and CTFL v4.0.1.

**Test basis:** the live UI and its client scripts, explored with `playwright-cli` on 2026-10-16; the Postman collection for `POST /users`, `POST /users/login`, `POST /contacts`, `DELETE /users/me`; live requests to `POST /users/login` for undocumented behaviour (characterization).

### Product risks

| Risk item                      | Likelihood (why)                                 | Impact (why)                                               | Level  | Depth, tag                             | Source                      |
| ------------------------------ | ------------------------------------------------ | ---------------------------------------------------------- | ------ | -------------------------------------- | --------------------------- |
| Logging in with an account     | low — page and script unchanged since 2021       | high — every other feature sits behind it                  | high   | main path `@smoke`, all DT rules       | decision — user, 2026-10-16 |
| Rejecting wrong credentials    | low — one server check, one client branch        | high — a wrong acceptance opens someone else's contacts    | high   | every invalid partition, `@regression` | decision — user, 2026-10-16 |
| Ending the session on logout   | low — server invalidates the token               | medium — a shared computer would keep showing the contacts | medium | every valid transition, `@regression`  | decision — user, 2026-10-16 |
| Sign-up entry point, Enter key | low — a plain `onclick` and a native form submit | low — the URL and the button still work                    | low    | checklist only, `@regression`          | decision — user, 2026-10-16 |

### Technique evaluation

| Technique                  | Status  | Model or reason                                                                               |
| -------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| Domain testing (EP + BVA)  | Applied | partitions below; BVA N/A — no length or range in the docs or the DOM                         |
| Combinatorial testing      | N/A     | two inputs — the decision table is already exhaustive                                         |
| Decision table             | Applied | DT-1: email registered × password correct                                                     |
| State transition           | Applied | ST-1: anonymous → logged in → anonymous                                                       |
| Scenario-based testing     | N/A     | single-page scope; sign-up and contact management are their own features                      |
| CRUD testing               | N/A     | the login page creates or changes no entity (the account and contact are setup data)          |
| Checklist / error guessing | Applied | CL-1 below                                                                                    |
| Comparison with an oracle  | N/A     | the page shows no data to compare; the session's effect is checked through the seeded contact |

### Models

**Partitions** (basis: the form's HTML and `login.js`, explored 2026-10-16)

| Input    | Valid                  | Invalid                      |
| -------- | ---------------------- | ---------------------------- |
| email    | V1 registered          | I1 empty · I3 not registered |
| password | V2 matches the account | I4 empty · I5 does not match |

A malformed email (I2 in the kit's login example) is not a separate partition here: the form has no `type="email"` check, so a malformed email reaches the server as one more unregistered email (I3).

**DT-1**

| Condition / action                  | R1  | R2  | R3  |
| ----------------------------------- | --- | --- | --- |
| Email registered                    | Y   | Y   | N   |
| Password correct                    | Y   | N   | –   |
| → Contact list with the user's data | ✓   |     |     |
| → "Incorrect username or password"  |     | ✓   | ✓   |

R3 merges N/Y and N/N: with an unregistered email the password cannot change the outcome. Checksum: 1 + 1 + 2 = 4 = the full table's feasible rules.

**ST-1**

| #   | From      | Event               | Guard               | To        | Observable result                |
| --- | --------- | ------------------- | ------------------- | --------- | -------------------------------- |
| t1  | anonymous | submit login        | credentials valid   | logged in | the user's contact is listed     |
| t2  | anonymous | submit login        | credentials invalid | anonymous | "Incorrect username or password" |
| t3  | logged in | Logout              | —                   | anonymous | the login form                   |
| t4  | anonymous | open `/contactList` | after logout        | anonymous | the user's contact is not listed |

**CL-1** (error guessing)

| Item                                           | Expected result and its basis                                                     |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| Enter in the password field instead of a click | logs in — a native `<form>` submit, `login.js` listens to it                      |
| "Sign up" button                               | opens "Add User" — the button's `onclick`                                         |
| Email in other letter case / with spaces       | characterization — undocumented; observed: accepted (decision — user, 2026-10-16) |
| Password in other letter case                  | characterization — undocumented; observed: rejected (decision — user, 2026-10-16) |

## Scenarios

### 1. Logging in

#### 1.1 a registered user logs in and sees their own contacts

**ID:** LOGIN-1.1 · **Tag:** `@smoke` · **Priority:** high · **Purpose:** conformance · **Readiness:** ready

**Source:** observation — 2026-10-16, production, `login.js` redirect and `contactList.js` loading the user's contacts

**Isolation:** creates an account and one contact through the API; the contact and the account are deleted in teardown

**Tests:** `tests/app/functional/login.spec.ts`

**Technique:** domain testing, decision table, state transition · **Covers:** EP V1+V2 · DT R1 · ST t1

1. **GIVEN** a registered user with one contact
2. **WHEN** they log in with their email and password
3. **THEN** their contact is listed

#### 1.2 logging in with a pressed Enter key instead of the Submit button works

**ID:** LOGIN-1.2 · **Tag:** `@regression` · **Priority:** low · **Purpose:** conformance · **Readiness:** ready

**Source:** observation — 2026-10-16, production, `login.js` listens to the form's `submit` event

**Isolation:** creates an account and one contact through the API; the contact and the account are deleted in teardown

**Tests:** `tests/app/functional/login.spec.ts`

**Technique:** error guessing · **Covers:** CL-1 Enter key

1. **GIVEN** a registered user with one contact
2. **WHEN** they enter their email and password and press Enter
3. **THEN** their contact is listed

### 2. Rejected credentials

#### 2.1 logging in with <partition> is rejected

**ID:** LOGIN-2.1 · **Tag:** `@regression` · **Priority:** high · **Purpose:** conformance · **Readiness:** ready

**Source:** observation — 2026-10-16, production, `login.js` error branch and live requests (401 for each case)

**Isolation:** creates an account through the API; deleted in teardown

**Tests:** `tests/app/functional/login.spec.ts`

**Technique:** domain testing, decision table, state transition · **Covers:** one invalid partition per case · DT R2, R3 · ST t2

**Cases** (`partition`):

- `a wrong password` — EP I5 · DT R2
- `an unregistered email` — EP I3 · DT R3
- `an empty email` — EP I1
- `an empty password` — EP I4

1. **GIVEN** a registered user
2. **WHEN** they log in with `<partition>` and the other field valid
3. **THEN** "Incorrect username or password" is shown
4. **AND** the login form is still shown

### 3. Session

#### 3.1 after logging out the user's contacts are no longer shown

**ID:** LOGIN-3.1 · **Tag:** `@regression` · **Priority:** medium · **Purpose:** conformance · **Readiness:** ready

**Source:** observation — 2026-10-16, production, logout and `GET /contacts` → 401 with the old token

**Isolation:** creates an account and one contact through the API; the contact and the account are deleted in teardown

**Tests:** `tests/app/functional/login.spec.ts`

**Technique:** state transition · **Covers:** ST t3, t4

1. **GIVEN** a registered user with one contact is logged in
2. **WHEN** they log out
3. **THEN** the login form is shown
4. **WHEN** they open the contact list again
5. **THEN** their contact is not listed

### 4. Checklist

#### 4.1 the Sign up button opens the add user page

**ID:** LOGIN-4.1 · **Tag:** `@regression` · **Priority:** low · **Purpose:** conformance · **Readiness:** ready

**Source:** observation — 2026-10-16, production, the button's `onclick` and the `/addUser` snapshot

**Isolation:** read-only

**Tests:** `tests/app/functional/login.spec.ts`

**Technique:** error guessing · **Covers:** CL-1 Sign up

1. **GIVEN** the login page is open
2. **WHEN** the user clicks "Sign up"
3. **THEN** the "Add User" heading is shown

#### 4.2 an email in other letter case or with surrounding spaces still logs in

**ID:** LOGIN-4.2 · **Tag:** `@regression` · **Priority:** low · **Purpose:** characterization · **Readiness:** ready

**Source:** observation — 2026-10-16, production, live requests (200 for both); kept as characterization — decision — user, 2026-10-16

**Isolation:** creates an account and one contact through the API; deleted in teardown

**Tests:** `tests/app/functional/login.spec.ts`

**Technique:** error guessing · **Covers:** CL-1 email letter case and spaces

1. **GIVEN** a registered user with one contact
2. **WHEN** they log in with their email in capitals and surrounded by spaces
3. **THEN** their contact is listed

#### 4.3 a password in other letter case is rejected

**ID:** LOGIN-4.3 · **Tag:** `@regression` · **Priority:** medium · **Purpose:** characterization · **Readiness:** ready

**Source:** observation — 2026-10-16, production, live requests (401); kept as characterization — decision — user, 2026-10-16

**Isolation:** creates an account through the API; deleted in teardown

**Tests:** `tests/app/functional/login.spec.ts`

**Technique:** error guessing · **Covers:** CL-1 password letter case

1. **GIVEN** a registered user
2. **WHEN** they log in with their password in capitals
3. **THEN** "Incorrect username or password" is shown

## Why tests currently fail

None.

## Skipped tests

None.

## Not covered here

- `POST /users/login` status codes and response schema — an API spec with its own plan.
- Signing up, contact management and the contact details page — their own features.
- Password length or strength — no rule in the docs or the DOM.
