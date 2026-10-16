---
applyTo: 'test-plans/**/*.md,tests/**/*.ts'
---

# Test Design

**Purpose.** Tests are derived, not brainstormed. This skill turns the test basis into a plan in which every scenario exists because it covers a partition, a boundary, a rule, a transition, a scenario, an operation or a risk that no other scenario covers — and says which. The plan is the proposal: the user approves the design (which tests exist and why) before any spec is written.

Techniques and terms follow the ISTQB® Certified Tester syllabi — Advanced Level Test Analyst (CTAL-TA) v4.0, 2025, and Foundation Level (CTFL) v4.0.1 — summarised in our own words. Detail per technique: `references/techniques.md`; worked plans: `references/examples.md`.

## Critical

_Bullets tagged (DEF-…) are defaults of the `playwright-house-preset`: where `PROJECT-PROFILE.md` records a different choice, follow the profile (see the `project-profile` skill). Untagged bullets always apply._

- **The plan is the proposal.** For any task that creates or extends tests, write the test plan first — with its Test design section — and stop at the human gate (INV-10): the Phase 4 Proposal points to the plan. Write specs only after the user approves it. Adding one test to an existing spec needs a mini-design in that plan, limited to the inputs the test touches.
- **Evaluate every core technique.** Scenarios are derived with test techniques; the plan's technique evaluation marks each core technique **Applied** (with its model) or **N/A** with a one-line reason; a conditional technique gets a row when it is applied. Silently skipping a technique is forbidden — a reviewer cannot tell "not applicable" from "forgotten" (INV-09).
- **Name the test basis for every model**: a requirement or ticket, the API contract, or the live UI explored with the approved tool (a `maxlength`, a rendered message, a disabled button).
- **Never invent** a partition edge, a boundary, a business rule, a state, a risk level or an expected result (INV-01). If the test basis does not state it and exploration cannot observe it, list it under the proposal's Unknowns and ask. A guessed boundary is a placeholder, exactly like a guessed selector.
- **An expected result of success names the effect** — what exists only if the action took effect (the data the new session loads, the stored record, the changed state), not only the redirect, heading or message that appear either way. Find it while exploring; if none can be observed, it is an unknown (FW-13).
- **One invalid partition per test** — the first rejection masks the second. The only exception is a test whose stated purpose is that several errors are reported together; the plan says so.
- **Test effort follows product risk.** Rate each test item's risk — likelihood and impact, each with its reason — and let the user confirm the levels (`decision — who, date`). The level sets the coverage depth, the priority and the tag. An unconfirmed risk level is an unknown, not a fact.
- **Trace everything.** Every scenario names its technique and coverage item (`**Technique:** … · **Covers:** …`); every test maps to a scenario; no orphan scenarios, no untraced tests.
- **Data-driven loops take one labelled representative per partition** (`{ partition: 'no "@"', email: 'plainaddress' }`), never every known value — each value in a `for...of` loop stands for its own partition.
- **Coverage trade-offs are the user's call** — boundary depth, pairwise versus all combinations, pruning a large plan. Present them as trade-offs in the proposal; never cut scenarios silently.
- **Behaviour that contradicts the test basis is a defect, not a design change.** The scenario stays as the basis says; its test follows the project's known-defect policy (INV-02, DEF-20). Never rewrite the design to match the bug.

## Triggers

| Task                                              | Design depth                                                                                                                 |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| New tests for a feature, page or ticket           | Full design                                                                                                                  |
| New API endpoint suite                            | Full design — it supplies the values; the `api-testing` skill supplies the mandatory status-code and per-field rows          |
| New E2E journey                                   | Full design — usually scenario-based testing and state transitions; domain testing often N/A ("covered at functional level") |
| One test added to an existing spec                | Mini-design for the inputs it touches, in the existing plan                                                                  |
| Page object without tests yet                     | Not required — but partitions and error guessing decide which feedback locators the page object needs (`page-objects`)       |
| Migrating a plan to the plan contract             | The design of the existing scenarios, made explicit                                                                          |
| Refactor, debug, rename — no new behaviour tested | Not required                                                                                                                 |

## Inputs

- Required: the feature, page or endpoint under test, and a test basis — a requirement or ticket, the API contract, or the application to explore with the approved tool. Neither documented nor explorable → stop and ask.
- Optional: risk information (how often the feature is used, what a failure costs, past defects, legal or safety needs); existing plans and specs for the feature.

## Discovery

