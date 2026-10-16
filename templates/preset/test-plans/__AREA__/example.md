# Example — Test Plan

<!-- plan-contract: 1 -->

|              |                                                         |
| ------------ | ------------------------------------------------------- |
| **Feature**  | The example form installed with the preset              |
| **Spec**     | `tests/__AREA__/functional/example.spec.ts`             |
| **Explored** | The form is defined in `pages/__AREA__/example.page.ts` |

Replace this plan with the application's first real one (`templates/plan.template.md`).

## Test design

**Test basis:** the example form's definition, `pages/__AREA__/example.page.ts`.

### Product risks

| Risk item    | Likelihood (why)           | Impact (why)                 | Level | Depth, tag         | Source                                     |
| ------------ | -------------------------- | ---------------------------- | ----- | ------------------ | ------------------------------------------ |
| The greeting | low — a fixed example form | low — replaced by real pages | low   | defaults, `@smoke` | example — replace with the team's decision |

### Technique evaluation

| Technique                  | Status  | Model or reason                                     |
| -------------------------- | ------- | --------------------------------------------------- |
| Domain testing (EP + BVA)  | Applied | name: V1 non-empty · I1 empty — no length limit     |
| Combinatorial testing      | N/A     | one input                                           |
| Decision table             | N/A     | no combined conditions                              |
| State transition           | Applied | empty → greeting → empty-name message               |
| Scenario-based testing     | N/A     | a single form, no workflow                          |
| CRUD testing               | N/A     | nothing is stored                                   |
| Checklist / error guessing | N/A     | an example to replace, not a feature with a history |
| Comparison with an oracle  | N/A     | no displayed data                                   |

## Scenarios

### 1. Greeting

#### 1.1 submitting a name shows a greeting and an empty name asks for one

**ID:** EX-1.1 · **Tag:** `@smoke` · **Priority:** high · **Purpose:** conformance · **Readiness:** ready

**Source:** requirement — the example form's own definition, `pages/__AREA__/example.page.ts`

**Isolation:** read-only — the form lives in the page, nothing is stored

**Tests:** `tests/__AREA__/functional/example.spec.ts`

**Technique:** state transition · **Covers:** empty → greeting; greeting → empty name → message

1. **GIVEN** the example form is open
2. **WHEN** the user submits a name
3. **THEN** the greeting names them
4. **WHEN** they submit an empty name
5. **THEN** a message asks for a name

## Why tests currently fail

None.

## Skipped tests

None.
