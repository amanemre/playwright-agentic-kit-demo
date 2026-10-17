#!/usr/bin/env node
/**
 * plan-check.mjs — validates test plans that follow the plan contract.
 *
 * A plan opts in with `<!-- plan-contract: 1 -->`; plans without the marker are
 * reported as "not migrated" and otherwise left alone, so plans can migrate one
 * at a time. The plans folder comes from PROJECT-PROFILE.md (`paths.plans`).
 *
 * Each scenario (a `####` heading under "## Scenarios") carries field lines —
 * `**ID:** … · **Tag:** … · **Purpose:** …` — before its steps. A
 * parameterized scenario puts `<name>` placeholders in its heading and lists
 * its cases under `**Cases** (\`name\`, …):` as `- \`value\` · \`value\``.
 *
 *   node scripts/plan-check.mjs                     structure, sources, readiness, IDs
 *   node scripts/plan-check.mjs --discover          + mapping to the tests Playwright discovers
 *   node scripts/plan-check.mjs --discovered <json> + mapping, from saved `--list --reporter=json` output
 *   --root <dir>                                    repository root (default: parent of scripts/)
 *
 * `--discover` runs `npx playwright test --list --reporter=json` (lists tests,
 * runs none). No command from the profile is ever executed.
 * Exit code 0 = no problems; 1 = problems (listed); 2 = usage error.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { PROFILE_FILE, splitFrontMatter } from './profile-sync.mjs';

export const MARKER = '<!-- plan-contract: 1 -->';
export const READINESS = ['ready', 'needs-clarification', 'blocked', 'manual'];
export const PURPOSES = ['conformance', 'characterization'];
export const PRIORITIES = ['high', 'medium', 'low'];
const REQUIRED = [
    'ID',
    'Tag',
    'Priority',
    'Purpose',
    'Readiness',
    'Source',
    'Technique',
    'Covers',
    'Isolation',
];
const DATE = /\b\d{4}-\d{2}-\d{2}\b/;

/**
 * Reads the plans folder, allowed tags and heading rule from the profile.
 *
 * @param {string} root - Repository root.
 * @returns {{ plans: string, tags: string[], headingIsTitle: boolean }} Settings.
 */
export function readSettings(root) {
    const { yaml } = splitFrontMatter(
        readFileSync(join(root, PROFILE_FILE), 'utf8')
    );
    const profile = parseYaml(yaml);
    return {
        plans: profile.paths?.plans,
        tags: profile.tags?.allowed ?? [],
        headingIsTitle: profile.plans?.headingIsTitle ?? true,
    };
}

/**
 * Splits a field line into its `**Key:** value` segments.
 *
 * @param {string} line - e.g. "**ID:** PL-01 · **Tag:** `@api`".
 * @returns {Array<[string, string]>} Key / value pairs.
 */
function fieldsOf(line) {
    return line
        .split(' · ')
        .map((part) => /^\*\*([^*:]+):\*\*\s*(.*)$/.exec(part.trim()))
        .filter(Boolean)
        .map((m) => [m[1].trim(), m[2].trim()]);
}

const unquote = (value) => value.replace(/^`(.*)`$/, '$1');

/**
 * Parses the scenarios of a plan.
 *
 * @param {string} text - The plan's Markdown.
 * @returns {Array<{ line: number, number?: string, heading: string, fields: Record<string, string>, placeholders: string[], cases: string[][] }>} Scenarios.
 */
