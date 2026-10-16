/**
 * Deterministic tests for run-summary.mjs — run with `npm run test:kit`.
 * Each test builds a throwaway repository (profile, plan, spec files) in the
 * OS temp folder and a synthetic Playwright JSON report shaped like a real one.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { z } from 'zod/v4';
import {
    failing,
    fromPlaywright,
    knownFailures,
    RunSummary,
    shortError,
    summarize,
    toMarkdown,
} from './run-summary.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'run-summary.mjs');
const SPEC = 'tests/shop/cart.spec.ts';

const scenario = (
    number,
    title,
    id,
    { readiness = 'ready', tests = true, cases } = {}
) =>
    [
        `#### ${number} ${title}`,
        '',
        `**ID:** ${id} · **Tag:** \`@regression\` · **Priority:** high · **Purpose:** conformance · **Readiness:** ${readiness}`,
        '',
        ...(tests ? [`**Tests:** \`${SPEC}\``, ''] : []),
        ...(cases
            ? [
                  '**Cases** (`quantity`):',
                  '',
                  ...cases.map((c) => `- \`${c}\``),
                  '',
              ]
            : []),
    ].join('\n');

const PLAN = [
    '# Cart — Test Plan',
    '',
    '<!-- plan-contract: 1 -->',
    '',
    '## Scenarios',
    '',
    '### 1. Cart',
    '',
    scenario('1.1', 'the cart shows the added product', 'CART-1.1'),
    scenario('1.2', 'quantity <quantity> is rejected', 'CART-1.2', {
        cases: ['0', '100'],
    }),
    scenario('1.3', 'the total includes the discount', 'CART-1.3'),
    scenario('1.4', 'a coupon code is accepted', 'CART-1.4'),
    scenario('1.5', 'checkout opens', 'CART-1.5'),
    scenario('1.6', 'a receipt can be uploaded', 'CART-1.6'),
    scenario('1.7', 'tax is shown per line', 'CART-1.7'),
    scenario('1.8', 'gift wrap can be added', 'CART-1.8', {
        readiness: 'blocked',
        tests: false,
    }),
    scenario('1.9', 'an order can be repeated', 'CART-1.9'),
    scenario('1.10', 'the mini cart shows the count', 'CART-1.10'),
    '## Why tests currently fail',
    '',
    '| Behaviour of the live app | Failing lines | Scenarios |',
    '| ------------------------- | ------------- | --------- |',
    '| the discount is ignored   | THEN total    | 1.3       |',
    '',
    '## Not covered here',
    '',
].join('\n');

const failedResult = (
    message = 'Error: boom\nExpected: 1\nReceived: 2',
    steps = []
) => ({
    status: 'failed',
    duration: 20,
    retry: 0,
    errors: [{ message }],
    steps,
});
const passedResult = (retry = 0) => ({
    status: 'passed',
    duration: 10,
    retry,
    errors: [],
    steps: [],
});

/** One spec entry of a Playwright JSON report */
const spec = (file, title, test) => ({
    title,
    file,
    tags: [],
    tests: [
        {
            projectName: 'chromium',
            expectedStatus: 'passed',
            annotations: [],
            results: [passedResult()],
            status: 'expected',
            ...test,
        },
    ],
});

const report = (specs, rootDir) => ({
    config: {
        rootDir,
        version: '1.62.1',
        projects: [{ name: 'setup' }, { name: 'chromium' }],
        shard: null,
    },
    suites: [{ title: 'cart.spec.ts', specs }],
    stats: { startTime: '2026-10-10T10:00:00.000Z', duration: 1234 },
});

const SPECS = [
    spec('shop/cart.spec.ts', 'the cart shows the added product', {}),
    spec('shop/cart.spec.ts', 'quantity 0 is rejected', {}),
    spec('shop/cart.spec.ts', 'quantity 100 is rejected', {}),
    spec('shop/cart.spec.ts', 'the total includes the discount', {
        status: 'unexpected',
        results: [failedResult()],
    }),
    spec('shop/cart.spec.ts', 'a coupon code is accepted', {
        status: 'unexpected',
        results: [
            failedResult(
                'Error: expect(received).toBe(expected)\nExpected: 200\nReceived: 500',
                [
                    { title: 'WHEN the code is applied', steps: [] },
                    {
                        title: 'THEN the total drops',
                        error: { message: 'x' },
                        steps: [],
                    },
                ]
            ),
        ],
    }),
    spec('shop/cart.spec.ts', 'checkout opens', {
        status: 'flaky',
        results: [failedResult(), passedResult(1)],
    }),
    spec('shop/cart.spec.ts', 'a receipt can be uploaded', {
        status: 'skipped',
        expectedStatus: 'skipped',
        annotations: [
            { type: 'skip', description: 'n/a: no file upload on WebKit' },
        ],
        results: [
            { status: 'skipped', duration: 0, retry: 0, errors: [], steps: [] },
        ],
    }),
    spec('shop/cart.spec.ts', 'tax is shown per line', {
        status: 'skipped',
        expectedStatus: 'skipped',
        annotations: [
            { type: 'skip' },
            { type: 'defect', description: 'BUG-7 — tax missing' },
        ],
        results: [],
    }),
    spec('shop/cart.spec.ts', 'the header badge counts items', {
        annotations: [{ type: 'scenario', description: 'CART-1.10' }],
    }),
    spec('shop/cart.spec.ts', 'an old test nobody planned', {}),
    spec('shop/auth.setup.ts', 'log in', {}),
];

