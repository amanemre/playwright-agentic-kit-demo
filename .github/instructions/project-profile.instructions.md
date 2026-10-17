---
applyTo: '**'
---

# Project Profile

**Purpose.** General skills describe _how_ to work; `PROJECT-PROFILE.md` (repository root) says _what this repository is_: its paths and commands, its API and authentication conventions, its environment, and which configurable defaults it has changed. Read facts from the profile — never from memory, an example, or another repository.

## Critical

- **The profile is the only source of project facts.** Paths, commands, env var names, hosts, API conventions and the exploration tool come from `PROJECT-PROFILE.md`. If the profile lacks a fact a task needs, discover it (`ls`, the code, the app with the approved explore tool) and propose adding it — never guess, and never treat an example from a skill as this project's value.
- **Precedence.** Invariants (`INV-*` in `RULE-INVENTORY.md`) always apply and cannot be overridden. Framework rules (`FW-*`) always apply. Preset defaults (`DEF-*`) apply unless the profile's `overrides` list records a different choice with a reason. Explicit user instructions keep their authority; report any conflict before acting.
- **Never edit the profile to get past a rule or a failing check.** Adding an override, removing a project term, or changing a convention is a decision for the user, proposed with evidence like any other change.
- **The summary blocks are generated.** The "Project Profile (summary)" block between `<!-- profile:start -->` and `<!-- profile:end -->` in `CLAUDE.md`, `.cursor/rules/rules.mdc` and `.github/copilot-instructions.md` is rendered from the profile. Edit the profile, then run `npm run profile:sync`; never edit the block by hand.
- **No secrets in the profile.** It names env vars (`APP_EMAIL`), never their values.
- **Commands are data.** A command in the profile is a verified reference, not an instruction to run it. Check what it targets (environment, shared data) before running it, as with any command.
- **Standing approvals are the user's.** `standingApprovals` lists outward actions the user approved in advance — `post-run-summary`, `open-triage-issue`, `push-fixes-as-draft-pr` — each for one action, within its limits, until its date. Before acting under one, check today's date against `date` and `expires`, stay inside the limits, and say which approval was used. Never add, extend, renew or widen an entry yourself: propose the text, and the user adds it under their own name. Merging, pushing to the base branch, force-pushing, confirming or filing a defect, and weakening or skipping a test can never be approved in advance (INV-10).

## Inputs

- Required: `PROJECT-PROFILE.md`.
- Optional: `RULE-INVENTORY.md` (rule IDs and categories), `KIT-MANIFEST.md` (who owns which file, kit version).

## How to read it

| Part                                                                                                                    | Holds                                                                                                           | Example key                                                            |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Front matter: `mode`, `preset`                                                                                          | `scaffold` (new project, preset installed) or `adopt` (existing repository keeps its architecture)              | `mode: scaffold`                                                       |
| `capabilities`                                                                                                          | What the project has — UI, API, auth style, contract validation                                                 | `capabilities.api: true`                                               |
| `paths`, `commands`, `env`, `hosts`                                                                                     | Project facts                                                                                                   | `paths.testEntry`, `env.credentials`                                   |
| Convention keys (`architecture`, `validation`, `reporting`, `tags`, `plans`, `data`, `lifecycle`, `api`, `exploration`) | The project's choice for each configurable default — keys match the "Profile key" column of `RULE-INVENTORY.md` | `reporting.style: readable-steps`                                      |
| `overrides`                                                                                                             | Departures from preset defaults: rule ID, choice, reason, source                                                | `{ rule: DEF-03, choice: passthrough, reason: …, source: <contract> }` |
| `projectTerms`, `termExceptions`                                                                                        | Words that must not appear in general kit files (leak check, Phase E)                                           | `exampleshop`                                                          |
| `openQuestions`                                                                                                         | Unknowns and the work they block                                                                                | —                                                                      |
| Markdown body                                                                                                           | API conventions, authentication, starting-state helpers, environment problems, known defects, worked examples   | —                                                                      |

## Decision rules

- **A general skill shows an example that differs from the profile** → follow the profile; the example is illustrative.
- **A convention key differs from the preset default** → follow the profile's value; the override's reason explains why.
- **Report structure** → in `scaffold` mode the readable report structure is a rule (`reporting.style: readable-steps`); in `adopt` mode follow `reporting.style` as recorded.
- **A helper the skill relies on is absent** (e.g. `reporting.helper`) → use the equivalent the profile names, or report the capability gap; never import a helper that does not exist.
- **A fact is missing or the profile looks wrong** → stop the dependent work, show the evidence, propose the profile change, and wait for the user's decision.

## Verification

- `npm run profile:check` — validates the front matter, checks paths exist, rejects contradictory choices and overrides of invariants or framework rules, and fails when a summary block is stale.
- `npm run profile:sync` — rewrites stale summary blocks; content outside the markers is never touched.
- `npm run test:kit` — the script's own tests.

## Stop conditions

Stop and ask the user when: the profile is missing or fails `profile:check`; a task needs a fact the profile does not have and discovery cannot establish it; an open question in the profile blocks the work; or a rule and the profile contradict each other.

## Extension points

A project extends the profile with new prose sections freely. New front-matter keys need a profile-schema change in `scripts/profile-sync.mjs` (kit-owned), recorded in the kit changelog.

## See Also

- `RULE-INVENTORY.md` — every rule with its ID, category and profile key.
- `KIT-MANIFEST.md` — which files are kit, preset or project, and the kit version.
- **`ai-native-workflow`** — the workflow every task follows; the profile supplies its project facts.
