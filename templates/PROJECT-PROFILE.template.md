---
# PROJECT-PROFILE.md template — copy to the repository root and fill it in
# (`kit-tailor` does this). Every <…> must be replaced by a verified fact or
# moved to openQuestions; `npm run profile:check` fails until then.
# Keys follow the "Profile key" column of RULE-INVENTORY.md. Names only — never secret values.
profileSchema: 1
kitVersion: <kit version from KIT-MANIFEST.md>

project:
    name: <repository name>
    app: <what the application under test is>

mode: <adopt | scaffold>
preset: <playwright-house-preset | none>

stack:
    framework: playwright
    language: typescript

capabilities:
    ui: <true | false>
    api: <true | false>
    auth: <how tests authenticate — token, session cookie, none>
    contractValidation: <zod | another validator | none (only when api is false)>
    reporting: [<html, allure, …>]

paths:
    area: <area folder name>
    tests: <tests folder>
    plans: <plans folder>
    testEntry: <file specs import test / expect from>
    # pageManager, pageObjects, components, fixtures, schemas, enums, helpers,
    # factories, staticData, config, authSetup — the ones the project has

packageManager: <npm | pnpm | yarn | bun>

commands:
    discover: <list tests without running them>
    typecheck: <type check>
    lint: <lint>
    test: <run tests>
    summary: <one state per planned scenario from a run's JSON report — node scripts/run-summary.mjs --report <report>>

env:
    files: <env file pattern>
    appUrl: <env var name>
    apiUrl: <env var name>
    credentials: [<env var names>]

hosts: [<hosts tests may reach>]

exploration:
    tool: <playwright-cli>
    fallbacks: []

execution:
    # how often the healer role may try to fix one failing test before it stops and reports
    repairAttempts: 2

architecture:
    pageAccess: <pageManager | the project's own mechanism | none>
    pageObjects: <getter-locators | the project's style | none>

validation:
    library: <zod | …>
    unknownFieldPolicy: <strict | another policy the contract documents>
    assertionPattern: <expect(Schema.parse(body)).toBeTruthy() | the project's pattern>

reporting:
    style: <readable-steps | the project's style>
    helper: <soft-check helper path, when style is readable-steps>
    capture: <traces / screenshots / videos and where they go>

tags:
    allowed: [<tags>]
    perTest: 1

plans:
    headingIsTitle: <true | false>
    specHeader: '// plan:'
    knownDefects: <fail | quarantine — fail is the preset default; quarantine needs a DEF-20 override with its reason>

data:
    staticFormat: <ts-as-const | the project's format>
    factories: <faker | the project's approach>

lifecycle:
    cleanup: <how tests restore what they change>
    setupVia: <api | ui>

api:
    coverage: <full-matrix | none>

ci:
    system: <github-actions | gitlab-ci | azure-pipelines | jenkins | other | none>
    gate: <summary | exit-code — with summary only new failures and unstable tests fail the pipeline; exit-code needs a DEF-22 override>
    pullRequest: <smoke+changed | smoke | all — what a pull request runs; a value other than smoke+changed needs a DEF-22 override>
    shards: <how many parallel shards a run uses, e.g. 2>
    smokeTag: '<the tag of the tests every pull request runs, e.g. @smoke>'
    serialTag: '<the tag of tests that run alone, one at a time, e.g. @destructive — omit when there is none>'

tracker:
    system: <github | gitlab | jira | azure-boards | linear | other | none>
    access: <cli | mcp | manual — how the agent may read tickets and file defects>
    project: <project key, repository or board — omit when there is none>
    idPattern: <a regular expression for ticket IDs, e.g. '[A-Z]+-\d+' or '#\d+'>
    defectType: <the issue type or label defects get, e.g. Bug>

delivery:
    host: <github | gitlab | azure-devops | bitbucket | other>
    baseBranch: <the branch pull requests merge into>
    cli: <gh | glab | az | none — the host's command-line tool the agent may use>
    branchPattern: '{type}/{ticket}-{short-name}'
    commitStyle: <conventional | the team's style — another style needs a DEF-21 override>

# Every value above that differs from the preset default needs an override:
#   - rule: DEF-xx, choice: <value>, reason: <why>, source: <for DEF-03: the contract>
overrides: []

projectTerms: [<words that identify this application — kept out of kit files>]

termExceptions:
    - path: PROJECT-PROFILE.md
      reason: the profile is where project terms belong

# Optional — the model each agent role tier uses, per tool. Roles name a tier (deep, balanced,
# fast); without this block Claude Code uses opus / sonnet / haiku, Cursor inherits the session's
# model and Copilot keeps its model picker. After changing it, run `npm run roles:sync`.
# agentModels:
#     claude:
#         deep: opus
#         balanced: sonnet

# Outward actions the user approved in advance — each for one action, within its limits, until
# its date. Approvable: post-run-summary, open-triage-issue, push-fixes-as-draft-pr. Only the
# user adds or renews an entry; merging, pushing to the base branch, confirming a defect and
# weakening a test can never be approved in advance.
#   - action: post-run-summary
#     limits: one comment per pull request, updated in place
#     approvedBy: <the user's name>
#     date: <YYYY-MM-DD>
#     expires: <YYYY-MM-DD>
standingApprovals: []

openQuestions: []
---

# Project profile — <repository name>

## The application

## API conventions

## Authentication and accounts

## Starting state over HTTP

## Environment

## Known defects

## Worked examples
