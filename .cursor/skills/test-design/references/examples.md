# Test design — worked examples

Four designs for the fictional **Example Shop**, written as they appear in a plan's Test design section. Each starts from a stated test basis; the constraints are the example's premise, not facts about any real application — in real work every value comes from the requirements, the API contract or exploration with the approved tool.

## Example 1: Login form — domain testing, decision table, state transition, error guessing

**Test basis (premise).** Ticket: "Registered users log in with email and password. Wrong credentials show 'Your email or password is incorrect.' Empty fields are blocked by the browser." Exploration: both inputs are `required`, the email input is `type=email`, no `maxlength`. The account the tests log in with comes from the profile's "Authentication and accounts" section.

**Product risks**

| Risk item             | Likelihood (why)           | Impact (why)                               | Level | Depth, tag                       | Source                   |
| --------------------- | -------------------------- | ------------------------------------------ | ----- | -------------------------------- | ------------------------ |
| Login with an account | low — unchanged for months | high — nothing works for a user without it | high  | main path `@smoke`, all DT rules | decision — <who>, <date> |

**Technique evaluation**

| Technique                  | Status  | Model or reason                                                        |
| -------------------------- | ------- | ---------------------------------------------------------------------- |
| Domain testing (EP + BVA)  | Applied | partitions below; BVA N/A — no length or range in the basis or the DOM |
| Combinatorial testing      | N/A     | two conditions — the decision table is already exhaustive              |
| Decision table             | Applied | DT-1: email registered × password correct                              |
| State transition           | Applied | ST-1: anonymous → logged in → anonymous                                |
| Scenario-based testing     | N/A     | single-page scope; login is a step of the checkout journey             |
| CRUD testing               | N/A     | no entity is created or changed                                        |
| Checklist / error guessing | Applied | trailing whitespace in the email; email in capitals; double submit     |
| Comparison with an oracle  | N/A     | no displayed data to compare                                           |

**Partitions**

