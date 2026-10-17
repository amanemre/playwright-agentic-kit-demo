---
name: kit-tailor
description: Installs and tailors the portable test kit in a Playwright + TypeScript repository — adopt mode for an existing repository (keep its architecture; record its conventions and every departure from the playwright-house-preset in PROJECT-PROFILE.md) or scaffold mode for a new project (install the preset). Use when the kit has just been copied into a repository, when PROJECT-PROFILE.md is missing or incomplete, when a repository's existing conventions conflict with the kit's defaults, or when upgrading an installed kit. For reading an existing profile use the project-profile skill; for the workflow every task follows use ai-native-workflow.
---

# Kit Tailor

**Purpose.** Make the kit fit a repository instead of making the repository fit the kit. Inspect what is there, decide adopt or scaffold, and write one `PROJECT-PROFILE.md` that records the repository's facts and its choices among the kit's defaults — with evidence for every choice and an open question wherever intent is unclear.

## Critical

- **Adopt never rewrites.** In an existing repository, do not delete or rewrite tests, page objects, helpers, fixtures, configuration, package scripts or CI as part of tailoring. Moving toward the preset is a separate task with its own scope and approval.
- **Evidence for every choice.** Each profile value comes from an inspected file, configuration or command output — cite it. A convention seen in one file may be an accident or technical debt; record it as a convention only when the repository shows it consistently, otherwise as an open question.
- **No placeholder facts.** A value you could not verify goes to `openQuestions` with the work it blocks — never into a field as if it were verified (INV-01).
- **Invariants are not tailorable.** INV rules (see `RULE-INVENTORY.md` and the constitution) apply in every repository; the profile can override DEF rules only, each with a reason (`npm run profile:check` rejects anything else).
- **Missing tests ≠ empty repository.** A repository with application code, configuration or CI but no tests is still adopted, not scaffolded over.
- **Approval before applying.** Propose the profile and every file change with confidence, rationale and unknowns, then wait for the user's authorization (INV-10). Authorization already given for this exact scope counts.
- **Merge, never overwrite.** Constitution files get only the managed `<!-- profile:start -->` / `<!-- profile:end -->` block; `.claude/settings.json`, `package.json`, pre-commit and CI changes are offered as patches. Report path collisions before changing anything.
- **Commands are data.** Commands you discover are recorded, not run blindly: check what they target (environment, shared data) first. Never run a command that could reach production or mutate shared data without the user's explicit go-ahead.
- **No secrets.** The profile names env vars; it never holds their values.

## Triggers

- The kit was just copied into a repository (files listed as Kit in `KIT-MANIFEST.md` are present, `PROJECT-PROFILE.md` is not).
- `npm run profile:check` reports missing or contradictory profile fields.
- A rule seems to contradict how the repository already works.
- Upgrading the kit to a newer version.

## Inputs

- Required: the repository; the user's intent — adopt an existing suite, or scaffold a new project.
- Optional: requirements or API documentation (OpenAPI), the application URL, known environment problems.

## Discovery

