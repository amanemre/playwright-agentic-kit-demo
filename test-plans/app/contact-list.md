# Contact List — Test Plan

<!-- plan-contract: 1 -->

|                 |                                                                                                                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Feature**     | The Contact List page (`/contactList`): the logged-in user's contacts in a table, opening a contact's details, adding a contact, access without a session                                                                   |
| **Spec**        | `tests/app/e2e/contact-list.spec.ts`                                                                                                                                                                                        |
| **Explored**    | `playwright-cli` (`/contactList` with 0, 1 and 3 contacts and without a session, `/contactDetails`, `/addContact` with and without a session, logout); `contactList.js`, `addContact.js`; Postman collection; live requests |
| **Explored on** | 2026-10-17, 2026-10-18                                                                                                                                                                                                      |

## Expected behaviour and its sources

- The page has the heading "Contact List", the text "Click on any contact to view the Contact Details", the buttons "Add a New Contact" and "Logout", and a contact table with the columns Name, Birthdate, Email, Phone, Address, City/State/Province/Postal Code, Country; the table can be empty, hold one contact or several — requirement — AGE-6, page overview.
- The page loads the user's contacts and, only after they load, builds the table (the column headings) with one row per contact — observation, 2026-10-17, production, `contactList.js`.
- Cell contents: Name = `firstName lastName`; Birthdate, Email, Phone, Country = the field as entered; Address = `street1 street2`; "City, State/Province, Postal Code" = `city stateProvince postalCode`, joined by single spaces; a field the contact does not have leaves its cell or its part blank — observation, 2026-10-17, production, `contactList.js` and the rendered rows.
- The live column heading is "City, State/Province, Postal Code" (the ticket writes "City/State/Province/Postal Code") — observation, 2026-10-17, production, snapshot. The tests use the live text.
- With no contacts the table shows only its column headings — observation, 2026-10-17, production, a new account.
- No order of the rows is stated anywhere, and the observed order is neither by name nor by creation time — observation, 2026-10-17, production. The tests find each contact's row by its name and do not depend on the order.
- A user sees only their own contacts — decision — user, 2026-10-18 (privacy test requested); observation, 2026-10-17, production, every listed contact carried the account's `owner`.
- Clicking a contact's row opens `/contactDetails`, which shows that contact ("First Name: …", "Last Name: …") — requirement — AGE-6 ("navigate to contact details"); observation, 2026-10-17, production, `contactList.js` and snapshot.
- "Add a New Contact" opens `/addContact` ("Add Contact"); submitting the form returns to `/contactList`; "Cancel" returns to `/contactList` without adding — requirement — AGE-6 ("add new contacts"); observation, 2026-10-17, production, `addContact.js` and the Cancel button.
- "Logout" ends on the login page and ends the session — requirement — AGE-6 ("log out"); observation, 2026-10-17, production.
- Opening `/contactList` without a session redirects to the login page — decision — user, 2026-10-18 (from experience of other apps; a visitor who is not logged in can otherwise reach "Add Contact" and only gets an error on Submit). Observed instead: no redirect — the page shows its heading and buttons but no table; "Add a New Contact" opens the form, and Submit shows the error "undefined" — observation, 2026-10-18, production.

## Starting state (every scenario)

- Each test creates its own account through the `createdUser` helper fixture (deleted in teardown).
- Contacts are created in the GIVEN step through `POST /contacts` with the account's token — with Faker data, either every field filled or the two name fields only. The privacy scenario also creates a second account with one contact through `POST /users` and `POST /contacts`.
- An `afterEach` hook deletes every contact of the test's account — including one added through the form — before `createdUser` deletes the account; it also deletes the privacy scenario's second account and its contact.
- These API calls are setup and cleanup only: they check the status they rely on, and no test checks the UI against an API answer.
- No test uses the shared account in `env/.env.*` (INV-04).

## Test design

Designed with the `test-design` skill — techniques from ISTQB CTAL-TA v4.0 and CTFL v4.0.1.

**Test basis:** AGE-6 (page overview, three table states); the user's decisions of 2026-10-18 (risk levels, redirect without a session, privacy); the live UI and its client scripts, explored with `playwright-cli` on 2026-10-17 and 2026-10-18; the Postman collection for `POST /contacts`. AGE-6 has no acceptance criteria and states no cell formats, so those expectations are observed (characterization).

