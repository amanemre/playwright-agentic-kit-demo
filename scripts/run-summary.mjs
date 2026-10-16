#!/usr/bin/env node
/**
 * run-summary.mjs — what a test run means for the test plans: one state per
 * planned scenario (INV-11), as a JSON file any tool can read and a Markdown
 * summary people read (a PR comment, a CI job summary, a chat reply).
 *
 * Input: Playwright's JSON report — `--reporter=json` (the file comes from
 * PLAYWRIGHT_JSON_OUTPUT_NAME or the reporter's `outputFile`), or sharded runs
 * merged with `npx playwright merge-reports --reporter=json`. The report is
 * first turned into neutral test records (`fromPlaywright`); an adapter for
 * another test framework only has to produce the same records.
 *
 * Tests map to scenarios by an annotation `{ type: 'scenario', description: '<ID>' }`
 * or, without one, by title within the scenario's spec file — as plan-check maps them.
 *
 *   node scripts/run-summary.mjs --report <json> [--out <dir>] [--fail-on <states>] [--root <dir>]
 *   node scripts/run-summary.mjs --schema        prints the summary's JSON Schema
 *
 * --out defaults to `reports`; the files are run-summary.json and run-summary.md.
 * --fail-on takes a comma-separated list of states (`new` = failed-new,
 * `known` = failed-known); a failing test outside any scenario counts as failed-new.
 * Exit code 0 = written; 1 = something is in a --fail-on state; 2 = usage or input error.
 */
import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod/v4';
import {
    MARKER,
    parseScenarios,
    scenarioTitles,
    testsFileOf,
} from './plan-check.mjs';
import { PROFILE_FILE, splitFrontMatter } from './profile-sync.mjs';

export const SCENARIO_STATES = [
    'passed',
    'unstable',
    'failed-known',
    'failed-new',
    'skipped-na',
    'skipped-defect',
    'skipped-other',
    'blocked',
    'needs-clarification',
    'manual',
    'not-run',
];
export const TEST_STATUSES = ['passed', 'failed', 'unstable', 'skipped'];

const Annotation = z.strictObject({
    type: z.string(),
    description: z.string().optional(),
});

/** A neutral test record — what any framework adapter produces */
export const TestRecord = z.strictObject({
    file: z.string(),
    title: z.string(),
    project: z.string(),
    status: z.enum(TEST_STATUSES),
    retries: z.int().min(0),
    durationMs: z.number().min(0),
    annotations: z.array(Annotation),
    error: z.string().optional(),
    failedSteps: z.array(z.string()).optional(),
    steps: z.array(z.string()).optional(),
});

const Scenario = z.strictObject({
    id: z.string(),
    title: z.string(),
    tag: z.string().optional(),
    priority: z.string().optional(),
    readiness: z.string(),
    state: z.enum(SCENARIO_STATES),
    tests: z.array(TestRecord),
});

export const RunSummary = z.strictObject({
    runSummary: z.literal(1),
    generatedAt: z.string(),
    run: z.strictObject({
        startedAt: z.string().nullable(),
        durationMs: z.number().nullable(),
        playwright: z.string().nullable(),
        projects: z.array(z.string()),
        shard: z.strictObject({ current: z.int(), total: z.int() }).nullable(),
        environment: z.string().nullable(),
    }),
    totals: z.strictObject({
        scenarios: z.record(z.string(), z.int()),
        tests: z.record(z.string(), z.int()),
    }),
    plans: z.array(
        z.strictObject({ plan: z.string(), scenarios: z.array(Scenario) })
    ),
    setup: z.array(TestRecord),
    unplanned: z.array(TestRecord),
});

/**
 * Reads the profile front matter; a missing or unreadable profile yields {}.
 *
 * @param {string} root - Repository root.
 * @returns {Record<string, any>} The profile.
 */
function readProfile(root) {
    try {
        return (
            parseYaml(
                splitFrontMatter(readFileSync(join(root, PROFILE_FILE), 'utf8'))
                    .yaml
            ) ?? {}
        );
    } catch {
        return {};
    }
}

// Built from the escape character's code, so the source holds no control character
const ANSI_COLOURS = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

/**
 * The first lines of an error message, without colour codes or secret values.
 *
 * @param {string | undefined} message - Raw message.
 * @param {string[]} secrets - Values to replace with `***`.
 * @returns {string | undefined} A short, safe message.
 */
