# Test design techniques — detail

Loaded from the `test-design` skill when a technique is applied. Each section says what the model is, what its coverage items are, and how it lands in the plan and the suite. Source: ISTQB® CTAL-TA v4.0 (2025) and CTFL v4.0.1, summarised in our own words.

## Product risk analysis

Risk-based testing spends test effort where failure is most likely and costs most. The agent proposes; the user decides.

1. **Risk items.** Break the test object into features, interfaces or conditions — risk is rarely the same across a whole page or API.
2. **Likelihood** — how probable a defect is: complexity, new or recently changed code, a history of defects here, a vague or contradictory test basis, many integrations.
3. **Impact** — what a failure costs: how often the feature is used, how critical it is to the business goal (buying, paying, signing up), financial or reputational damage, legal or safety needs.
4. **Level** — high, medium or low from likelihood × impact, with the reasons. Name the quality characteristic at stake (functional completeness, correctness or appropriateness; compatibility; usability).
5. **Mitigation** — the techniques and coverage depth per level (the skill's selection table), the tag and the priority.

The plan records the risks as a table; the levels become facts only when the user confirms them (`Source: decision — who, date`):

| Risk item       | Likelihood (why)                | Impact (why)                  | Level | Depth, tag              | Source                   |
| --------------- | ------------------------------- | ----------------------------- | ----- | ----------------------- | ------------------------ |
| Cart total      | medium — discount rules changed | high — every order, money     | high  | 3-value BVA, `@smoke`   | decision — <who>, <date> |
| Newsletter form | low — one field, unchanged      | low — no money, easy to retry | low   | defaults, `@regression` | decision — <who>, <date> |

Risks change: when a feature changes or defects cluster somewhere, revisit its level and the depth of its tests.

## Domain testing (equivalence partitioning + boundary value analysis)

**Model.** For each input — or each rule over several inputs — the partitions the system should treat alike, and the borders between them. Partitions come from type, presence (missing, empty), format, membership of an allowed set, range, uniqueness (an email already registered). Label valid partitions `V1…` and invalid ones `I1…`.

**Borders.** A border is closed when the condition includes its value (`≤`, `≥`, `=`) and open when it does not (`<`, `>`, `≠`). Points relative to a border:

- **ON** — on a closed border; for an open border, the value inside the partition closest to it;
- **OFF** — outside the partition, closest to a closed border; for an open border, the border value itself;
- **IN** — inside the partition, not ON; **OUT** — outside, not OFF.

**Coverage.**

- Partitions: every partition at least once; valid partitions may share a test, invalid ones get one test each.
- Boundaries, default (2-value, the CTFL form): the border value and its nearest neighbour on the other side — an integer field accepting `1..99` gives `0, 1, 99, 100`.
- Higher risk: 3-value boundaries (`0, 1, 2, 98, 99, 100`), or **reliable domain coverage** — one ON, OFF, IN and OUT point per border (`=` borders: one ON and two OFF points on either side; `≠` borders: one OFF and two ON points). Points can be shared between borders.
- The step between ON and OFF is the field's precision: 1 for integers, 0.01 for money, one day for dates, one character for lengths.
- Rules over several fields (e.g. `age ≥ 18 AND country = X`) are domains with several borders — test each border, keeping the other conditions inside their partitions.

**In the suite.** Universal type partitions reuse the `INVALID_*` arrays; domain-specific partitions are labelled representatives in `test-data/static/{area}/`; a length boundary generates its content (`faker.string.alpha({ length: max + 1 })`). Single-use boundary sets may stay inline.

## Combinatorial testing

**Model.** Parameters and their values (after equivalence partitioning has reduced the values to representatives), plus the constraints: impossible or invalid combinations, and combinations known to be risky that must be included. A classification tree is a convenient way to write the model down.

**Coverage.**

- **Pairwise** — every value pair of any two parameters appears in at least one row. Most interaction failures involve one or two parameters, which is why pairwise finds most of them at a fraction of the combinations.
- **Base choice** — pick the normal value of each parameter (the base row), then vary one parameter at a time through its other values. Suits configurations with a clear default.
- **All combinations** — only when the product is small (about 20 or fewer) or the risk is high.

**In the suite.** Rows as `as const` data in `test-data/static/{area}/`, iterated with `for...of`. Invalid values are never mixed into combination rows — that would put two invalid partitions in one test; they get their own tests. A hand-made pairwise set is checked pair by pair; a generator is a new dependency, proposed to the user first. Browser and device coverage (Playwright projects) is combinatorial too.

## Decision tables

**Model.** Conditions and actions as rows, rules as columns. Start from the full table (product of the condition values), remove infeasible rules (combinations that cannot occur) and note why, then minimise: merge rules that lead to the same actions and differ in one condition across all its values, writing `–` (don't care) for that condition. Merging order can change the result — check whether further merging is possible.

**Review the table** for consistency (rules covering the same combination have the same actions), feasibility, completeness (no feasible combination missing), correctness against the basis, and no overlapping rules.

**Checksum.** Each rule of the minimised table scores 1, multiplied by the number of values of every condition marked `–`. The sum must equal the number of feasible rules of the full table — lower means a gap, higher an overlap or an infeasible rule. Equal sums do not prove equivalence; they only catch the common mistakes.

**Coverage.** Every feasible rule of the minimised table at least once. When the risk is high, do not minimise: cover the feasible rules of the full table. A `–` condition still needs a concrete value in the test — choose it deliberately and say which.

**In the suite.** An `as const` array, one object per rule with a `description`, the condition values and the expected outcome _kind_ (a literal, mapped to an enum-backed message or locator in the spec — never the message string itself).

## State transition testing

**Model.** States, events, guard conditions and actions — as a diagram or a transition table: `From | Event | Guard | To | Observable result`. The model shows expected behaviour at the level of detail the tests need.

**Coverage.**

- **0-switch** (every valid transition at least once) — the default; covering every state is not enough.
- **1-switch** — every pair of consecutive transitions through a state; when sequences matter.
- **N-switch** — longer sequences; only for high risk, as the number grows fast.
- **Round trips** — every loop that starts and ends in the same state without repeating another state; effective for cyclic workflows.
- **Invalid transitions a user can trigger** — deep-linking to a guarded page, browser back after logout or payment, refresh mid-flow, double submit.

**In the suite.** Short sequences → a functional test with one step per transition; long cross-feature sequences → an `@e2e` test. Boundary values apply to guard conditions. Transitions that persist state need their cleanup (the `test-standards` skill).

## Scenario-based testing

**Model.** The workflow as a use case or an activity diagram: a **main scenario** (the normal way to the goal), **alternatives** (other ways that still reach the goal) and **exceptions** (abnormal use or invalid input that prevents the goal).

**Coverage.** The main scenario, every alternative and every exception with an observable outcome. Without loops, one test per scenario covers the model. With loops, **simple loop coverage**: each loop skipped, run once, run a typical number of times, and run the maximum number of times where one exists. A scenario may need several tests when its variables need domain coverage.

**In the suite.** The main scenario → `@e2e` (or `@smoke` for a critical single-feature flow); alternatives and exceptions → `@regression` functional tests unless they span features. Use-case steps become GIVEN / WHEN / THEN steps.

## CRUD testing

**Model.** A **CRUD matrix**: entities as columns, functions (screens, endpoints, jobs) as rows, and in each cell the operations that function performs on that entity — C, R, U, D. Mind the implicit reads that come with create, update and delete.

**Completeness check** (static) — every entity has its whole lifecycle somewhere: a missing operation (an entity that can be created but never deleted) is a question for the user, not a test.

**Coverage** (dynamic consistency) — every operation of the matrix executed, per entity, by tests that combine functions over the entity's lifecycle; plus negatives: read before create, read or update after delete, delete twice. CRUD coverage = operations executed ÷ operations in the matrix. A stricter goal combines operations, e.g. every read after each update.

**In the suite.** Natural for API resources: the lifecycle runs through the API, with the helper fixtures for setup and cleanup; a UI function that writes an entity is checked by reading it back through the API (only the stored data, no schema check — the `api-testing` skill owns the contract).

## Checklists and error guessing

**Model.** A checklist of what typically goes wrong for this kind of input or flow. Items are questions answered yes, no or not applicable, each with a priority. A **read-do** list gives concrete items to apply (these invalid inputs for an email field); a **do-confirm** list prompts ideas to explore (are the search results relevant?).

**A starting list** — keep only items the feature can plausibly get wrong:

- leading, trailing or only-whitespace values; letter case (an email typed in capitals at login versus signup);
- Unicode, emoji, right-to-left text; input longer than `maxlength` (pasted, or sent directly to the API);
- special characters and injection-shaped strings — assert safe handling (rejected, or shown as plain text), never exploitation;
- double submit, refresh mid-flow, browser back after submit or logout;
- uniqueness conflicts (registering the same email twice);
- empty states (no results, empty cart, empty list);
- session loss mid-flow (cookies cleared, token expired);
- two tabs editing the same thing — only where the feature allows it.

Every item still needs an expected result from the test basis; an unknown expected result goes to Unknowns. Checklists are never final — add the defects the suite missed.

## Comparison with an oracle

**When.** There is no input to vary, but the page must show known data — every product card, every order line, every label of a list.

**Model.** The oracle — the source the expected values come from: the API, a second view of the same data, a fixed reference file the user provided. Name it in the plan.

**Coverage.** Every item of the list compared with the oracle; the comparison checks the fields the page shows.

**When no oracle exists** (the test oracle problem), the options are: a pseudo-oracle (another system that fulfils the same specification), properties every correct output has (property-based checks), metamorphic relations (below), or a human — which is not an automated test.

## Metamorphic testing (conditional)

**When.** No exact expected result is available — live or changing data, ranking and search relevance, generated content — but a **metamorphic relation** is known: how a change to the input must change the output.

**Model.** A source test case, one or more follow-up cases derived from it by the relation, and one joint verdict: the relation holds or the test fails. Examples:

- adding a filter never returns more results than without it;
- sorting the same results by another key keeps the same set of items;
- searching for an item's exact name returns that item;
- doubling the quantity of every cart line doubles the subtotal.

**Coverage.** There is no accepted coverage measure; each relation once is too little — apply it to several source cases (combine with random or partition-based sources). A failure means one of the cases is wrong; debugging decides which.

## Random testing (conditional)

**When.** Many inputs are needed and an automated oracle (a property or a metamorphic relation) can judge every result — fuzzing path parameters, round-tripping data.

**Rules.** Record the seed (in the test title or an annotation) so every failure can be replayed; state the number of cases, since random testing has no coverage criterion; pick the distribution deliberately (uniform for verification, realistic usage for validation). Never use it where a failure could not be reproduced — that is a flaky test by design.

## Human-only techniques

Not generated as automated tests; a plan may list them under "Not covered here", or attach them for people to run:

- **Session-based exploratory testing** with a test charter — a mission in the form "Explore <target> with <resources> to discover <information>", plus scope, time box, risks and what the product must never do. Findings come back as new scenarios or defects.
- **Crowd testing** — many testers on varied devices and locations; broad environments and real-user feedback, uneven quality.
- **Usability evaluation** — reviews, sessions with users, questionnaires; accessibility conformance (e.g. WCAG levels) may become automated checks only where a tool can decide them.