### Product risks

| Risk item                                       | Likelihood (why)                            | Impact (why)                                                                                   | Level  | Depth, tag                                                                           | Source                                   |
| ----------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ | ---------------------------------------- |
| Showing the user's contacts with the right data | low — `contactList.js` unchanged since 2021 | high — the page's purpose; a wrong column misleads every user                                  | high   | 0 / 1 / many, every column; `@smoke` main path; a mutation per check                 | decision — user, 2026-10-18              |
| Opening the clicked contact's details           | low — one click handler per row             | high — the details page is the only way to edit or delete a contact                            | high   | the transition from a row that is not the first; a mutation per check, `@regression` | decision — user, 2026-10-18              |
| Adding a contact from the list                  | low — plain form and one `POST`             | high — the main way contacts get in                                                            | high   | main scenario and the Cancel alternative, `@e2e`; a mutation per check               | decision — user, 2026-10-18              |
| Showing only the user's own contacts            | low — the server filters by owner           | high — another person's private data would be exposed                                          | high   | one scenario, `@regression`; a mutation per check                                    | decision — user, 2026-10-18              |
| The page without a session                      | high — observed: no redirect today          | medium — the visitor sees a broken page and gets an "undefined" error on Add; no data is shown | medium | one scenario, `@regression`                                                          | decision — user, 2026-10-18              |
| Ending the session on logout                    | low — server invalidates the token          | medium — a shared computer keeps the contacts                                                  | medium | already covered by LOGIN-3.1                                                         | decision — user, 2026-10-16 (login plan) |

### Technique evaluation

| Technique                  | Status  | Model or reason                                                                                                    |
| -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| Domain testing (EP + BVA)  | Applied | D-1 (number of contacts: 0 / 1 / many, borders 0–1 and 1–2), D-2 (optional fields: all set / names only)           |
| Combinatorial testing      | N/A     | each column shows its own field; no output depends on a combination of fields                                      |
| Decision table             | N/A     | no outcome on the page depends on combined conditions                                                              |
| State transition           | Applied | ST-1: transitions into and out of the contact list                                                                 |
| Scenario-based testing     | Applied | SC-1: add a contact from the list — main scenario and the Cancel alternative                                       |
| CRUD testing               | Applied | Create (form) → Read (list) in SC-1; Update and Delete live on the details and edit pages — see "Not covered here" |
| Checklist / error guessing | Applied | CL-1 below                                                                                                         |
| Comparison with an oracle  | Applied | O-1: each row against the contact data the test created                                                            |

### Models

**D-1 — number of contacts** (basis: AGE-6 "three states"; `contactList.js` adds one row per contact)

| Partition | Representative | Border covered                       | Observable result |
| --------- | -------------- | ------------------------------------ | ----------------- |
| empty     | 0              | 0–1 (below)                          | headings, no row  |
| single    | 1              | 0–1 (above), 1–many (below)          | one row           |
| multiple  | 2              | 1–many (above) — the smallest "many" | two rows          |

No upper limit is stated or observable; the representative of "multiple" is its lower border.

**D-2 — optional fields of a contact** (basis: Postman `POST /contacts`; `contactList.js` leaves a missing field blank)

| Partition                     | Expected row                           |
| ----------------------------- | -------------------------------------- |
| every field set               | every column filled per O-1            |
| only `firstName` / `lastName` | Name filled; the other six cells empty |

**ST-1 — into and out of the contact list** (basis: AGE-6; the buttons' `onclick`, the row click handler; the user's decision on access without a session)

| #   | From         | Event                 | To              | Observable result                     | Scenario             |
| --- | ------------ | --------------------- | --------------- | ------------------------------------- | -------------------- |
| t1  | contact list | click a contact's row | contact details | that contact's first and last name    | CLIST-2.1            |
| t2  | contact list | "Add a New Contact"   | add contact     | the add contact form                  | CLIST-3.1, CLIST-3.2 |
| t3  | add contact  | submit a valid form   | contact list    | the new contact's row                 | CLIST-3.1            |
| t4  | add contact  | "Cancel"              | contact list    | the column headings, no contact row   | CLIST-3.2            |
| t5  | contact list | "Logout"              | login           | the login form; the contacts are gone | LOGIN-3.1            |
| t6  | no session   | open `/contactList`   | login           | the login form                        | CLIST-4.1            |

