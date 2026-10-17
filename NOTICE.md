# Notices

## Playwright Agentic Kit

The kit's files — the rules, skills, scripts, templates and the `playwright-house-preset` — are released under the MIT License. They are derived from [create-agentic-playwright](https://github.com/idavidov13/agentic-playwright) by Ivan Davidov, also under the MIT License. This file is installed with the kit, so the notice travels with every copy:

```text
Copyright (c) 2026 Emre Aman
Copyright (c) 2026 Ivan Davidov and Agentic Playwright contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## andrej-karpathy-skills

The working principles — the constitutions' "Working principles" section, INV-12, FW-11 and the `ai-native-workflow` skill's `references/principles.md` — adapt the four principles of the `karpathy-guidelines` skill from [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) (Jiayuan Zhang; commit `2c60614`), which in turn derives from Andrej Karpathy's observations on LLM coding pitfalls. That repository declares the MIT License in its `SKILL.md` and `plugin.json`; it ships no separate license file. The kit rewrites the principles in its own words for Playwright test automation.

## ISTQB® syllabi

The `test-design` skill and its references summarise test techniques and risk-based testing from the ISTQB® Certified Tester syllabi — Advanced Level Test Analyst (CTAL-TA) v4.0 (2025) and Foundation Level (CTFL) v4.0.1 — in the kit's own words; no syllabus text is reproduced. The syllabi's authors and ISTQB® are the source and the copyright owners of the syllabi. ISTQB® is a registered trademark of the International Software Testing Qualifications Board.

## Third-party components

Playwright Agentic Kit vendors the following third-party components. Each remains under its own upstream license, which governs that component regardless of the kit's license.

### skill-creator

- **Path:** `.claude/skills/skill-creator/` (mirrored under `.cursor/skills/` and `.github/skills/`)
- **Source:** [anthropics/skills](https://github.com/anthropics/skills) (`skills/skill-creator`)
- **License:** Apache License 2.0 — see `.claude/skills/skill-creator/LICENSE.txt`
- **Copyright:** Anthropic, PBC

### playwright-cli skill

- **Path:** `.claude/skills/playwright-cli/` (mirrored under `.cursor/skills/` and `.github/skills/`)
- **Source:** the [`@playwright/cli`](https://www.npmjs.com/package/@playwright/cli) npm package (skill documentation bundled with the package). Vendored copy is locally customized; provenance and hashes are tracked in `skills-lock.json`.
- **License:** Apache License 2.0
- **Copyright:** Microsoft Corporation

### Playwright

[Playwright](https://playwright.dev/) and [`@playwright/test`](https://www.npmjs.com/package/@playwright/test) are open-source projects by Microsoft Corporation, consumed here as npm dependencies (Apache License 2.0). This project is not affiliated with or endorsed by Microsoft.
