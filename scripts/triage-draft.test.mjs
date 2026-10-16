/**
 * Deterministic tests for triage-draft.mjs — run with `npm run test:kit`.
 * A hand-written run summary and a throwaway repository with one plan.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { renderDefect, triageItems, writeDrafts } from './triage-draft.mjs';

const SCRIPT = join(
    dirname(fileURLToPath(import.meta.url)),
    'triage-draft.mjs'
);
const PLAN = 'test-plans/shop/cart.md';

const record = (title, status, extra = {}) => ({
    file: 'tests/shop/cart.spec.ts',
    title,
    project: 'chromium',
    status,
    retries: 0,
    durationMs: 10,
    annotations: [],
    ...extra,
});
const failure = (title) =>
    record(title, 'failed', {
        error: 'Error: expect(received).toBe(expected)\nExpected: 200\nReceived: 500',
        failedSteps: ['THEN the total drops'],
        steps: [
            'GIVEN a cart with one product',
            'WHEN the code is applied',
            'THEN the total drops',
        ],
    });
const scenario = (id, title, state, tests) => ({
    id,
    title,
    readiness: 'ready',
    state,
    tests,
});

const summary = () => ({
    runSummary: 1,
    run: { environment: 'staging' },
    plans: [
        {
            plan: PLAN,
            scenarios: [
                scenario(
                    'CART-1.1',
                    'the cart shows the added product',
                    'passed',
                    [record('the cart shows the added product', 'passed')]
                ),
                scenario(
                    'CART-1.3',
                    'the total includes the discount',
                    'failed-known',
                    [failure('the total includes the discount')]
                ),
                scenario(
                    'CART-1.4',
                    'a coupon code is accepted',
                    'failed-new',
                    [failure('a coupon code is accepted')]
                ),
                scenario('CART-1.5', 'checkout opens', 'unstable', [
                    record('checkout opens', 'unstable', {
                        retries: 1,
                        error: 'Error: timeout',
                    }),
                ]),
            ],
        },
    ],
    setup: [record('log in', 'passed')],
    unplanned: [
        record('an old test nobody planned', 'failed', {
            error: 'Error: boom',
        }),
    ],
});

let root;
beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'triage-draft-'));
    mkdirSync(join(root, 'test-plans/shop'), { recursive: true });
    writeFileSync(
        join(root, PLAN),
        [
            '# Cart',
            '',
            '<!-- plan-contract: 1 -->',
            '',
            '## Scenarios',
            '',
            '#### 1.4 a coupon code is accepted',
            '',
            '**ID:** CART-1.4 · **Readiness:** ready',
            '',
            '**Source:** requirement — SHOP-142, criterion 3',
            '',
        ].join('\n')
    );
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('what needs triage', () => {
    test('new failures, unstable scenarios and failing tests without a scenario — not known failures or passes', () => {
        assert.deepEqual(
            triageItems(summary()).map((i) => [
                i.kind,
                i.state,
                i.id ?? i.title,
            ]),
            [
                ['scenario', 'failed-new', 'CART-1.4'],
                ['scenario', 'unstable', 'CART-1.5'],
                [
                    'test',
                    'failed-new',
                    'tests/shop/cart.spec.ts › an old test nobody planned',
                ],
            ]
        );
    });
});

describe('drafts', () => {
    test('a triage report with every item undecided, and a defect draft only for a new failure of a scenario', () => {
        const written = writeDrafts({
            root,
            summary: summary(),
            out: join(root, 'reports'),
            commit: 'abc1234567890',
            date: '2026-10-11',
        });
        assert.deepEqual(written, [
            'reports/triage.md',
            'reports/defect-CART-1.4.md',
        ]);
        const triage = readFileSync(join(root, 'reports/triage.md'), 'utf8');
        assert.match(
            triage,
            /^# Triage \(draft\) — commit abc1234567, 2026-10-11/
        );
        assert.equal(triage.match(/\| to decide \| to decide \|/g).length, 3);
        assert.match(
            triage,
            /THEN the total drops — Expected: 200 · Received: 500/
        );
        assert.match(triage, /passed only on a retry \(1\)/);
        assert.match(triage, /no scenario covers this test/);
        assert.ok(!triage.includes('CART-1.3'));
    });

    test('the defect draft says it is a draft, lists the steps, marks the failing one and cites the plan', () => {
        const [item] = triageItems(summary());
        const draft = renderDefect(summary(), item, {
            commit: 'abc1234',
            source: 'requirement — SHOP-142, criterion 3',
        });
        assert.match(draft, /^> \*\*DRAFT — not confirmed\.\*\*/);
        assert.match(
            draft,
            /1\. GIVEN a cart with one product\n2\. WHEN the code is applied\n3\. THEN the total drops {2}← fails here/
        );
        assert.match(
            draft,
            /## Expected\n\nTHEN the total drops — source: requirement — SHOP-142, criterion 3/
        );
        assert.match(draft, /## Actual\n\nExpected: 200\nReceived: 500/);
        assert.match(
            draft,
            /- Environment: staging\n- Build or commit: abc1234\n- Browser \/ project: chromium/
        );
        assert.match(
            draft,
            /- Scenario: CART-1\.4 a coupon code is accepted\n- Spec: tests\/shop\/cart\.spec\.ts › a coupon code is accepted\n- Plan: test-plans\/shop\/cart\.md/
        );
    });

    test('the plan supplies the source; a clean run writes nothing', () => {
        writeDrafts({
            root,
            summary: summary(),
            out: join(root, 'reports'),
            commit: 'abc',
        });
        assert.match(
            readFileSync(join(root, 'reports/defect-CART-1.4.md'), 'utf8'),
            /source: requirement — SHOP-142, criterion 3/
        );
        const clean = summary();
        clean.plans[0].scenarios = clean.plans[0].scenarios.slice(0, 2);
        clean.unplanned = [];
        assert.deepEqual(
            writeDrafts({ root, summary: clean, out: join(root, 'clean') }),
            []
        );
        assert.ok(!existsSync(join(root, 'clean')));
    });

    test('the CLI reads the run summary and reports what it wrote', () => {
        mkdirSync(join(root, 'reports'), { recursive: true });
        writeFileSync(
            join(root, 'reports/run-summary.json'),
            JSON.stringify(summary())
        );
        const run = spawnSync(process.execPath, [SCRIPT, '--root', root], {
            encoding: 'utf8',
        });
        assert.equal(run.status, 0);
        assert.match(
            run.stdout,
            /Triage draft: reports\/triage\.md, reports\/defect-CART-1\.4\.md/
        );
        assert.equal(
            spawnSync(process.execPath, [
                SCRIPT,
                '--root',
                root,
                '--summary',
                'missing.json',
            ]).status,
            2
        );
    });
});