**SC-1 — add a contact from the list** (basis: AGE-6 "add new contacts"; `addContact.js`)

- Main scenario: the user is on the contact list → clicks "Add a New Contact" → fills every field → submits → is back on the contact list, where the new contact's row shows what was entered.
- Alternative: the user fills the form and clicks "Cancel" → is back on the contact list, and no contact was added.
- Exceptions (a rejected form) belong to the Add Contact page's own rules — see "Not covered here".

**O-1 — oracle: the contact data the test created** (basis: `contactList.js`, the rendered rows)

| Column                            | Expected text                   |
| --------------------------------- | ------------------------------- |
| Name                              | `firstName lastName`            |
| Birthdate                         | `birthdate`                     |
| Email                             | `email`                         |
| Phone                             | `phone`                         |
| Address                           | `street1 street2`               |
| City, State/Province, Postal Code | `city stateProvince postalCode` |
| Country                           | `country`                       |

**CL-1** (error guessing)

| Item                                                           | Expected result and its basis                                         |
| -------------------------------------------------------------- | --------------------------------------------------------------------- |
| Clicking a row other than the first opens that row's contact   | its own details — the handler stores that row's id (`contactList.js`) |
| A contact with only names renders blank cells, not "undefined" | blank — `contactList.js` writes a field only when it is set (D-2)     |
| Another user's contacts on this user's list                    | not shown — decision — user, 2026-10-18                               |

## Scenarios

### 1. The contact table

#### 1.1 a user with one contact sees all of its fields in the table

**ID:** CLIST-1.1 · **Tag:** `@smoke` · **Priority:** high · **Purpose:** characterization · **Readiness:** ready

**Source:** requirement — AGE-6, page overview (columns, single contact); observation — 2026-10-17, production, `contactList.js` cell formats

**Isolation:** creates an account and one contact through the API; the contact and the account are deleted after the test

**Tests:** `tests/app/e2e/contact-list.spec.ts`

**Technique:** domain testing, comparison with an oracle · **Covers:** D-1 single · D-2 every field set · O-1 all columns

1. **GIVEN** a user with one contact that has every field filled
2. **WHEN** they open the contact list
3. **THEN** one contact row is shown
4. **AND** the row shows each of the contact's fields in its column

#### 1.2 a user with no contacts sees only the column headings

**ID:** CLIST-1.2 · **Tag:** `@regression` · **Priority:** high · **Purpose:** characterization · **Readiness:** ready

**Source:** requirement — AGE-6, "Empty (no contacts)"; observation — 2026-10-17, production, a new account (the headings appear only after the contacts load)

**Isolation:** creates an account through the API; deleted after the test

**Tests:** `tests/app/e2e/contact-list.spec.ts`

**Technique:** domain testing · **Covers:** D-1 empty

1. **GIVEN** a user with no contacts
2. **WHEN** they open the contact list
3. **THEN** the table's column headings are shown
4. **AND** no contact row is shown

#### 1.3 a user with two contacts sees both of them with their own values

**ID:** CLIST-1.3 · **Tag:** `@regression` · **Priority:** high · **Purpose:** characterization · **Readiness:** ready

**Source:** requirement — AGE-6, "Multiple contacts"; observation — 2026-10-17, production, one row per contact, blank cells for missing fields

**Isolation:** creates an account and two contacts through the API; the contacts and the account are deleted after the test

**Tests:** `tests/app/e2e/contact-list.spec.ts`

**Technique:** domain testing, comparison with an oracle, error guessing · **Covers:** D-1 multiple · D-2 every field set, names only · O-1 all columns · CL-1 blank cells

1. **GIVEN** a user who has added two contacts, one with every field filled and one with only a name
2. **WHEN** they open the contact list
3. **THEN** two contact rows are shown
4. **AND** the contact with every field shows each of its fields in its column
5. **AND** the contact with only a name shows its name and empty cells in the other columns

#### 1.4 a user does not see another user's contacts

**ID:** CLIST-1.4 · **Tag:** `@regression` · **Priority:** high · **Purpose:** conformance · **Readiness:** ready

**Source:** decision — user, 2026-10-18, privacy test requested

**Isolation:** creates two accounts with one contact each through the API; both contacts and both accounts are deleted after the test

**Tests:** `tests/app/e2e/contact-list.spec.ts`