export function parseScenarios(text) {
    const lines = text.split('\n');
    const start = lines.findIndex((l) => /^## Scenarios\s*$/.test(l));
    if (start < 0) return [];
    const scenarios = [];
    let current = null;
    let inCases = false;
    for (let i = start + 1; i < lines.length; i++) {
        const line = lines[i];
        if (/^## /.test(line)) break;
        const heading = /^#### (.+)$/.exec(line);
        if (heading) {
            const title = heading[1]
                .replace(/^\d+(\.\d+)*\s+/, '')
                .replace(/\s+—\s+`@[\w-]+`\s*$/, '')
                .replace(/`(<[\w-]+>)`/g, '$1');
            current = {
                line: i + 1,
                number: /^(\d+(?:\.\d+)*)\s/.exec(heading[1])?.[1],
                heading: title,
                fields: {},
                placeholders: [...title.matchAll(/<([\w-]+)>/g)].map(
                    (m) => m[1]
                ),
                cases: [],
            };
            scenarios.push(current);
            inCases = false;
            continue;
        }
        if (!current) continue;
        if (/^\*\*Cases\*\*/.test(line)) {
            inCases = true;
            continue;
        }
        if (inCases && /^- /.test(line)) {
            current.cases.push(
                [...line.matchAll(/`([^`]*)`/g)].map((m) => m[1])
            );
            continue;
        }
        if (inCases && line.trim() !== '') inCases = false;
        if (/^\*\*[^*]+:\*\*/.test(line)) {
            for (const [key, value] of fieldsOf(line))
                current.fields[key] = value;
        }
    }
    return scenarios;
}

/**
 * The test titles a scenario expands to: its heading, or one title per case
 * with the heading's `<placeholder>`s filled in.
 *
 * @param {{ heading: string, placeholders: string[], cases: string[][] }} scenario - A parsed scenario.
 * @returns {string[]} Test titles.
 */
export function scenarioTitles(scenario) {
    return scenario.placeholders.length
        ? scenario.cases.map((c) =>
              scenario.placeholders.reduce(
                  (t, p, i) => t.replaceAll(`<${p}>`, c[i] ?? `<${p}>`),
                  scenario.heading
              )
          )
        : [scenario.heading];
}

/**
 * The spec file a scenario names in its **Tests** field.
 *
 * @param {{ fields: Record<string, string> }} scenario - A parsed scenario.
 * @returns {string | undefined} Repository-relative path.
 */
export function testsFileOf(scenario) {
    const tests = scenario.fields.Tests;
    return tests ? unquote(tests.split(' ')[0]) : undefined;
}

/**
 * Checks one Source field against its kind's required details.
 *
 * @param {string} source - e.g. "decision — user (product owner), 2026-10-04, chat".
 * @returns {{ kind?: string, problem?: string }} The kind, or what is missing.
 */
export function checkSource(source) {
    const m = /^(requirement|decision|observation)\s+—\s+(.+)$/.exec(
        source ?? ''
    );
    if (!m)
        return {
            problem:
                'Source must start with "requirement —", "decision —" or "observation —"',
        };
    const [, kind, detail] = m;
    if (
        kind === 'decision' &&
        !(DATE.test(detail) && detail.split(',').length >= 2)
    ) {
        return {
            kind,
            problem: 'a decision needs who decided and the date (YYYY-MM-DD)',
        };
    }
    if (
        kind === 'observation' &&
        !(DATE.test(detail) && detail.split(',').length >= 3)
    ) {
        return {
            kind,
            problem:
                'an observation needs the date (YYYY-MM-DD), the environment and the evidence',
        };
    }
    return { kind };
}

/**
 * Discovered tests from Playwright's `--list --reporter=json` output.
 *
 * @param {object} report - The parsed JSON report.
 * @param {string} root - Repository root.
 * @returns {Map<string, Array<{ title: string, tags: string[] }>>} Repository-relative spec path → tests.
 */
export function discoveredTests(report, root) {
    const rootDir = report.config?.rootDir ?? root;
    const byFile = new Map();
    const walk = (suite) => {
        for (const spec of suite.specs ?? []) {
            const file = relative(root, join(rootDir, spec.file));
            if (!byFile.has(file)) byFile.set(file, []);
            const tests = byFile.get(file);
            if (!tests.some((t) => t.title === spec.title)) {
                tests.push({
                    title: spec.title,
                    tags: (spec.tags ?? []).map((t) =>
                        t.startsWith('@') ? t : `@${t}`
                    ),
                });
            }
        }
        for (const child of suite.suites ?? []) walk(child);
    };
    for (const suite of report.suites ?? []) walk(suite);
    return byFile;
}

/**
 * Validates every plan in the profile's plans folder.
 *
 * @param {{ root: string, discovered?: Map<string, Array<{ title: string, tags: string[] }>> }} options - Root and discovered tests.
 * @returns {{ problems: string[], notes: string[] }} Problems (fail the check) and notes (information).
 */
export function check({ root, discovered }) {
    const problems = [];
    const notes = [];
    const settings = readSettings(root);
    const plansDir = join(root, settings.plans ?? '');
    if (!settings.plans || !existsSync(plansDir))
        return {
            problems: [`paths.plans "${settings.plans}" not found`],
            notes,
        };

    const ids = new Map();
    for (const name of readdirSync(plansDir)
        .filter((n) => n.endsWith('.md'))
        .sort()) {
        const planPath = join(settings.plans, name);
        const text = readFileSync(join(root, planPath), 'utf8');
        if (!text.includes(MARKER)) {
            notes.push(`${planPath}: not migrated to the plan contract`);
            continue;
        }
        const scenarios = parseScenarios(text);
        if (scenarios.length === 0)
            problems.push(`${planPath}: no scenarios under "## Scenarios"`);
        const mappedFiles = new Set();
        const covered = new Map();
        const where = (s) => `${planPath}:${s.line}`;

        for (const s of scenarios) {
            const f = s.fields;
            for (const key of REQUIRED)
                if (!f[key]) problems.push(`${where(s)}: missing **${key}:**`);
            if (f.ID) {
                if (!/^[A-Z][A-Z0-9]*-\d+(\.\d+)?$/.test(f.ID))
                    problems.push(
                        `${where(s)}: ID "${f.ID}" must look like ABC-1 or ABC-1.2`
                    );
                if (ids.has(f.ID))
                    problems.push(
                        `${where(s)}: ID ${f.ID} already used at ${ids.get(f.ID)}`
                    );
                else ids.set(f.ID, where(s));
            }
            const tag = unquote(f.Tag ?? '');
            if (f.Tag && settings.tags.length && !settings.tags.includes(tag))
                problems.push(
                    `${where(s)}: tag ${tag} is not in the profile's tags.allowed`
                );
            if (f.Priority && !PRIORITIES.includes(f.Priority))
                problems.push(
                    `${where(s)}: Priority must be one of ${PRIORITIES.join(', ')}`
                );
            if (f.Purpose && !PURPOSES.includes(f.Purpose))
                problems.push(
                    `${where(s)}: Purpose must be one of ${PURPOSES.join(', ')}`
                );
            if (f.Readiness && !READINESS.includes(f.Readiness))
                problems.push(
                    `${where(s)}: Readiness must be one of ${READINESS.join(', ')}`
                );

            const source = checkSource(f.Source);
            if (f.Source && source.problem)
                problems.push(`${where(s)}: ${source.problem}`);
            if (f.Purpose === 'conformance' && source.kind === 'observation') {
                problems.push(
                    `${where(s)}: a conformance scenario needs a requirement or a decision — an observation only supports characterization`
                );
            }
            if (['needs-clarification', 'blocked'].includes(f.Readiness)) {
                if (!f['Blocked by'])
                    problems.push(
                        `${where(s)}: readiness "${f.Readiness}" needs **Blocked by:** (what must be resolved)`
                    );
                notes.push(
                    `${where(s)}: ${f.ID ?? s.heading} — ${f.Readiness}: ${f['Blocked by'] ?? '?'}`
                );
            }

            // Mapping to tests
            if (s.placeholders.length && s.cases.length === 0)
                problems.push(
                    `${where(s)}: heading has placeholders (${s.placeholders.join(', ')}) but no **Cases** list`
                );
            for (const c of s.cases) {
                if (c.length !== s.placeholders.length)
                    problems.push(
                        `${where(s)}: case [${c.join(', ')}] has ${c.length} value(s), the heading has ${s.placeholders.length} placeholder(s)`
                    );
            }
            const titles = scenarioTitles(s);
            const file = testsFileOf(s);
            if (f.Readiness === 'ready' && !file)
                problems.push(
                    `${where(s)}: a ready scenario needs **Tests:** (the spec file)`
                );
            if (!file) continue;
            mappedFiles.add(file);
            if (!existsSync(join(root, file))) {
                problems.push(`${where(s)}: Tests file ${file} does not exist`);
                continue;
            }
            if (
                settings.headingIsTitle &&
                !readFileSync(join(root, file), 'utf8').startsWith(
                    `// plan: ${planPath}`
                )
            ) {
                problems.push(
                    `${where(s)}: ${file} must start with "// plan: ${planPath}"`
                );
            }
            if (!discovered) continue;
            const tests = discovered.get(file) ?? [];
            for (const title of titles) {
                const test = tests.find((t) => t.title === title);
                if (!test)
                    problems.push(`${where(s)}: no test "${title}" in ${file}`);
                else {
                    covered.set(`${file}\u0000${title}`, f.ID);
                    if (f.Tag && !test.tags.includes(tag))
                        problems.push(
                            `${where(s)}: test "${title}" is tagged ${test.tags.join(' ') || 'nothing'}, the plan says ${tag}`
                        );
                }
            }
        }

        // Every test in a mapped spec must trace back to a scenario
        if (discovered) {
            for (const file of mappedFiles) {
                for (const t of discovered.get(file) ?? []) {
                    if (!covered.has(`${file}\u0000${t.title}`))
                        problems.push(
                            `${planPath}: test "${t.title}" in ${file} has no scenario in the plan`
                        );
                }
            }
        }
        notes.push(
            `${planPath}: ${scenarios.length} scenario(s) on the plan contract${discovered ? ', mapped to discovered tests' : ' (mapping not verified — run with --discover)'}`
        );
    }
    return { problems, notes };
}

/** CLI entry point */
function main() {
    const args = process.argv.slice(2);
    const valueOf = (flag) =>
        args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
    const known = new Set(['--discover', '--discovered', '--root']);
    if (
        args.some((a, i) => a.startsWith('--') && !known.has(a)) ||
        (args.includes('--discovered') && !valueOf('--discovered'))
    ) {
        console.error(
            'usage: node scripts/plan-check.mjs [--discover | --discovered <json>] [--root <dir>]'
        );
        process.exit(2);
    }
    const root = valueOf('--root')
        ? resolve(valueOf('--root'))
        : resolve(dirname(fileURLToPath(import.meta.url)), '..');
    let report;
    if (args.includes('--discover')) {
        const output = execFileSync(
            'npx',
            ['playwright', 'test', '--list', '--reporter=json'],
            {
                cwd: root,
                encoding: 'utf8',
                maxBuffer: 64 * 1024 * 1024,
                stdio: ['ignore', 'pipe', 'ignore'],
            }
        );
        report = JSON.parse(output);
    } else if (valueOf('--discovered')) {
        report = JSON.parse(
            readFileSync(resolve(valueOf('--discovered')), 'utf8')
        );
    }
    const { problems, notes } = check({
        root,
        discovered: report ? discoveredTests(report, root) : undefined,
    });
    for (const note of notes) console.log(`NOTE    ${note}`);
    for (const problem of problems) console.log(`PROBLEM ${problem}`);
    console.log(`\nPlan check: ${problems.length} problem(s).`);
    process.exit(problems.length ? 1 : 0);
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
    main();