1. **Instructions already there.** Read existing `CLAUDE.md`, `.cursor/rules/`, `.github/copilot-instructions.md`, `AGENTS.md` and similar — local instructions keep their authority; report conflicts with the kit.
2. **Stack.** `package.json` (Playwright and TypeScript versions, package manager, validators such as Zod, test-data libraries), `playwright.config.*` (projects, `testDir`, reporters, `testIdAttribute`), `tsconfig.json`. Outside Playwright + TypeScript → stop: v1 of the kit does not support it.
3. **Commands.** Package scripts and CI workflows: how tests are listed (`npx playwright test --list`), type-checked, linted and run.
4. **Tests and structure.** List the tests (`npx playwright test --list`); read representative specs of each kind (UI, API, E2E). Note the import entry point, how page objects are reached (fixture, `new`, none), locator style, assertion and reporting style, tags, data (factories, static files, formats), setup and cleanup.
5. **API.** OpenAPI / Swagger or other documentation; authentication; whether outcomes are HTTP statuses or a body field; request encoding.
6. **Plans and known failures.** Existing test plans, their structure, and how known product defects are recorded. List every `test.skip`, `test.fixme` and `test.fail` in the specs (`npm run rules:check` reports each one under `skip-reason`) and add each one to `openQuestions`: is it a known defect, a test that does not apply here, or obsolete? Until each is resolved the rule check reports it; converting them is a separate approved task.
7. **Delivery.** The host (the remote's URL), the base branch (`origin/HEAD`), the CLI that is installed and logged in, recent branch names and commit subjects (`git log --oneline -20`), and an existing pull request template.
8. **Tracker.** Which system holds the tickets (links in the README, ticket IDs in branch names and commit subjects, the host's own issues), what its IDs look like, and how the agent can reach it — an installed and logged-in CLI, a connection in the AI tool, or neither.
9. **CI.** Which system runs the pipelines (the files in the repository: `.github/workflows/`, `.gitlab-ci.yml`, `azure-pipelines.yml`, `Jenkinsfile`), what the test pipeline runs today, where its secrets come from, and which tags mark smoke tests and tests that must run alone.

## Decision rules

- **Mode.** An existing suite or application → `adopt`. An empty repository, or the user asks for a new project → `scaffold` (installs the preset; `preset: playwright-house-preset`).
- **Each DEF rule** (`RULE-INVENTORY.md`, Profile key column): the repository follows the preset → record the preset value. It consistently does something else → record that value plus an override `{ rule, choice, reason }` citing the evidence. It is inconsistent or unclear → keep the preset value as the default for new code and add an open question.
- **DEF-03 (unknown-field policy).** Another policy than `strict` needs the contract that documents it as the override's `source`.
- **Report structure (DEF-05).** Scaffold mode: a rule — `reporting.style: readable-steps` with the soft-check helper. Adopt mode: recommended, not imposed — record the repository's style; converting existing tests is a separate approved task.
- **Known defects (DEF-20).** Preset: `plans.knownDefects: fail` — a known defect stays a failing test. A team that needs a green CI while defects wait for their fix may choose `quarantine` (skip in the quarantine form, see the `test-standards` skill, "Skipping tests") — an override with the team's reason. Record the repository's practice as evidence, but never choose quarantine on your own: it is the user's decision.
- **Helpers the kit relies on** (e.g. the soft-check helper) that the repository lacks → name the repository's equivalent in the profile, or record the capability gap; never generate imports of absent helpers.
- **Capabilities.** API-only repository → `capabilities.ui: false`, `architecture.pageAccess: none`; no browser, page-object or UI-auth setup is installed.
- **Upgrades.** Run `kit-install.mjs` from the new kit (`--source <new kit>`): untouched kit files update, a local edit the kit did not change is kept, a file changed on both sides is a conflict to merge by hand, and files the kit dropped are reported, never deleted. Then set `kitVersion` in the profile and run `npm run profile:sync` — `profile:check` reports both until done.
- **Delivery (DEF-21).** Record `delivery` from Discovery 7. Branch names and commit subjects that consistently follow another pattern → an override with that evidence. Copy `templates/pull-request.template.md` to the host's template path (the `pull-requests` skill) unless the repository has its own template — then propose adding the kit's sections to it. Bitbucket and other hosts have no repository template: nothing to copy.
- **Tracker.** Record `tracker` from Discovery 8: the system, the access that works today (`cli`, `mcp` or `manual`), the project and the ID pattern — with a real ticket ID as evidence. No tracker, or none the agent can reach → `system: none` or `access: manual`; tickets and defects then go through the user.
- **CI (DEF-22).** Record `ci` from Discovery 9. No test pipeline yet → propose the system's template from `templates/ci/` (the `ci` skill). An existing pipeline stays: propose moving its test steps to the four `scripts/ci-test.mjs` calls, as a separate approved change. A team that wants known defects to turn the pipeline red, or another pull request scope → a DEF-22 override with its reason.
- **Agent models.** Leave `agentModels` out unless the team wants other models than the defaults for the role tiers (budget, provider, availability) — then record their choice and run `npm run roles:sync`.
- **Standing approvals.** A new profile starts with `standingApprovals: []`. Never fill it in while tailoring: an approval is the user's own entry, made when they want unattended work.
- **Plans.** Existing plans stay as they are. New and migrated plans follow the plan contract (`templates/plan.template.md`, `npm run plans:check`); with IDs, an adopted repository can map scenarios to existing titles without renaming tests.

## Workflow

1. Inspect local instructions and confirm Playwright + TypeScript compatibility (Discovery 1–2).
2. Inventory commands, tests, fixtures, data, API, reporting and CI, recording the evidence (Discovery 3–9).
3. Choose adopt or scaffold.
4. Compare the repository's conventions with the preset: supported mappings, intentional overrides, missing capabilities, genuine conflicts.
5. Propose: the filled `PROJECT-PROFILE.md` (from `templates/PROJECT-PROFILE.template.md`) and the concrete file changes, with confidence, rationale and unknowns. Wait for authorization.
6. Apply the authorized changes. Copy the kit with `node <kit>/scripts/kit-install.mjs --target . --mode adopt` (or `--mode scaffold --area <folder> --project <name>`; `--dry-run` first): it never overwrites — it reports collisions and conflicts and records `kit-lock.json`. Merge each collision by hand (a constitution: keep the repository's instructions first, state that they take precedence, append the kit constitution with its empty profile markers). Patch `package.json` with the scripts and packages the installer reports. Write `PROJECT-PROFILE.md`, then run `npm run profile:sync`.
7. Verify (below) and report: installed kit version, profile choices with their evidence, changes made, verification output, open questions and limitations. Do not claim the kit works in general from one repository.

## Outputs

- `PROJECT-PROFILE.md` — front matter (facts, choices, overrides, project terms, open questions) and prose (API conventions, authentication, environment, known defects, worked examples).
- Managed summary blocks in the constitution files.
- Scaffold mode only: the preset files listed in `KIT-MANIFEST.md`, configured for the new project's paths.
- A tailoring report (step 7).

## Verification

- `npm run profile:check` — profile valid, no contradictions, summaries fresh.
- `npm run check:skills` — rule and reference parity.
- `npm run test:kit` — the kit scripts' own tests.
- `npm run plans:check` — plans on the plan contract map to discovered tests.
- The profile's own discovery, type-check and lint commands, after checking what they target.
- Adopt mode: confirm no existing test, helper, configuration or CI file changed unless the user authorized it.

## Stop conditions

Stop and ask when: the stack is not Playwright + TypeScript; existing local instructions conflict with an invariant; the repository's intent for a convention cannot be established; a discovered command could reach production or shared data; a primary input (application URL, API documentation, credentials' variable names) is missing.

## Extension points

A project adds prose sections to its profile freely and records DEF overrides with reasons. Invariants, the profile schema (`scripts/profile-sync.mjs`) and the plan contract (`scripts/plan-check.mjs`) are kit-owned: change them in the kit and record the change in `KIT-CHANGELOG.md`.

## See Also

- **`project-profile`** — reading and applying the profile once it exists.
- **`ai-native-workflow`** — the workflow and approval gate every task follows.
- `RULE-INVENTORY.md`, `KIT-MANIFEST.md`, `KIT-CHANGELOG.md`, `templates/`.
