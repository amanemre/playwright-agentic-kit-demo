---
name: <skill-name>
description: <What the skill covers and when to use it — the triggers an agent matches on. One paragraph; name the sibling skills it hands over to.>
---

# <Skill Title>

**Purpose.** <One or two sentences: the job this skill does and why it exists.>

## Critical

_Bullets tagged (DEF-…) are defaults of the `playwright-house-preset`: where `PROJECT-PROFILE.md` records a different choice, follow the profile (see the `project-profile` skill). Untagged bullets always apply._

- <Rules that must never be broken. Tag preset defaults with their rule ID from `RULE-INVENTORY.md`, e.g. _(DEF-02)_.>

## Triggers

- <Requests and situations that should load this skill.>

## Inputs

- Required: <what the skill cannot work without — stop and ask when missing>.
- Optional: <what improves the result>.

## Discovery

<How to find the facts the task needs: `PROJECT-PROFILE.md` first, then the repository (`ls`, the code), then the live application with the approved exploration tool. Never guess.>

## Decision rules

- <If … → …. One rule per line; cite the rule ID it implements.>

## Outputs

- <Files, reports or proposals the skill produces.>

## Verification

- <Commands and checks that prove the output is right.>

## Stop conditions

- <When to stop and ask the user instead of continuing.>

## Extension points

- <What a project may add or change through `PROJECT-PROFILE.md`, and what stays fixed.>

## See Also

- <Related skills and files.>