export function shortError(message, secrets = []) {
    if (!message) return undefined;
    let text = message.replace(ANSI_COLOURS, '');
    for (const secret of secrets) text = text.split(secret).join('***');
    const lines = text
        .split('\n')
        .map((l) => l.trimEnd())
        .filter(Boolean)
        .slice(0, 3);
    const short = lines.join('\n');
    return short.length > 500 ? `${short.slice(0, 497)}...` : short;
}

/**
 * Neutral test records from Playwright's JSON report.
 *
 * @param {object} report - The parsed JSON report.
 * @param {string} root - Repository root.
 * @param {string[]} [secrets] - Values to keep out of error messages.
 * @returns {Array<z.infer<typeof TestRecord>>} One record per test and project.
 */
export function fromPlaywright(report, root, secrets = []) {
    const rootDir = report.config?.rootDir ?? root;
    const records = [];
    const walk = (suite) => {
        for (const spec of suite.specs ?? []) {
            const local = relative(root, join(rootDir, spec.file))
                .split(sep)
                .join('/');
            // A report from another machine: keep the path as the report has it
            const file = local.startsWith('..') ? spec.file : local;
            for (const test of spec.tests ?? []) {
                const results = test.results ?? [];
                const status =
                    test.status === 'flaky'
                        ? 'unstable'
                        : test.status === 'skipped'
                          ? 'skipped'
                          : test.status === 'expected' &&
                              test.expectedStatus === 'passed'
                            ? 'passed'
                            : test.status === 'expected' &&
                                test.expectedStatus === 'skipped'
                              ? 'skipped'
                              : 'failed'; // unexpected, or a test.fail() that "passed": the product still fails (INV-02)
                const annotations = [];
                for (const a of [
                    ...(test.annotations ?? []),
                    ...results.flatMap((r) => r.annotations ?? []),
                ]) {
                    if (
                        !annotations.some(
                            (b) =>
                                b.type === a.type &&
                                b.description === a.description
                        )
                    )
                        annotations.push(
                            a.description === undefined
                                ? { type: a.type }
                                : { type: a.type, description: a.description }
                        );
                }
                const failing = [...results]
                    .reverse()
                    .find((r) => r.errors?.length || r.error);
                const error =
                    status === 'failed' || status === 'unstable'
                        ? shortError(
                              failing?.errors?.[0]?.message ??
                                  failing?.error?.message,
                              secrets
                          )
                        : undefined;
                // The report's own words: the GIVEN / WHEN / THEN / AND steps that failed
                const failedSteps =
                    error && failing
                        ? (failing.steps ?? [])
                              .filter((step) => step.error)
                              .map((step) => step.title)
                        : [];
                // Every step of the failing attempt, in order — the steps to reproduce
                const steps =
                    error && failing
                        ? (failing.steps ?? []).map((step) => step.title)
                        : [];
                records.push({
                    file,
                    title: spec.title,
                    project: test.projectName ?? '',
                    status,
                    retries: Math.max(0, results.length - 1),
                    durationMs: results.reduce(
                        (sum, r) => sum + (r.duration ?? 0),
                        0
                    ),
                    annotations,
                    ...(error ? { error } : {}),
                    ...(failedSteps.length ? { failedSteps } : {}),
                    ...(steps.length ? { steps } : {}),
                });
            }
        }
        for (const child of suite.suites ?? []) walk(child);
    };
    for (const suite of report.suites ?? []) walk(suite);
    return records;
}

/**
 * The scenario numbers and IDs a plan lists under "Why tests currently fail"
 * (its table's Scenarios column, and any scenario ID in the section).
 *
 * @param {string} text - The plan's Markdown.
 * @param {string[]} ids - The plan's scenario IDs.
 * @returns {Set<string>} Known-failure tokens.
 */