1. **`PROJECT-PROFILE.md`** — the plans folder, tags, the known-defect policy (`plans.knownDefects`), API conventions, and the "Authentication and accounts" section (which account a test may log in with).
2. **Existing plans and specs** for the feature — extend a plan rather than duplicate it; ask before overwriting one.
3. **The test basis, highest authority first:**
    - requirements, tickets, acceptance criteria — rules, messages, flows (a ticket is read with the `tracker` skill);
    - the API contract — `required`, types, formats, enums, patterns, length and value limits, documented status codes;
    - the live UI, explored with the approved tool — HTML constraints (`required`, `maxlength`, `min` / `max`, `type`), rendered messages, enabled and disabled states, navigation;
    - observed API behaviour — only when nothing is documented; flag the missing documentation and mark the scenarios `Purpose: characterization`.

Output: the **inputs** (fields, path and query parameters, body fields, choices), **rules** (conditions → outcomes), **states** (modes, lifecycles), **entities** (what is created, read, updated, deleted), **flows** (journeys), and the **oracles** available for expected results. Anything needed but not found goes to Unknowns.

## Decision rules

**Technique selection.** Core techniques are evaluated in every plan; conditional ones are used when their condition holds.

| The test basis has …                                                                        | Technique                             | Coverage goal (default → when the risk is high)                                                                                   |
| ------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| values the system treats in groups; ordered values or thresholds; rules over several fields | **Domain testing** (EP + BVA) — core  | every partition once, both sides of every border (2-value) → 3-value boundaries, or ON / OFF / IN / OUT points per border         |
| three or more independent parameters with several values each                               | **Combinatorial testing** — core      | pairwise, or base choice when one value per parameter is the normal case → all combinations                                       |
| an outcome that depends on a combination of conditions                                      | **Decision table** — core             | every feasible rule of the minimised table → every feasible rule of the full table                                                |
| modes or a lifecycle (session, cart, dialog, wizard, order status)                          | **State transition** — core           | every valid transition (0-switch) plus the invalid ones a user can trigger → 1-switch or round trips                              |
| a journey or workflow (user story, use case, activity)                                      | **Scenario-based testing** — core     | the main scenario, every alternative and every exception with an observable outcome; loops: zero, one, typical, maximum           |
| entities that are created, read, updated and deleted                                        | **CRUD testing** — core               | every operation of the CRUD matrix, plus reads before create and after delete → combinations such as every read after each update |
| typical failure areas for this kind of input or flow                                        | **Checklist / error guessing** — core | each relevant checklist item, with an expected result from the basis                                                              |
| no input to vary — the page must show known data                                            | **Comparison with an oracle** — core  | every item compared with the oracle (e.g. the API)                                                                                |
| no exact expected result (live or changing data, ranking, generated content)                | **Metamorphic testing** — conditional | each relation applied to several source cases                                                                                     |
| a need for many inputs, and an automated oracle                                             | **Random testing** — conditional      | a stated number of cases from a recorded seed                                                                                     |

**Human-only** — never generated as automated tests: session-based exploratory testing with test charters, crowd testing, usability evaluation. A plan may list them under "Not covered here" or attach charters for people to run.

- **Risk level → depth.** High: the stronger coverage goal of the table, the user's main path tagged `@smoke`, and a mutation check per check instead of per test (FW-12). Medium: the default goals. Low: the default goals, or a checklist only. State the cost of each step up in the proposal; the user decides.
- **Combine techniques** where they meet: boundaries on the guard conditions of transitions; domain testing for a variable inside a scenario or a decision-table condition; round trips for workflows that repeat.
- **Merge overlaps.** A boundary value that is also a partition representative is one scenario naming both techniques.
- **Tags** (DEF-06): the critical main path → `@smoke`; other functional scenarios → `@regression`; journeys → `@e2e`; API scenarios → `@api`; shared or global state → `@destructive` (the `test-standards` skill, Phase 3).
- **Size.** More than about 25 scenarios for one feature → group them by priority and let the user prune.
- **The account a test logs in with** comes from the profile's "Authentication and accounts" section. A real credential is never typed where traces, videos or screenshots record it (INV-04).
- **New dependencies** (a pairwise generator, for example) are proposed to the user first, never added silently.
- **Random testing** only with a recorded seed and an automated oracle (a property or a metamorphic relation) — otherwise a failure cannot be reproduced.
- **Where the data lives** (DEF-08): universal type partitions → the `INVALID_*` arrays in `test-data/static/util/`; domain-specific partitions, decision tables and pairwise rows → `as const` data in `test-data/static/{area}/`; valid representatives → a Faker factory. For a length boundary the length is the design value — generate the content.

## Workflow