| Input    | Valid                      | Invalid                                                                      |
| -------- | -------------------------- | ---------------------------------------------------------------------------- |
| email    | V1 registered, well-formed | I1 empty · I2 malformed (the browser's `type=email` check) · I3 unregistered |
| password | V2 matches the account     | I4 empty · I5 does not match                                                 |

**DT-1**

| Condition / action                 | R1  | R2  | R3  |
| ---------------------------------- | --- | --- | --- |
| Email registered                   | Y   | Y   | N   |
| Password correct                   | Y   | N   | –   |
| → Logged in                        | ✓   |     |     |
| → "email or password is incorrect" |     | ✓   | ✓   |

R3 merges N/Y and N/N: with an unregistered email the password cannot change the outcome. Checksum: 1 + 1 + 2 = 4 = the full table's feasible rules.

**ST-1**

| From      | Event        | Guard               | To        | Observable result                 |
| --------- | ------------ | ------------------- | --------- | --------------------------------- |
| anonymous | submit login | credentials valid   | logged in | "Logged in as" in the header      |
| anonymous | submit login | credentials invalid | anonymous | the incorrect-credentials message |
| logged in | log out      | —                   | anonymous | the login link                    |
| anonymous | browser back | after logout        | anonymous | account pages not shown           |

**Scenarios**

| ID        | Test title                                                              | Technique · Covers                       | Tag           |
| --------- | ----------------------------------------------------------------------- | ---------------------------------------- | ------------- |
| LOGIN-1.1 | registered user can log in with their email and password                | EP V1+V2 · DT R1 · ST t1                 | `@smoke`      |
| LOGIN-1.2 | a wrong password for a registered email is rejected                     | EP I5 · DT R2 · ST t2                    | `@regression` |
| LOGIN-1.3 | an unregistered email is rejected                                       | EP I3 · DT R3                            | `@regression` |
| LOGIN-1.4 | an empty email is blocked by the browser                                | EP I1                                    | `@regression` |
| LOGIN-1.5 | a malformed email "`<email>`" (`<partition>`) is blocked by the browser | EP I2 — one representative per partition | `@regression` |
| LOGIN-1.6 | an empty password is blocked by the browser                             | EP I4                                    | `@regression` |
| LOGIN-1.7 | after logging out, browser back does not show the account again         | ST t3, t4                                | `@regression` |

**Unknowns:** whether the email is trimmed or matched without case — the ticket does not say. Asked before planning those scenarios; no expectation is assumed.

## Example 2: Cart quantity and lifecycle — domain testing, state transition, risk

**Test basis (premise).** Ticket: "Quantity on the product page accepts whole numbers 1–99. Out-of-range values show 'Quantity must be between 1 and 99'. Checkout requires login and a non-empty cart."

**Product risks:** cart total — likelihood medium (pricing rules changed this release), impact high (every order, money) → **high**: the user is offered 3-value boundaries for quantity, at the cost of two more tests.

**Domain testing.** Integer step 1; closed borders at 1 and 99.

| Border | 2-value (default) | 3-value (high risk) | Expected                             |
| ------ | ----------------- | ------------------- | ------------------------------------ |
| lower  | 0, 1              | 0, 1, 2             | 0 → range message · 1, 2 → added     |
| upper  | 99, 100           | 98, 99, 100         | 98, 99 → added · 100 → range message |

Further invalid partitions: not a number, a decimal (`1.5`). A negative number falls in the "below the lower border" partition already tested by 0 — one test, not two.

**ST-1 — cart lifecycle**

| From      | Event                     | Guard          | To        | Observable result                   |
| --------- | ------------------------- | -------------- | --------- | ----------------------------------- |
| empty     | add product               | quantity valid | has items | the cart count shows the quantity   |
| has items | remove the last item      | —              | empty     | the empty-cart message              |
| has items | proceed to checkout       | logged in      | checkout  | address and review shown            |
| has items | proceed to checkout       | anonymous      | has items | the register / login prompt         |
| checkout  | place the order           | payment valid  | ordered   | the order confirmation              |
| empty     | open `/checkout` directly | —              | empty     | redirect, or the empty-cart message |
| ordered   | browser back              | —              | ordered   | no second order is created          |

All seven transitions are covered: five valid ones and the two invalid ones a user can trigger. The ordered path creates account data, so its tests use a helper fixture whose teardown deletes it. Mapping: the five-transition purchase → one `@e2e` journey; each guard branch and invalid transition → its own `@regression` test.

## Example 3: API product search — combinatorial testing, domain testing, metamorphic testing

**Test basis (premise).** API contract: `GET /api/products` with query parameters `category` (enum, 3 values), `brand` (enum, 4 values), `sort` (`price_asc`, `price_desc`), `inStock` (boolean). Documented responses: 200, 400. The product data changes daily.

**Technique evaluation**

| Technique                  | Status  | Model or reason                                                                                                                       |
| -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Domain testing (EP + BVA)  | Applied | each enum value valid; an unknown value, a wrong type or an empty value → 400; BVA N/A — no ordered parameter                         |
| Combinatorial testing      | Applied | all combinations = 3 × 4 × 2 × 2 = 48 → a pairwise set of 12 rows                                                                     |
| Decision table             | N/A     | the parameters filter independently — no combined rule in the contract                                                                |
| State transition           | N/A     | read-only endpoint                                                                                                                    |
| Scenario-based testing     | N/A     | contract suite; the search journey belongs to the UI plans                                                                            |
| CRUD testing               | N/A     | nothing is created or changed                                                                                                         |
| Checklist / error guessing | Applied | a repeated parameter (`?brand=a&brand=b`), an unknown extra parameter, URL-encoded Unicode                                            |
| Comparison with an oracle  | N/A     | no fixed expected list — the data changes daily                                                                                       |
| Metamorphic testing        | Applied | MR-1: adding a filter never returns more products; MR-2: `price_desc` returns the same products as `price_asc` in reverse price order |

**Pairwise rows (excerpt — 12 in total; every value pair of every two parameters appears at least once, checked pair by pair)**

| #   | category | brand | sort       | inStock |
| --- | -------- | ----- | ---------- | ------- |
| 1   | c1       | b1    | price_asc  | true    |
| 2   | c1       | b2    | price_desc | false   |
| 3   | c2       | b1    | price_desc | false   |
| …   | …        | …     | …          | …       |

The rows are `as const` data in `test-data/static/{area}/`, iterated with `for...of`; each checks the status, that every returned product satisfies the filters, and the schema last (the `api-testing` skill). The metamorphic relations need no fixed expected list, which is why they suit changing data: each runs on several source queries. Invalid values get their own tests, one parameter and one invalid partition per test — never mixed into the pairwise rows.

## Example 4: API resource lifecycle — CRUD testing

**Test basis (premise).** API contract for a user's delivery addresses: `POST /api/addresses`, `GET /api/addresses`, `GET /api/addresses/{id}`, `PUT /api/addresses/{id}`, `DELETE /api/addresses/{id}`; the checkout page reads the default address.

**CRUD matrix**

| Function                   | Address |
| -------------------------- | ------- |
| POST /api/addresses        | C       |
| GET /api/addresses         | R       |
| GET /api/addresses/{id}    | R       |
| PUT /api/addresses/{id}    | R U     |
| DELETE /api/addresses/{id} | D       |
| checkout page              | R       |

Completeness: the address has C, R, U and D — no gap to ask about.

**Scenarios** (each creates its own address through a helper fixture whose teardown deletes it)

| ID       | Test title                                                                  | Technique · Covers         | Tag           |
| -------- | --------------------------------------------------------------------------- | -------------------------- | ------------- |
| ADDR-1.1 | POST /api/addresses creates an address that GET /api/addresses/{id} returns | CRUD C → R                 | `@api`        |
| ADDR-1.2 | PUT /api/addresses/{id} changes the address that GET then returns           | CRUD U → R                 | `@api`        |
| ADDR-1.3 | DELETE /api/addresses/{id} removes the address from GET /api/addresses      | CRUD D → R                 | `@api`        |
| ADDR-1.4 | GET /api/addresses/{id} for a deleted address returns 404                   | CRUD negative: R after D   | `@api`        |
| ADDR-1.5 | PUT /api/addresses/{id} for a deleted address returns 404                   | CRUD negative: U after D   | `@api`        |
| ADDR-1.6 | the checkout page shows the address set as default                          | CRUD R by another function | `@regression` |

CRUD coverage: all six operations of the matrix executed, plus two negatives. The per-field validation of the request bodies follows the `api-testing` skill's matrix.
