/**
 * Deterministic tests for plan-check.mjs — run with `npm run test:kit`.
 *
 * Each test builds a throwaway repository (profile, plans, specs) in the OS
 * temp folder and a fabricated `--list --reporter=json` report, so nothing
 * runs Playwright or touches the network.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { MARKER, check, checkSource, discoveredTests } from './plan-check.mjs';

let root;

/**
 * Writes a file inside the throwaway repository.
 *
 * @param {string} path - Repository-relative path.
 * @param {string} content - File content.
 */
function put(path, content) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
}

const PROFILE = `---
paths:
    plans: test-plans/shop
tags:
    allowed: ['@smoke', '@regression', '@api']
plans:
    headingIsTitle: true
---
`;

/**
 * A scenario block on the plan contract.
 *
 * @param {object} o - Heading, fields and optional cases.
 * @returns {string} Markdown.
 */
function scenario({
    heading,
    id,
    tag = '@api',
    purpose = 'conformance',
    readiness = 'ready',
    source = 'requirement — API docs, GET /api/products',
    tests = 'tests/shop/api/products.spec.ts',
    extra = '',
    cases = '',
}) {
    return [
        `#### ${heading}`,
        '',
        `**ID:** ${id} · **Tag:** \`${tag}\` · **Priority:** high · **Purpose:** ${purpose} · **Readiness:** ${readiness}`,
        '',
        `**Source:** ${source}`,
        '',
        '**Isolation:** read-only',
        '',
        tests ? `**Tests:** \`${tests}\`` : '',
        '',
        '**Technique:** checklist · **Covers:** the documented answer',
        extra ? `\n${extra}` : '',
        cases ? `\n${cases}` : '',
        '',
        '1. **WHEN** something happens',
        '',
    ].join('\n');
}

const plan = (...scenarios) =>
    `# Products plan\n\n${MARKER}\n\n## Scenarios\n\n${scenarios.join('\n')}\n## Why tests currently fail\n`;

/**
 * A fabricated discovery report for one spec file.
 *
 * @param {Array<[string, string[]]>} tests - Title and tags (without "@").
 * @returns {Map} Discovered tests keyed by repository-relative path.
 */
function discovered(tests, file = 'shop/api/products.spec.ts') {
    const report = {
        config: { rootDir: join(root, 'tests') },
        suites: [
            {
                specs: tests.map(([title, tags]) => ({ file, title, tags })),
                suites: [],
            },
        ],
    };
    return discoveredTests(report, root);
}

const problemsOf = (d) => check({ root, discovered: d }).problems;

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'plan-check-'));
    put('PROJECT-PROFILE.md', PROFILE);
    put(
        'tests/shop/api/products.spec.ts',
        '// plan: test-plans/shop/products.md\n'
    );
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('sources', () => {
    test('each kind needs its details', () => {
        assert.equal(
            checkSource('requirement — API docs, GET /x').kind,
            'requirement'
        );
        assert.match(
            checkSource('decision — the user').problem,
            /who decided and the date/
        );
        assert.equal(
            checkSource('decision — the user (product owner), 2026-10-04')
                .problem,
            undefined
        );
        assert.match(checkSource('observation — live site').problem, /date/);
        assert.equal(
            checkSource(
                'observation — 2026-10-04, live site, the list had 34 products'
            ).problem,
            undefined
        );
        assert.match(checkSource('a guess').problem, /must start with/);
    });
});

describe('a valid plan', () => {
    test('passes, maps every test and notes plans that are not migrated', () => {
        put(
            'test-plans/shop/products.md',
            plan(
                scenario({
                    heading: '1.1 GET /api/products returns every product',
                    id: 'PR-1.1',
                })
            )
        );
        put('test-plans/shop/old.md', '# An old plan\n');
        const { problems, notes } = check({
            root,
            discovered: discovered([
                ['GET /api/products returns every product', ['api']],
            ]),
        });
        assert.deepEqual(problems, []);
        assert.ok(notes.some((n) => n.includes('old.md: not migrated')));
        assert.ok(notes.some((n) => n.includes('mapped to discovered tests')));
    });

    test('a parameterized scenario maps each case to its own test', () => {
        const cases = '**Cases** (`field`):\n\n- `name`\n- `email`';
        put(
            'test-plans/shop/products.md',
            plan(
                scenario({
                    heading:
                        '1.1 POST /api/users without "`<field>`" returns 400',
                    id: 'PR-1.1',
                    cases,
                })
            )
        );
        const d = discovered([
            ['POST /api/users without "name" returns 400', ['api']],
            ['POST /api/users without "email" returns 400', ['api']],
        ]);
        assert.deepEqual(problemsOf(d), []);
    });

    test('several placeholders map case by case, values may contain commas', () => {
        const cases =
            '**Cases** (`field`, `value`):\n\n- `email` · `user@domain,com`\n- `title` · `Dr`';
        put(
            'test-plans/shop/products.md',
            plan(
                scenario({
                    heading:
                        '1.1 POST /api/users with `<field>` "`<value>`" returns 400',
                    id: 'PR-1.1',
                    cases,
                })
            )
        );
        const d = discovered([
            [
                'POST /api/users with email "user@domain,com" returns 400',
                ['api'],
            ],
            ['POST /api/users with title "Dr" returns 400', ['api']],
        ]);
        assert.deepEqual(problemsOf(d), []);
    });

    test('an unresolved expectation blocks only its own scenario', () => {
        put(
            'test-plans/shop/products.md',
            plan(
                scenario({
                    heading: '1.1 GET /api/products returns every product',
                    id: 'PR-1.1',
                }),
                scenario({
                    heading: '1.2 search finds brands',
                    id: 'PR-1.2',
                    readiness: 'needs-clarification',
                    tests: '',
                    extra: '**Blocked by:** does search match brand names? (question to the product owner)',
                })
            )
        );
        const { problems, notes } = check({
            root,
            discovered: discovered([
                ['GET /api/products returns every product', ['api']],
            ]),
        });
        assert.deepEqual(problems, []);
        assert.ok(
            notes.some(
                (n) => n.includes('PR-1.2') && n.includes('needs-clarification')
            )
        );
    });
});