let root;
const profile = (extra = {}) => ({
    paths: { plans: 'test-plans/shop', tests: 'tests/shop' },
    env: {
        selector: 'TEST_ENV',
        default: 'dev',
        credentials: ['SHOP_PASSWORD'],
    },
    ...extra,
});
const put = (path, content) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
};
const build = (specs = SPECS, rootDir = join(root, 'tests'), p = profile()) =>
    summarize({
        root,
        report: report(specs, rootDir),
        records: fromPlaywright(report(specs, rootDir), root),
        profile: p,
        now: '2026-10-10T10:05:00.000Z',
    });
const states = (summary) =>
    Object.fromEntries(summary.plans[0].scenarios.map((s) => [s.id, s.state]));

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'run-summary-'));
    put('test-plans/shop/cart.md', PLAN);
    put(SPEC, '// plan: test-plans/shop/cart.md\n');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('scenario states', () => {
    test('every state, by title, by case and by annotation', () => {
        assert.deepEqual(states(build()), {
            'CART-1.1': 'passed',
            'CART-1.2': 'passed',
            'CART-1.3': 'failed-known',
            'CART-1.4': 'failed-new',
            'CART-1.5': 'unstable',
            'CART-1.6': 'skipped-na',
            'CART-1.7': 'skipped-defect',
            'CART-1.8': 'blocked',
            'CART-1.9': 'not-run',
            'CART-1.10': 'passed',
        });
        const summary = build();
        assert.equal(summary.plans[0].scenarios[1].tests.length, 2); // both cases
        assert.deepEqual(
            summary.unplanned.map((t) => t.title),
            ['an old test nobody planned']
        );
        assert.deepEqual(
            summary.setup.map((t) => t.title),
            ['log in']
        );
        assert.equal(summary.totals.scenarios.passed, 3);
        assert.equal(summary.totals.tests.failed, 2);
        assert.equal(summary.totals.tests.unstable, 1);
    });

    test('a report from another machine maps by path suffix', () => {
        assert.equal(
            states(build(SPECS, '/ci/runner/repo/tests'))['CART-1.1'],
            'passed'
        );
    });

    test('a known failure is matched by scenario number or ID, only in its section', () => {
        const tokens = knownFailures(PLAN, ['CART-1.3', 'CART-1.4']);
        assert.ok(tokens.has('1.3'));
        assert.ok(!tokens.has('1.4') && !tokens.has('CART-1.4'));
        assert.ok(
            knownFailures(
                '## Why tests currently fail\n\nCART-1.4 fails: the API is down.\n',
                ['CART-1.4']
            ).has('CART-1.4')
        );
    });

    test('without a profile or plans every test is unplanned', () => {
        const summary = build(SPECS, join(root, 'tests'), {});
        assert.deepEqual(summary.plans, []);
        assert.equal(summary.unplanned.length, SPECS.length - 1);
        assert.match(toMarkdown(summary), /## Tests without a scenario/);
    });
});

describe('errors', () => {
    test('colour codes and credential values are removed; failed steps are named', () => {
        assert.equal(
            shortError(
                '\u001b[31mError: login as hunter22 failed\u001b[39m\nline 2\nline 3\nline 4',
                ['hunter22']
            ),
            'Error: login as *** failed\nline 2\nline 3'
        );
        const coupon = build().plans[0].scenarios[3].tests[0];
        assert.deepEqual(coupon.failedSteps, ['THEN the total drops']);
        assert.deepEqual(coupon.steps, [
            'WHEN the code is applied',
            'THEN the total drops',
        ]);
        assert.match(
            toMarkdown(build()),
            /THEN the total drops — Expected: 200 · Received: 500/
        );
    });
});

describe('output', () => {
    test('the summary satisfies its schema, and the JSON Schema is produced', () => {
        assert.ok(RunSummary.parse(build()));
        const schema = z.toJSONSchema(RunSummary);
        assert.equal(schema.properties.runSummary.const, 1);
    });

    test('new failures need confirmation; fail-on matches states, aliases and unplanned failures', () => {
        const summary = build();
        assert.match(
            toMarkdown(summary),
            /## Needs confirmation[\s\S]*CART-1\.4/
        );
        assert.deepEqual(failing(summary, ['new']), [
            'failed-new: CART-1.4 a coupon code is accepted',
        ]);
        assert.equal(failing(summary, ['known', 'unstable']).length, 2);
        const withUnplannedFailure = build([
            ...SPECS,
            spec('shop/cart.spec.ts', 'another unplanned test', {
                status: 'unexpected',
                results: [failedResult()],
            }),
        ]);
        assert.equal(failing(withUnplannedFailure, ['new']).length, 2);
    });

    test('the CLI writes both files and exits 1 for a --fail-on state', () => {
        put(
            'PROJECT-PROFILE.md',
            '---\npaths:\n    plans: test-plans/shop\n---\n'
        );
        put(
            'reports/results.json',
            JSON.stringify(report(SPECS, join(root, 'tests')))
        );
        const run = (extra) =>
            spawnSync(
                process.execPath,
                [
                    SCRIPT,
                    '--root',
                    root,
                    '--report',
                    join(root, 'reports/results.json'),
                    ...extra,
                ],
                { encoding: 'utf8' }
            );
        assert.equal(run([]).status, 0);
        assert.equal(
            JSON.parse(
                readFileSync(join(root, 'reports/run-summary.json'), 'utf8')
            ).runSummary,
            1
        );
        assert.match(
            readFileSync(join(root, 'reports/run-summary.md'), 'utf8'),
            /^# Run summary/
        );
        const failed = run(['--fail-on', 'new']);
        assert.equal(failed.status, 1);
        assert.match(failed.stdout, /FAIL-ON failed-new: CART-1\.4/);
        assert.equal(run(['--bogus']).status, 2);
    });
});
