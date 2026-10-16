# <Feature> — Test Plan

<!-- plan-contract: 1 -->

|                 |                                                  |
| --------------- | ------------------------------------------------ |
| **Feature**     | <What is under test>                             |
| **Spec**        | `tests/<area>/<type>/<feature>.spec.ts`          |
| **Explored**    | <How: playwright-cli, API docs, live requests …> |
| **Explored on** | <YYYY-MM-DD>                                     |

## Expected behaviour and its sources

- <Each expectation and where it comes from: a requirement (document reference), a decision (who decided, when) or an observation (when, where, what was seen).>

## Starting state (every scenario)

- <Data each scenario creates through the API, and how it is cleaned up.>

## Test design

Designed with the `test-design` skill — techniques from ISTQB CTAL-TA v4.0 and CTFL v4.0.1.

**Test basis:** <requirement / ticket, API contract, or what was explored with which tool, and when>

### Product risks

| Risk item                         | Likelihood (why)               | Impact (why)                   | Level   | Depth, tag            | Source                       |
| --------------------------------- | ------------------------------ | ------------------------------ | ------- | --------------------- | ---------------------------- |
| <feature, interface or condition> | <low / medium / high — reason> | <low / medium / high — reason> | <level> | <coverage depth, tag> | <decision — who, YYYY-MM-DD> |

### Technique evaluation

| Technique                  | Status          | Model or reason               |
| -------------------------- | --------------- | ----------------------------- |
| Domain testing (EP + BVA)  | <Applied / N/A> | <the model below, or why not> |
| Combinatorial testing      | <Applied / N/A> | <…>                           |
| Decision table             | <Applied / N/A> | <…>                           |
| State transition           | <Applied / N/A> | <…>                           |
| Scenario-based testing     | <Applied / N/A> | <…>                           |
| CRUD testing               | <Applied / N/A> | <…>                           |
| Checklist / error guessing | <Applied / N/A> | <…>                           |
| Comparison with an oracle  | <Applied / N/A> | <…>                           |

<!-- Add a row for a conditional technique when it is applied: Metamorphic testing, Random testing (seeded). -->

### Models

<One block per applied technique: partition and border tables, combination rows, decision tables (with the checksum), transition tables, scenario lists, CRUD matrices, checklists, oracles, metamorphic relations — each naming its test basis.>

## Scenarios

### 1. <Group>

#### 1.1 <exact test title>

**ID:** <ABC-1.1> · **Tag:** `<@tag>` · **Priority:** <high | medium | low> · **Purpose:** <conformance | characterization> · **Readiness:** <ready | needs-clarification | blocked | manual>

**Source:** <requirement — reference | decision — who, YYYY-MM-DD, reference | observation — YYYY-MM-DD, environment, evidence>

**Isolation:** <read-only | what the test creates and how it is cleaned up>

**Tests:** `<spec file>`

**Technique:** <technique> · **Covers:** <coverage item>

1. **GIVEN** <starting state>
2. **WHEN** <action>
3. **THEN** <one observable check>

#### 1.2 <title with a `<placeholder>` for each varying value>

**ID:** <ABC-1.2> · **Tag:** `<@tag>` · **Priority:** <…> · **Purpose:** <…> · **Readiness:** <…>

**Source:** <…>

**Isolation:** <…>

**Tests:** `<spec file>`

**Technique:** equivalence partitioning · **Covers:** <one representative per partition>

**Cases** (`placeholder`):

- `<value of partition 1>`
- `<value of partition 2>`

1. **WHEN** <action with `<placeholder>`>
2. **THEN** <check>

<!-- A scenario that cannot be implemented yet: Readiness needs-clarification or blocked, plus
**Blocked by:** <the open question or missing input>. It blocks only itself. -->

## Why tests currently fail

| Behaviour of the live app | Failing lines | Scenarios | Defect |
| ------------------------- | ------------- | --------- | ------ |

<!-- Defect: the tracker's ID of the confirmed defect (the `tracker` skill), or "not filed". -->

## Skipped tests

<!-- Every skipped test: a quarantined defect by its ID (only with plans.knownDefects: quarantine), or a test that does not apply here by its reason (the text after `n/a:`). `npm run rules:check` matches them. -->

| Scenarios | Kind | Defect or reason |
| --------- | ---- | ---------------- |

## Not covered here

- <What is deliberately left out, and why.>
