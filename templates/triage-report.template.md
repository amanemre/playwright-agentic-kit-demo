<!--
Triage report — the kit's template (the healer role, the `debugging` skill).
One row per failing or unstable scenario of a run. Written for the user: what failed, who is
wrong, what was done, what needs a decision. Never paste secrets or env values.
-->

# Triage — <branch or run>, <YYYY-MM-DD>

Run summary: `reports/run-summary.md` (commit <sha>, environment <name>).

| Scenario       | State before            | Who is wrong                             | Class                             | Evidence                          | Outcome                                                                                                                     |
| -------------- | ----------------------- | ---------------------------------------- | --------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| <ID and title> | <failed-new / unstable> | <test / product / environment / unknown> | <the debugging skill's class A–F> | <failed step, values, trace path> | <fixed (attempt n of limit) / defect draft `reports/defect-<ID>.md` / environment — rerun / limit reached / needs decision> |

## Fixed in the tests

<per fix: the cause, the change, and the rerun that proved it — or "none">

## Product defects to confirm

<per defect draft: the scenario, the expectation and its source, what happened — the user confirms before it joins the plan or the tracker (INV-11) — or "none">

## Not resolved

<what hit the repair limit, what could not be reproduced, environment problems — and what would help — or "none">
