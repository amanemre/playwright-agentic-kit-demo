#!/usr/bin/env node
/**
 * triage-draft.mjs — the first draft of a triage, written from the run summary.
 *
 * For a run with new failures or unstable tests it writes
 *   reports/triage.md              one row per failing or unstable scenario, nothing decided yet
 *   reports/defect-<ID>.md         one defect report draft per `failed-new` scenario
 * in the shape of templates/triage-report.template.md and
 * templates/defect-report.template.md. It uses no AI and decides nothing:
 * whether a failure is the product's or the test's is for a person or the
 * healer role, and a draft becomes a defect only after the user confirmed it
 * (INV-11). It works on any CI system, and locally.
 *
 *   node scripts/triage-draft.mjs [--summary reports/run-summary.json] [--out reports] [--root <dir>]
 *
 * Exit code 0 = written, or nothing to triage; 2 = usage or input error.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseScenarios } from './plan-check.mjs';

const cell = (text) =>
    String(text ?? '')
        .replace(/\|/g, '\\|')
        .replace(/\n/g, ' ');
const fileSafe = (id) => id.replace(/[^\w.-]+/g, '-');

/**
 * What needs triage in a run: new failures and unstable scenarios, failing
 * tests without a scenario, and failing setup tests.
 *
 * @param {object} summary - The run summary (scripts/run-summary.mjs).
 * @returns {Array<{ kind: 'scenario' | 'test', state: string, id?: string, title: string, plan?: string, tests: object[] }>} Items.
 */
export function triageItems(summary) {
    const items = [];
    for (const plan of summary.plans ?? [])
        for (const s of plan.scenarios)
            if (s.state === 'failed-new' || s.state === 'unstable')
                items.push({
                    kind: 'scenario',
                    state: s.state,
                    id: s.id,
                    title: s.title,
                    plan: plan.plan,
                    tests: s.tests.filter((t) => t.status !== 'passed'),
                });
    for (const t of [...(summary.setup ?? []), ...(summary.unplanned ?? [])])
        if (t.status === 'failed' || t.status === 'unstable')
            items.push({
                kind: 'test',
                state: t.status === 'failed' ? 'failed-new' : 'unstable',
                title: `${t.file} › ${t.title}`,
                tests: [t],
            });
    return items;
}

/** What the run showed for an item: the failed steps and the error's details */
function evidence(item) {
    const t = item.tests.find((x) => x.error) ?? item.tests[0];
    if (!t?.error) return '';
    const lines = t.error.split('\n');
    const detail = (lines.length > 1 ? lines.slice(1) : lines).join(' · ');
    return t.failedSteps?.length
        ? `${t.failedSteps.join('; ')} — ${detail}`
        : detail;
}

/**
 * The triage report draft.
 *
 * @param {object} summary - The run summary.
 * @param {ReturnType<typeof triageItems>} items - What needs triage.
 * @param {{ commit?: string, date: string }} meta - The commit and the date.
 * @returns {string} Markdown.
 */
export function renderTriage(summary, items, meta) {
    const drafts = items.filter(
        (i) => i.kind === 'scenario' && i.state === 'failed-new'
    );
    return [
        `# Triage (draft) — ${meta.commit ? `commit ${meta.commit.slice(0, 10)}` : 'this run'}, ${meta.date}`,
        '',
        'Written by `scripts/triage-draft.mjs` from the run summary. **Nothing here is decided yet:** for each row a person, or the healer role, still decides who is wrong — the product or the test.',
        '',
        `Run summary: \`reports/run-summary.md\`${summary.run?.environment ? ` (environment ${summary.run.environment})` : ''}.`,
        '',
        '| Scenario | State before | Who is wrong | Class | Evidence | Outcome |',
        '| --- | --- | --- | --- | --- | --- |',
        ...items.map(
            (i) =>
                `| ${cell(i.id ? `${i.id} ${i.title}` : i.title)} | ${i.state} | to decide | to decide | ${cell(evidence(i))} | ${
                    i.kind === 'test'
                        ? 'needs decision — no scenario covers this test'
                        : i.state === 'unstable'
                          ? `needs decision — passed only on a retry (${Math.max(...i.tests.map((t) => t.retries))})`
                          : `needs decision — draft \`reports/defect-${fileSafe(i.id)}.md\``
                } |`
        ),
        '',
        '## Fixed in the tests',
        '',
        'none — nobody has investigated yet.',
        '',
        '## Product defects to confirm',
        '',
        drafts.length
            ? [
                  'Drafts only — each becomes a defect when the user confirms it (INV-11):',
                  '',
                  ...drafts.map(
                      (i) =>
                          `- \`reports/defect-${fileSafe(i.id)}.md\` — ${i.id} ${i.title}`
                  ),
              ].join('\n')
            : 'none',
        '',
        '## Not resolved',
        '',
        `${items.length} item(s) above — all of them, until someone classifies them.`,
        '',
    ].join('\n');
}