1. **Test basis and test conditions** — Discovery above. One test condition per behaviour the basis promises.
2. **Product risks** — identify the risk items (features, interfaces, conditions); for each, propose a likelihood and an impact with their reasons, the resulting level and the quality characteristic at stake. Details: `references/techniques.md`, "Product risk analysis".
3. **Models** — apply the techniques: partition and border tables, combination rows, decision tables, transition tables, scenario lists, CRUD matrices, checklists, oracles, metamorphic relations. Fill the technique evaluation.
4. **Scenarios** — the fewest that cover every coverage item at the depth the risk calls for; each with its technique, coverage item, tag and priority. Merge overlaps; check the size.
5. **The plan as the proposal** — write `test-plans/{area}/<feature>.md` from `templates/plan.template.md` (on the plan contract), then the Phase 4 Proposal block of the `ai-native-workflow` skill pointing to it: scenarios, risks, trade-offs, confidence, unknowns. Stop and wait for approval.
6. **Hand-off** after approval — spec structure, tags and the report structure: `test-standards`; data: `data-strategy`; API status-code matrix and per-field rows: `api-testing` (its Phases 5–6 apply in full); locators: `page-objects` and `selectors`.
7. **Report** (Phase 8) — the state of every planned scenario from the run summary (`npm run test:summary`): passed, failed (a listed known defect, or a new finding to confirm with the user), skipped (`n/a`, or quarantined), blocked, not run (INV-11); and the scenarios the user dropped, with their reason.

## Outputs

- The plan: Expected behaviour and its sources; **Test design** — test basis, product risks, technique evaluation, models; Scenarios; Why tests currently fail; Skipped tests; Not covered here.
- The Phase 4 Proposal pointing to the plan.
- The coverage report of step 7.

## Verification

- `npm run plans:check` — the plan's structure, sources and readiness; with discovery, every scenario mapped to a test once the specs exist.
- Every core technique has Applied with its model, or N/A with a reason; every scenario has `**Technique:** … · **Covers:** …`.
- A minimised decision table passes its checksum (`references/techniques.md`, "Decision tables").
- A pairwise set is checked, not assumed: every value pair of every two parameters appears in at least one row.

## Stop conditions

- No test basis, and nothing to explore.
- A boundary, rule, state or expected result the basis does not state.
- Risk levels that would change the scope are not confirmed.
- The design needs a new dependency.
- More than about 25 scenarios for one feature — the user prunes.

## Extension points

- The profile sets the tags, the known-defect policy (DEF-20), the plans folder and the accounts tests may use.
- A project may keep its own error-guessing checklists — in its plans or in a file the profile names.
- The technique catalogue, the evaluation table and the plan contract are kit-owned: change them in the kit and record the change in `KIT-CHANGELOG.md`.

## Anti-Patterns

| Anti-pattern                                                                      | Why it is wrong                                                          |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| "Happy path plus a few negatives" with no models                                  | Coverage is accidental and cannot be reviewed                            |
| A boundary the basis never states (e.g. "passwords have 8+ characters")           | An invented requirement — the test asserts a guess                       |
| Two invalid partitions in one test                                                | The first rejection masks the second; the second partition is untested   |
| A loop over every known value where several share a partition                     | More tests, no more coverage                                             |
| A boundary tested far from the border (scrolling to the footer instead of 300 px) | The off-by-one defect the boundary exists for is never hit               |
| Visiting every state treated as covering every transition                         | Broken transitions and illegal jumps go untested                         |
| All combinations of many parameters                                               | A test explosion; pairwise finds most interaction failures at a fraction |
| A decision-table rule or transition with no test because the suite was green      | The rule the table was built for is never checked                        |
| A technique left out of the evaluation                                            | "Not applicable" and "forgotten" look the same                           |
| Scenarios that never reach a spec, or tests with no scenario                      | Traceability breaks — the approved design is not what was built          |
| Risk levels presented as facts without the user's confirmation                    | Invented priorities steer the suite                                      |

## See Also

- **`ai-native-workflow`** — the Phase 4 Proposal format and the human gate the plan passes.
- **`test-standards`** — spec structure, tags, the readable report structure, the plan contract and skipped tests.
- **`data-strategy`** — where partitions, boundaries, decision tables and combination rows are stored.
- **`api-testing`** — the status-code matrix, per-field omission and invalid-type loops, behaviour mismatches.
- **`page-objects`**, **`selectors`**, **`playwright-cli`** — exploring the UI to find the test basis.
- **`references/techniques.md`** — each technique and product risk analysis in detail.
- **`references/examples.md`** — worked designs: a login form, a cart, an API search, an API resource lifecycle.