**Technique:** error guessing · **Covers:** CL-1 another user's contacts

1. **GIVEN** a user with one contact, and another user with a contact of their own
2. **WHEN** the first user opens the contact list
3. **THEN** one contact row is shown
4. **AND** the row is the user's own contact
5. **AND** the other user's contact is not listed

### 2. Contact details

#### 2.1 clicking a contact opens that contact's details

**ID:** CLIST-2.1 · **Tag:** `@regression` · **Priority:** high · **Purpose:** characterization · **Readiness:** ready

**Source:** requirement — AGE-6, "Click on any contact to view the Contact Details"; observation — 2026-10-17, production, row click → `/contactDetails`

**Isolation:** creates an account and two contacts through the API; the contacts and the account are deleted after the test

**Tests:** `tests/app/e2e/contact-list.spec.ts`

**Technique:** state transition, error guessing · **Covers:** ST-1 t1 · CL-1 a row other than the first

1. **GIVEN** a user with two contacts is on the contact list
2. **WHEN** they click the second contact's row
3. **THEN** the details show that contact's first name
4. **AND** the details show that contact's last name

### 3. Adding a contact

#### 3.1 a contact added through the form appears in the contact list

**ID:** CLIST-3.1 · **Tag:** `@e2e` · **Priority:** high · **Purpose:** characterization · **Readiness:** ready

**Source:** requirement — AGE-6, "add new contacts"; observation — 2026-10-17, production, `addContact.js` (success → `/contactList`)

**Isolation:** creates an account through the API and a contact through the form; the contact and the account are deleted after the test

**Tests:** `tests/app/e2e/contact-list.spec.ts`

**Technique:** scenario-based testing, state transition, CRUD testing · **Covers:** SC-1 main scenario · ST-1 t2, t3 · CRUD C → R

1. **GIVEN** a user with no contacts is on the contact list
2. **WHEN** they click "Add a New Contact"
3. **THEN** the add contact form is shown
4. **WHEN** they fill in every field and submit
5. **THEN** one contact row is shown
6. **AND** the row shows each of the new contact's fields in its column

#### 3.2 cancelling the add contact form adds no contact

**ID:** CLIST-3.2 · **Tag:** `@e2e` · **Priority:** high · **Purpose:** characterization · **Readiness:** ready

**Source:** observation — 2026-10-17, production, "Cancel" returns to `/contactList`; depth from the high risk of adding a contact — decision — user, 2026-10-18

**Isolation:** creates an account through the API; deleted after the test

**Tests:** `tests/app/e2e/contact-list.spec.ts`

**Technique:** scenario-based testing, state transition · **Covers:** SC-1 Cancel alternative · ST-1 t2, t4

1. **GIVEN** a user with no contacts is on the contact list
2. **WHEN** they click "Add a New Contact", fill in a name and click "Cancel"
3. **THEN** the table's column headings are shown
4. **AND** no contact row is shown

### 4. Access without a session

#### 4.1 opening the contact list without logging in shows the login page

**ID:** CLIST-4.1 · **Tag:** `@regression` · **Priority:** medium · **Purpose:** conformance · **Readiness:** ready

**Source:** decision — user, 2026-10-18 (a visitor without a session is redirected to the login page)

**Isolation:** read-only

**Tests:** `tests/app/e2e/contact-list.spec.ts`

**Technique:** state transition · **Covers:** ST-1 t6

1. **GIVEN** a visitor who is not logged in
2. **WHEN** they open the contact list
3. **THEN** the login form is shown

## Why tests currently fail

| Behaviour of the live app                                                                                         | Failing lines                | Scenarios | Defect |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------- | --------- | ------ |
| `/contactList` without a session is not redirected: it shows the heading and buttons, no table, and no login form | THEN the login form is shown | CLIST-4.1 | AGE-7  |

## Skipped tests

None.

## Not covered here

- Logging out from the contact list (ST-1 t5) — covered by LOGIN-3.1 in `test-plans/app/login.md`, which logs out from this page and checks the contacts are gone.
- The Add Contact form's own rules (required fields, formats, error messages such as the "undefined" error without a session), the details page's Edit / Delete / Return, and the edit page — their own features and plans.
- `GET /contacts` and `POST /contacts` status codes and response schemas — API specs with their own plan.
- The order of the rows — no source states one.
- Very long lists (no limit or paging is stated or observable).
