<!--
Pull request description — the kit's template (the `pull-requests` skill).
kit-tailor copies it to the place the host reads templates from (the profile's delivery.host);
a project may add its own sections, but keeps these. Never paste secrets, tokens or env values.
-->

## Ticket

<ticket ID or link — or "none" with the reason>

## What and why

<what changes, and why — one ticket per pull request>

## Plan

<plan path(s) — approved by <who>, <YYYY-MM-DD>; or "no test plan: <reason>" for changes that add no tests>

## Test changes

<specs added or changed, with the scenario IDs they implement; data, fixtures and page objects they needed>

## Run summary

<from reports/run-summary.md: the state totals, the environment, the commit the run used>

### Needs confirmation

<every failed-new scenario and every failing test without a scenario, with the failed step — or "none">

## Known defects and skipped tests

<failed-known scenarios with the plan's known-failure row; skipped tests with their `n/a:` reason or defect ID — or "none">

## Checks run

- [ ] lint
- [ ] type check
- [ ] `npm run rules:check`
- [ ] `npm run plans:check`
- [ ] `npm run profile:check`
- [ ] mutation check — <which tests, the mutation, the step that failed; survivors and how they were fixed> (FW-12)

## Not done and follow-ups

<what is left out on purpose, open questions, follow-up tickets — or "none">