describe('problems', () => {
    test('missing fields and a malformed ID', () => {
        put(
            'test-plans/shop/products.md',
            plan('#### 1.1 bare scenario\n\n**ID:** pr1\n\n1. **WHEN** x\n')
        );
        const problems = problemsOf();
        assert.ok(problems.some((p) => p.includes('missing **Tag:**')));
        assert.ok(problems.some((p) => p.includes('missing **Source:**')));
        assert.ok(problems.some((p) => p.includes('must look like ABC-1')));
    });

    test('an ID used twice across plans', () => {
        put(
            'test-plans/shop/products.md',
            plan(
                scenario({
                    heading: '1.1 GET /api/products returns every product',
                    id: 'PR-1.1',
                })
            )
        );
        put(
            'tests/shop/api/cart.spec.ts',
            '// plan: test-plans/shop/cart.md\n'
        );
        put(
            'test-plans/shop/cart.md',
            plan(
                scenario({
                    heading: '1.1 cart works',
                    id: 'PR-1.1',
                    tests: 'tests/shop/api/cart.spec.ts',
                })
            )
        );
        assert.ok(
            problemsOf().some((p) => p.includes('ID PR-1.1 already used'))
        );
    });

    test('a conformance scenario resting on an observation', () => {
        put(
            'test-plans/shop/products.md',
            plan(
                scenario({
                    heading: '1.1 x',
                    id: 'PR-1.1',
                    source: 'observation — 2026-10-04, live site, it returned 34 products',
                })
            )
        );
        assert.ok(
            problemsOf().some((p) =>
                p.includes('an observation only supports characterization')
            )
        );
    });

    test('a blocked scenario that does not say what blocks it', () => {
        put(
            'test-plans/shop/products.md',
            plan(
                scenario({
                    heading: '1.1 x',
                    id: 'PR-1.1',
                    readiness: 'blocked',
                    tests: '',
                })
            )
        );
        assert.ok(
            problemsOf().some((p) => p.includes('needs **Blocked by:**'))
        );
    });

    test('a tag outside the profile and a tag that differs from the test', () => {
        put(
            'test-plans/shop/products.md',
            plan(
                scenario({
                    heading: '1.1 GET /api/products returns every product',
                    id: 'PR-1.1',
                    tag: '@functional',
                })
            )
        );
        const problems = problemsOf(
            discovered([['GET /api/products returns every product', ['api']]])
        );
        assert.ok(
            problems.some((p) =>
                p.includes('@functional is not in the profile')
            )
        );
        assert.ok(
            problems.some((p) => p.includes('the plan says @functional'))
        );
    });

    test('a heading with no matching test, and a test with no scenario', () => {
        put(
            'test-plans/shop/products.md',
            plan(
                scenario({
                    heading: '1.1 GET /api/products returns every product',
                    id: 'PR-1.1',
                })
            )
        );
        const problems = problemsOf(
            discovered([['GET /api/products returns all products', ['api']]])
        );
        assert.ok(
            problems.some((p) =>
                p.includes('no test "GET /api/products returns every product"')
            )
        );
        assert.ok(
            problems.some((p) => p.includes('has no scenario in the plan'))
        );
    });

    test('placeholders without cases, and a case with the wrong number of values', () => {
        put(
            'test-plans/shop/products.md',
            plan(
                scenario({
                    heading: '1.1 without "`<field>`" returns 400',
                    id: 'PR-1.1',
                }),
                scenario({
                    heading: '1.2 with `<field>` "`<value>`" returns 400',
                    id: 'PR-1.2',
                    cases: '**Cases** (`field`, `value`):\n\n- `email`',
                })
            )
        );
        const problems = problemsOf();
        assert.ok(problems.some((p) => p.includes('no **Cases** list')));
        assert.ok(
            problems.some((p) =>
                p.includes('has 1 value(s), the heading has 2')
            )
        );
    });

    test('a spec that does not point back to its plan', () => {
        put('tests/shop/api/products.spec.ts', 'import x from "y";\n');
        put(
            'test-plans/shop/products.md',
            plan(scenario({ heading: '1.1 x', id: 'PR-1.1' }))
        );
        assert.ok(
            problemsOf().some((p) =>
                p.includes(
                    'must start with "// plan: test-plans/shop/products.md"'
                )
            )
        );
    });
});
