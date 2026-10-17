# Principles That Make the Scaffold AI-Native

The scaffold is engineered so an LLM can reason from a small surface and produce consistent output. Five principles drive this; four working principles (below) guide the agent.

## 1. Single Source of Truth for Every Value Class

- URLs / credentials → `process.env.*` (declared in `env/.env.example`).
- Endpoint paths / route constants / UI message strings / storage-state paths → `enums/{area}/*` and `enums/util/*`.
- Universal type-mismatch arrays → `test-data/static/util/invalid-values.ts`.
- Domain-specific curated invalid sets → `test-data/static/{area}/*.ts`.
- Dynamic happy-path data → Faker factories in `test-data/factories/{area}/`.

There is exactly one right answer per value kind; the agent never has to guess.

## 2. Hard-Stop Forbidden Patterns

Every Critical block lists `NEVER` rules with concrete anti-examples. Forbidden patterns are not soft preferences; they are refusal triggers. When the agent encounters a forbidden pattern in a user's request or in an example, it raises the conflict instead of complying.

## 3. Mandatory Exploration Discipline

`playwright-cli` for UI, OpenAPI / docs first for API. The agent does not speculate about UI text or response shapes. When exploration is impossible (CLI broken, app unreachable, docs missing), the agent stops and notifies the human — it does not substitute another tool.

## 4. Strict Folder Discipline

Every artifact has exactly one home (and the path uses an `{area}` placeholder that the agent resolves with `ls`). Skill triggering by description keyword works because the folder maps cleanly to the skill name.

## 5. Phased Instructions Inside Skills

Each specialized skill walks the agent through numbered phases with checklists. The agent doesn't have to invent a workflow per task; it follows the skill's phases.

## Working Principles for the Agent

The five principles above shape the scaffold. These four shape how the agent works in it. They adapt the `karpathy-guidelines` skill (multica-ai/andrej-karpathy-skills), which grew out of Andrej Karpathy's observations on how LLMs go wrong when they write code: wrong assumptions they never check, bloated code, and edits to things nobody asked them to touch. Each principle below names the kit rule that carries it and shows what it means in a Playwright suite.

### 1. Think Before Coding

State your assumptions; surface confusion instead of hiding it; show the trade-offs. Rules: INV-01 (never invent), INV-10 (plan before applying), the confidence gate in `SKILL.md`.

- Several readings of a request → present them and ask; do not pick one silently.
- A simpler approach exists → say so, and push back when the request would make the suite worse.
- Something is unclear → stop, name what is unclear, ask.

_Example._ "Add tests for the cart" — functional tests for the cart page, an E2E purchase, or the cart API? Each gives a different plan. Ask, or propose the plan with the reading stated in its scope.

### 2. Simplicity First

The minimum code that solves the problem; nothing speculative. Rule: FW-11.

- No features, options or parameters nobody asked for.
- No abstraction for code used once — no generic base page or "action runner" for one spec.
- No error handling for cases that cannot happen — Playwright already fails a test on a timeout; wrapping every action in `try/catch` hides failures (INV-02).
- No page-object methods "for later" — locators and actions exist because a planned scenario uses them (feedback locators included, FW-07).
- If 200 lines could be 50, rewrite them before proposing them.

_Test:_ would a senior engineer call this overcomplicated? If yes, simplify.

### 3. Surgical Changes

Touch only what the request needs; clean up only your own mess. Rule: INV-12.

- Do not reformat, rename or "improve" neighbouring tests, locators, comments or imports.
- Match the existing style of the file, even where you would do it differently.
- Notice an unrelated problem — dead code, a flaky neighbour, a broken table in a plan → report it with its location; fix it only when the user asks.
- Remove only the imports, helpers and fixtures your own change made unused.

_Test:_ every changed line traces directly to the request. A diff that also touches three neighbouring specs needs a reason for each of them.

### 4. Goal-Driven Execution

Turn the task into checks, then loop until they pass.

- "Add tests for the search" → the approved plan's scenarios, each discovered and run (`plans:check --discover`, the spec run).
- "Fix the failing test" → reproduce the failure first (the `debugging` skill), then fix, then the same run passes — and the cause is product or test, decided before the fix.
- "Refactor the fixtures" → the affected suites pass before and after.
- In the Phase 4 Proposal, each step names its check: `<step> → verify: <check>`.

Strong checks let the agent work without asking at every step; weak ones ("make it work") lead to rework.

## The Combined Effect

These five principles together produce **consistent results across sessions, agents, and contributors** — the operational definition of "AI-native" in this codebase.