export function knownFailures(text, ids) {
    const lines = text.split('\n');
    const start = lines.findIndex((l) =>
        /^## Why tests currently fail\s*$/.test(l)
    );
    if (start < 0) return new Set();
    const end = lines.findIndex((l, i) => i > start && /^## /.test(l));
    const section = lines.slice(start + 1, end < 0 ? undefined : end);
    const tokens = new Set();
    const cells = (row) =>
        row
            .trim()
            .replace(/^\||\|$/g, '')
            .split('|')
            .map((c) => c.trim());
    const header = section.findIndex(
        (l) => l.trim().startsWith('|') && cells(l).includes('Scenarios')
    );
    if (header >= 0) {
        const column = cells(section[header]).indexOf('Scenarios');
        for (const row of section.slice(header + 2)) {
            if (!row.trim().startsWith('|')) break;
            for (const token of (cells(row)[column] ?? '').split(/[\s,;]+/))
                if (token) tokens.add(token.replace(/^`|`$/g, ''));
        }
    }
    const body = section.join('\n');
    for (const id of ids) if (body.includes(id)) tokens.add(id);
    return tokens;
}

/** Whether a record's file and a plan's Tests file are the same spec */
const sameFile = (recordFile, planFile) =>
    recordFile === planFile ||
    planFile.endsWith(`/${recordFile}`) ||
    recordFile.endsWith(`/${planFile}`);

/**
 * The state of one scenario from its tests in this run.
 *
 * @param {Array<z.infer<typeof TestRecord>>} tests - The scenario's tests.
 * @param {string} readiness - The plan's readiness for it.
 * @param {boolean} known - Whether the plan lists it as a known failure.
 * @returns {string} One of SCENARIO_STATES.
 */
export function scenarioState(tests, readiness, known) {
    if (tests.length === 0)
        return readiness && readiness !== 'ready' ? readiness : 'not-run';
    if (tests.some((t) => t.status === 'failed'))
        return known ? 'failed-known' : 'failed-new';
    if (tests.some((t) => t.status === 'unstable')) return 'unstable';
    if (tests.every((t) => t.status === 'skipped')) {
        if (tests.some((t) => t.annotations.some((a) => a.type === 'defect')))
            return 'skipped-defect';
        const reasons = tests.map(
            (t) =>
                t.annotations.find((a) => a.type === 'skip')?.description ?? ''
        );
        return reasons.every((r) => /^n\/a:/.test(r.trim()))
            ? 'skipped-na'
            : 'skipped-other';
    }
    return 'passed';
}

/**
 * Builds the run summary.
 *
 * @param {{ root: string, records: Array<z.infer<typeof TestRecord>>, report?: object, profile?: Record<string, any>, now?: string }} options - Inputs.
 * @returns {z.infer<typeof RunSummary>} The validated summary.
 */
export function summarize({ root, records, report = {}, profile, now }) {
    profile ??= readProfile(root);
    const plansDir = profile.paths?.plans;
    const plans = [];
    if (plansDir && existsSync(join(root, plansDir))) {
        for (const name of readdirSync(join(root, plansDir))
            .filter((n) => n.endsWith('.md'))
            .sort()) {
            const path = `${plansDir.replace(/\/$/, '')}/${name}`;
            const text = readFileSync(join(root, path), 'utf8');
            if (!text.includes(MARKER)) continue;
            const scenarios = parseScenarios(text).filter((s) => s.fields.ID);
            plans.push({
                path,
                known: knownFailures(
                    text,
                    scenarios.map((s) => s.fields.ID)
                ),
                scenarios,
            });
        }
    }

    const setup = [];
    const unplanned = [];
    const byScenario = new Map(); // "plan\0ID" → records
    for (const record of records) {
        if (/\.setup\.[cm]?[jt]s$/.test(record.file)) {
            setup.push(record);
            continue;
        }
        const id = record.annotations.find(
            (a) => a.type === 'scenario'
        )?.description;
        let key;
        for (const plan of plans) {
            const s = plan.scenarios.find((s) =>
                id
                    ? s.fields.ID === id
                    : testsFileOf(s) &&
                      sameFile(record.file, testsFileOf(s)) &&
                      scenarioTitles(s).includes(record.title)
            );
            if (s) {
                key = `${plan.path}\u0000${s.fields.ID}`;
                break;
            }
        }
        if (!key) unplanned.push(record);
        else byScenario.set(key, [...(byScenario.get(key) ?? []), record]);
    }

    const scenarioTotals = {};
    const outPlans = plans.map((plan) => ({
        plan: plan.path,
        scenarios: plan.scenarios.map((s) => {
            const tests =
                byScenario.get(`${plan.path}\u0000${s.fields.ID}`) ?? [];
            const readiness = s.fields.Readiness ?? 'ready';
            const state = scenarioState(
                tests,
                readiness,
                plan.known.has(s.fields.ID) ||
                    (s.number !== undefined && plan.known.has(s.number))
            );
            scenarioTotals[state] = (scenarioTotals[state] ?? 0) + 1;
            return {
                id: s.fields.ID,
                title: s.heading,
                ...(s.fields.Tag
                    ? { tag: s.fields.Tag.replace(/`/g, '') }
                    : {}),
                ...(s.fields.Priority ? { priority: s.fields.Priority } : {}),
                readiness,
                state,
                tests,
            };
        }),
    }));
    const testTotals = {};
    for (const r of records)
        testTotals[r.status] = (testTotals[r.status] ?? 0) + 1;

    const selector = profile.env?.selector;
    const shard = report.config?.shard;
    return RunSummary.parse({
        runSummary: 1,
        generatedAt: now ?? new Date().toISOString(),
        run: {
            startedAt: report.stats?.startTime ?? null,
            durationMs: report.stats?.duration ?? null,
            playwright: report.config?.version ?? null,
            projects: [
                ...new Set((report.config?.projects ?? []).map((p) => p.name)),
            ],
            shard: shard
                ? { current: shard.current, total: shard.total }
                : null,
            environment:
                (selector && process.env[selector]) ||
                profile.env?.default ||
                null,
        },
        totals: { scenarios: scenarioTotals, tests: testTotals },
        plans: outPlans,
        setup,
        unplanned,
    });
}

/**
 * States in the summary that match the --fail-on list.
 *
 * @param {z.infer<typeof RunSummary>} summary - The summary.
 * @param {string[]} states - Scenario states (aliases `new`, `known`).
 * @returns {string[]} What matched, one line each.
 */
export function failing(summary, states) {
    const alias = { new: 'failed-new', known: 'failed-known' };
    const wanted = new Set(states.map((s) => alias[s] ?? s));
    const hits = [];
    for (const plan of summary.plans)
        for (const s of plan.scenarios)
            if (wanted.has(s.state))
                hits.push(`${s.state}: ${s.id} ${s.title}`);
    for (const t of [...summary.setup, ...summary.unplanned]) {
        const state =
            t.status === 'failed'
                ? 'failed-new'
                : t.status === 'unstable'
                  ? 'unstable'
                  : undefined;
        if (state && wanted.has(state))
            hits.push(`${state}: ${t.file} › ${t.title}`);
    }
    return hits;
}

const cell = (text) =>
    String(text ?? '')
        .replace(/\|/g, '\\|')
        .replace(/\n/g, ' ');

/** The note shown next to a scenario or test */
function noteOf(tests) {
    const failed = tests.find((t) => t.error);
    if (failed) {
        // Skip a generic matcher line ("expect(received).toBe(expected)") when details follow
        const lines = failed.error.split('\n');
        const detail = (lines.length > 1 ? lines.slice(1) : lines).join(' · ');
        return failed.failedSteps?.length
            ? `${failed.failedSteps.join('; ')} — ${detail}`
            : detail;
    }
    const defect = tests
        .flatMap((t) => t.annotations)
        .find((a) => a.type === 'defect');
    if (defect) return `defect ${defect.description ?? ''}`.trim();
    const skip = tests
        .flatMap((t) => t.annotations)
        .find((a) => a.type === 'skip' && a.description);
    return skip?.description ?? '';
}

/**
 * The summary as Markdown.
 *
 * @param {z.infer<typeof RunSummary>} summary - The summary.
 * @returns {string} Markdown.
 */
export function toMarkdown(summary) {
    const { run } = summary;
    const out = ['# Run summary', ''];
    const facts = [
        run.startedAt,
        run.durationMs !== null
            ? `${(run.durationMs / 1000).toFixed(1)} s`
            : null,
        run.playwright ? `Playwright ${run.playwright}` : null,
        run.projects.length ? `projects: ${run.projects.join(', ')}` : null,
        run.shard ? `shard ${run.shard.current}/${run.shard.total}` : null,
        run.environment ? `environment: ${run.environment}` : null,
    ].filter(Boolean);
    if (facts.length) out.push(facts.join(' · '), '');

    const counts = Object.entries(summary.totals.scenarios);
    if (counts.length) {
        out.push('| State | Scenarios |', '| --- | --- |');
        for (const state of SCENARIO_STATES)
            if (summary.totals.scenarios[state])
                out.push(`| ${state} | ${summary.totals.scenarios[state]} |`);
        out.push('');
    }
    out.push(
        `Tests: ${TEST_STATUSES.map((s) => `${summary.totals.tests[s] ?? 0} ${s}`).join(' · ')}`,
        ''
    );

    const confirm = [
        ...summary.plans.flatMap((p) =>
            p.scenarios
                .filter((s) => s.state === 'failed-new')
                .map((s) => `- \`${s.id}\` ${s.title} — ${noteOf(s.tests)}`)
        ),
        ...[...summary.setup, ...summary.unplanned]
            .filter((t) => t.status === 'failed')
            .map((t) => `- ${t.file} › ${t.title} — ${noteOf([t])}`),
    ];
    if (confirm.length)
        out.push(
            '## Needs confirmation',
            '',
            'New failures — a product defect joins the plan only after the user confirms it (INV-11):',
            '',
            ...confirm,
            ''
        );

    for (const plan of summary.plans) {
        out.push(
            `## ${plan.plan}`,
            '',
            '| ID | Scenario | State | Tests | Note |',
            '| --- | --- | --- | --- | --- |'
        );
        for (const s of plan.scenarios)
            out.push(
                `| ${cell(s.id)} | ${cell(s.title)} | ${s.state} | ${s.tests.length} | ${cell(noteOf(s.tests))} |`
            );
        out.push('');
    }
    for (const [heading, tests] of [
        ['Setup', summary.setup.filter((t) => t.status !== 'passed')],
        ['Tests without a scenario', summary.unplanned],
    ]) {
        if (!tests.length) continue;
        out.push(
            `## ${heading}`,
            '',
            '| File | Test | Project | Status | Note |',
            '| --- | --- | --- | --- | --- |',
            ...tests.map(
                (t) =>
                    `| ${cell(t.file)} | ${cell(t.title)} | ${cell(t.project)} | ${t.status} | ${cell(noteOf([t]))} |`
            ),
            ''
        );
    }
    return out.join('\n');
}

/** CLI entry point */
function main() {
    const args = process.argv.slice(2);
    const valueOf = (flag) =>
        args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
    if (args.includes('--schema')) {
        console.log(JSON.stringify(z.toJSONSchema(RunSummary), null, 2));
        return;
    }
    const known = new Set(['--report', '--out', '--fail-on', '--root']);
    const reportPath = valueOf('--report');
    if (!reportPath || args.some((a) => a.startsWith('--') && !known.has(a))) {
        console.error(
            'usage: node scripts/run-summary.mjs --report <playwright json> [--out <dir>] [--fail-on <states>] [--root <dir>] | --schema'
        );
        process.exit(2);
    }
    const root = valueOf('--root')
        ? resolve(valueOf('--root'))
        : resolve(dirname(fileURLToPath(import.meta.url)), '..');
    let report;
    try {
        report = JSON.parse(readFileSync(resolve(reportPath), 'utf8'));
    } catch (error) {
        console.error(`Cannot read the report ${reportPath}: ${error.message}`);
        process.exit(2);
    }
    const profile = readProfile(root);
    const secrets = (profile.env?.credentials ?? [])
        .map((name) => process.env[name])
        .filter((value) => value && value.length >= 4);
    const summary = summarize({
        root,
        records: fromPlaywright(report, root, secrets),
        report,
        profile,
    });
    const out = resolve(root, valueOf('--out') ?? 'reports');
    mkdirSync(out, { recursive: true });
    writeFileSync(
        join(out, 'run-summary.json'),
        `${JSON.stringify(summary, null, 2)}\n`
    );
    writeFileSync(join(out, 'run-summary.md'), toMarkdown(summary));
    const totals = Object.entries(summary.totals.scenarios)
        .map(([state, n]) => `${n} ${state}`)
        .join(', ');
    console.log(
        `Run summary: ${totals || 'no planned scenarios'}; ${summary.unplanned.length} test(s) without a scenario → ${relative(process.cwd(), join(out, 'run-summary.md'))}`
    );
    const failOn = valueOf('--fail-on');
    if (failOn) {
        const hits = failing(summary, failOn.split(','));
        for (const hit of hits) console.log(`FAIL-ON ${hit}`);
        if (hits.length) process.exit(1);
    }
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
    main();