/**
 * One defect report draft, for a `failed-new` scenario.
 *
 * @param {object} summary - The run summary.
 * @param {ReturnType<typeof triageItems>[number]} item - The scenario.
 * @param {{ commit?: string, source?: string }} meta - The commit, and the scenario's source from its plan.
 * @returns {string} Markdown.
 */
export function renderDefect(summary, item, meta) {
    const t = item.tests.find((x) => x.error) ?? item.tests[0];
    const failed = new Set(t.failedSteps ?? []);
    const steps = t.steps?.length ? t.steps : [...failed];
    const lines = (t.error ?? '').split('\n');
    return [
        '> **DRAFT — not confirmed.** Written from a test run by `scripts/triage-draft.mjs`. A person decides whether this is a product defect before it is filed (INV-11); search the tracker for duplicates first.',
        '',
        '## Summary',
        '',
        `${item.title}${failed.size ? ` — fails at: ${[...failed].join('; ')}` : ''}`,
        '',
        '## Environment',
        '',
        `- Environment: ${summary.run?.environment ?? '<name>'}`,
        `- Build or commit: ${meta.commit ?? '<commit>'}`,
        `- Browser / project: ${t.project || '<project>'}`,
        '',
        '## Steps to reproduce',
        '',
        steps.length
            ? steps
                  .map(
                      (s, n) =>
                          `${n + 1}. ${s}${failed.has(s) ? '  ← fails here' : ''}`
                  )
                  .join('\n')
            : '<the test has no named steps — see the spec>',
        '',
        '## Expected',
        '',
        `${failed.size ? [...failed].join('; ') : item.title}${meta.source ? ` — source: ${meta.source}` : ''}`,
        '',
        '## Actual',
        '',
        (lines.length > 1 ? lines.slice(1) : lines).join('\n') ||
            '<see the run summary>',
        '',
        '## Evidence',
        '',
        "The run's HTML report and traces (`reports/playwright-report/`), and `reports/run-summary.json`. Attach only what holds no secret.",
        '',
        '## Frequency',
        '',
        `Seen in this run${t.retries ? `, on all ${t.retries + 1} attempts` : ''}. Run it again before writing "always".`,
        '',
        '## Test',
        '',
        `- Scenario: ${item.id} ${item.title}`,
        `- Spec: ${t.file} › ${t.title}`,
        `- Plan: ${item.plan}`,
        '',
        '## Related',
        '',
        'not checked yet',
        '',
    ].join('\n');
}

/** The commit a CI run or a local run is on, when it can be told */
function currentCommit(root) {
    const fromCi =
        process.env.GITHUB_SHA ??
        process.env.CI_COMMIT_SHA ??
        process.env.BUILD_SOURCEVERSION ??
        process.env.GIT_COMMIT;
    if (fromCi) return fromCi;
    try {
        return execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: root,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
    } catch {
        return undefined;
    }
}

/**
 * Writes the drafts.
 *
 * @param {{ root: string, summary: object, out: string, commit?: string, date?: string }} options - Inputs.
 * @returns {string[]} The files written, repository-relative.
 */
export function writeDrafts({ root, summary, out, commit, date }) {
    const items = triageItems(summary);
    if (!items.length) return [];
    mkdirSync(out, { recursive: true });
    const written = [];
    const write = (name, content) => {
        writeFileSync(join(out, name), content);
        written.push(relative(root, join(out, name)));
    };
    write(
        'triage.md',
        renderTriage(summary, items, {
            commit,
            date: date ?? new Date().toISOString().slice(0, 10),
        })
    );
    for (const item of items) {
        if (item.kind !== 'scenario' || item.state !== 'failed-new') continue;
        let source;
        const planFile = join(root, item.plan);
        if (existsSync(planFile))
            source = parseScenarios(readFileSync(planFile, 'utf8')).find(
                (s) => s.fields.ID === item.id
            )?.fields.Source;
        write(
            `defect-${fileSafe(item.id)}.md`,
            renderDefect(summary, item, { commit, source })
        );
    }
    return written;
}

/** CLI entry point */
function main() {
    const args = process.argv.slice(2);
    const valueOf = (flag) =>
        args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
    const known = new Set(['--summary', '--out', '--root']);
    if (args.some((a, i) => a.startsWith('--') && !known.has(a))) {
        console.error(
            'usage: node scripts/triage-draft.mjs [--summary <run-summary.json>] [--out <dir>] [--root <dir>]'
        );
        process.exit(2);
    }
    const root = valueOf('--root')
        ? resolve(valueOf('--root'))
        : resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const summaryPath = resolve(
        root,
        valueOf('--summary') ?? 'reports/run-summary.json'
    );
    let summary;
    try {
        summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
    } catch (error) {
        console.error(
            `Cannot read the run summary ${summaryPath}: ${error.message}`
        );
        process.exit(2);
    }
    const written = writeDrafts({
        root,
        summary,
        out: resolve(root, valueOf('--out') ?? 'reports'),
        commit: currentCommit(root),
    });
    console.log(
        written.length
            ? `Triage draft: ${written.join(', ')}`
            : 'Triage draft: nothing to triage — no new failures, no unstable tests.'
    );
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
    main();
