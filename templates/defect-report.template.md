<!--
Defect report — the kit's template (the `tracker` skill).
Filed only after the user confirmed the defect and approved filing it. Never paste secrets,
tokens or env values; attach evidence only from tests that use their own throwaway accounts.
-->

## Summary

<one sentence: what is wrong, where — it becomes the ticket's title>

## Environment

- Environment: <name, e.g. dev or staging — never a credential or a private URL the tracker's readers should not see>
- Build or commit: <application version, or the commit the run used>
- Browser / project: <e.g. chromium, api>

## Steps to reproduce

<the test's own steps — its GIVEN and WHEN lines, with the data a person needs to repeat them>

1. <GIVEN …>
2. <WHEN …>

## Expected

<the THEN line, and where the expectation comes from — the requirement, the ticket or the contract>

## Actual

<what happened instead — the failed step and its values from the run summary>

## Evidence

<trace, screenshot or response excerpt; or where the CI run keeps them>

## Frequency

<always | intermittent: n of m runs>

## Test

- Scenario: <ID and title>
- Spec: <file › test title>
- Plan: <plan path>

## Related

<the ticket the behaviour belongs to, similar reports found while checking for duplicates — or "none">
