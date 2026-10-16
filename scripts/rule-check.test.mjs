/**
 * Deterministic tests for rule-check.mjs — run with `npm run test:kit`.
 * Profiles are plain objects; the dependency and hook tests build a
 * throwaway repository in the OS temp folder.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { END, START } from './profile-sync.mjs';
import {
    checkContent,
    hookViolations,
    leaks,
    undeclaredDependencies,
} from './rule-check.mjs';

/** The preset as this repository configures it */
const preset = (changes = {}) => ({
    paths: {
        tests: 'tests/shop',
        testEntry: 'fixtures/fixtures.ts',
        pageObjects: 'pages/shop',
        components: 'pages/components',
        schemas: 'fixtures/api/schemas/shop',
        staticData: 'test-data/static/shop',
    },
    validation: { library: 'zod', unknownFieldPolicy: 'strict' },
    tags: { allowed: ['@smoke', '@regression', '@api'], perTest: 1 },
    data: { staticFormat: 'ts-as-const' },
    overrides: [],
    ...changes,
});

const ids = (violations) => violations.map((v) => /^\[([\w-]+)/.exec(v)[1]);

describe('rules with the preset', () => {
    test('a spec importing from @playwright/test', () => {
        assert.deepEqual(
            ids(
                checkContent(
                    preset(),
                    'tests/shop/a.spec.ts',
                    "import { test } from '@playwright/test';"
                )
            ),
            ['test-entry-import']
        );
        assert.deepEqual(
            checkContent(
                preset(),
                'tests/shop/a.spec.ts',
                "import { test } from '../../fixtures/fixtures';"
            ),
            []
        );
        assert.deepEqual(
            checkContent(
                preset(),
                'pages/shop/a.page.ts',
                "import { Page } from '@playwright/test';"
            ),
            []
        );
    });

    test('hard waits anywhere in TypeScript', () => {
        assert.deepEqual(
            ids(
                checkContent(
                    preset(),
                    'helpers/x.ts',
                    'await page.waitForTimeout(500);'
                )
            ),
            ['no-hard-wait']
        );
        assert.deepEqual(
            checkContent(preset(), 'notes.md', 'never use waitForTimeout(…)'),
            []
        );
    });

    test('XPath in page objects and tests', () => {
        assert.deepEqual(
            ids(
                checkContent(
                    preset(),
                    'pages/shop/a.page.ts',
                    "page.locator('//div')"
                )
            ),
            ['no-xpath']
        );
        assert.deepEqual(
            ids(
                checkContent(
                    preset(),
                    'tests/shop/a.spec.ts',
                    "page.locator('xpath=//a')"
                )
            ),
            ['no-xpath']
        );
    });

    test('a cast on a response body in tests, fixtures and helpers', () => {
        const profile = preset({
            paths: {
                ...preset().paths,
                fixtures: 'fixtures',
                helpers: 'helpers/shop',
            },
        });
        for (const path of [
            'tests/shop/a.spec.ts',
            'fixtures/helper/helper-fixture.ts',
            'helpers/shop/seed.ts',
        ])
            assert.deepEqual(
                ids(
                    checkContent(
                        profile,
                        path,
                        'headers: (login.body as { token: string }).token,'
                    )
                ),
                ['no-body-cast']
            );
        assert.deepEqual(
            ids(
                checkContent(
                    profile,
                    'tests/shop/a.spec.ts',
                    'const user = response.body as unknown as UserResponse;'
                )
            ),
            ['no-body-cast']
        );
        // The field read, the request layer's type parameter, `as const`,
        // and files outside tests, fixtures and helpers
        for (const [path, content] of [
            [
                'fixtures/helper/helper-fixture.ts',
                'const { token } = z.looseObject({ token: z.string() }).parse(login.body);',
            ],
            [
                'fixtures/api/api-request-fixture.ts',
                'body: response.body as T,',
            ],
            ['tests/shop/a.spec.ts', 'return body as const;'],
            ['pages/shop/a.page.ts', 'const user = body as UserResponse;'],
        ])
            assert.deepEqual(checkContent(profile, path, content), []);
    });

    test('loose schemas in the area and util schema folders', () => {
        assert.deepEqual(
            ids(
                checkContent(
                    preset(),
                    'fixtures/api/schemas/shop/user.ts',
                    'z.object({})'
                )
            ),
            ['strict-schema']
        );
        assert.deepEqual(
            ids(
                checkContent(
                    preset(),
                    'fixtures/api/schemas/util/error.ts',
                    'z.object({})'
                )
            ),
            ['strict-schema']
        );
        assert.deepEqual(
            checkContent(
                preset(),
                'fixtures/api/schemas/shop/user.ts',
                'z.strictObject({})'
            ),
            []
        );
    });

    test('tags: unknown, too many, and on describe', () => {
        assert.deepEqual(
            ids(
                checkContent(
                    preset(),
                    'tests/shop/a.spec.ts',
                    "test('a', { tag: '@functional' }, f)"
                )
            ),
            ['allowed-tags']
        );
        assert.deepEqual(
            ids(
                checkContent(
                    preset(),
                    'tests/shop/a.spec.ts',
                    "test('a', { tag: ['@smoke', '@regression'] }, f)"
                )
            ),
            ['allowed-tags']
        );
        assert.deepEqual(
            ids(
                checkContent(
                    preset(),
                    'tests/shop/a.spec.ts',
                    "test.describe('cart @regression', () => {})"
                )
            ),
            ['no-tags-on-describe']
        );
        assert.deepEqual(
            ids(
                checkContent(
                    preset(),
                    'tests/shop/a.spec.ts',
                    "test.describe('cart', { tag: '@smoke' }, () => {})"
                )
            ),
            ['no-tags-on-describe']
        );
        assert.deepEqual(
            checkContent(
                preset(),
                'tests/shop/a.spec.ts',
                "test('a', { tag: '@smoke' }, f)"
            ),
            []
        );
    });

    test('JSON static data', () => {
        assert.deepEqual(
            ids(
                checkContent(
                    preset(),
                    'test-data/static/shop/emails.json',
                    '[]'
                )
            ),
            ['no-json-static-data']
        );
        assert.deepEqual(
            checkContent(
                preset(),
                'test-data/static/shop/emails.ts',
                'export const X = [] as const;'
            ),
            []
        );
    });
});

describe('an allowed project choice never trips a blanket rule', () => {
    test('an adopted repository whose specs import from @playwright/test', () => {
        const profile = preset({
            paths: { ...preset().paths, testEntry: '@playwright/test' },
        });
        assert.deepEqual(
            checkContent(
                profile,
                'tests/shop/a.spec.ts',
                "import { test } from '@playwright/test';"
            ),
            []
        );
    });

    test('a recorded override switches its rule off', () => {
        const overrides = [
            {
                rule: 'DEF-02',
                choice: 'direct imports',
                reason: 'existing suite',
            },
            {
                rule: 'DEF-03',
                choice: 'passthrough',
                reason: 'extensible API',
                source: 'contract §4',
            },
            { rule: 'DEF-06', choice: 'two tags', reason: 'team convention' },
            {
                rule: 'DEF-08',
                choice: 'json',
                reason: 'shared with another team',
            },
        ];
        const profile = preset({ overrides });
        assert.deepEqual(
            checkContent(
                profile,
                'tests/shop/a.spec.ts',
                "import { test } from '@playwright/test'; test('a', { tag: ['@smoke', '@x'] }, f)"
            ),
            []
        );
        assert.deepEqual(
            checkContent(
                profile,
                'fixtures/api/schemas/shop/u.ts',
                'z.object({})'
            ),
            []
        );
        assert.deepEqual(
            checkContent(profile, 'test-data/static/shop/e.json', '[]'),
            []
        );
    });

    test('invariant and framework rules ignore overrides', () => {
        const profile = preset({
            overrides: [
                { rule: 'FW-01', choice: 'hard waits', reason: 'slow site' },
            ],
        });
        assert.deepEqual(
            ids(checkContent(profile, 'helpers/x.ts', 'waitForTimeout(1)')),
            ['no-hard-wait']
        );
    });

    test('without a profile only invariant and framework rules run', () => {
        assert.deepEqual(
            checkContent(
                {},
                'tests/shop/a.spec.ts',
                "import { test } from '@playwright/test';"
            ),
            []
        );
        assert.deepEqual(
            ids(checkContent({}, 'tests/shop/a.ts', 'waitForTimeout(1)')),
            ['no-hard-wait']
        );
    });
});

describe('portability checks', () => {
    const profile = {
        projectTerms: ['acmeshop'],
        termExceptions: [{ path: 'KIT-CHANGELOG.md', reason: 'provenance' }],
    };
    const files = {
        '.claude/skills/x/SKILL.md': 'Use the acmeshop API.',
        'CLAUDE.md': `Rules.\n${START}\nProject: acmeshop\n${END}\nMore rules.`,
        'KIT-CHANGELOG.md': 'Built in acmeshop.',
        'tests/shop/a.spec.ts': 'acmeshop everywhere',
    };
    const read = (p) => files[p];

    test('a project term in a kit file is a leak; generated blocks, exceptions and project files are not', () => {
        const found = leaks(profile, Object.keys(files), read);
        assert.equal(found.length, 1);
        assert.match(
            found[0],
            /\.claude\/skills\/x\/SKILL\.md: project term "acmeshop"/
        );
    });

    test('an undeclared package imported by a kit script', () => {
        const root = mkdtempSync(join(tmpdir(), 'rule-check-'));
        const put = (p, c) => {
            mkdirSync(dirname(join(root, p)), { recursive: true });
            writeFileSync(join(root, p), c);
        };
        put(
            'package.json',
            JSON.stringify({ devDependencies: { yaml: '^2' } })
        );
        put(
            'scripts/a.mjs',
            "import { parse } from 'yaml';\nimport fs from 'node:fs';\nimport path from 'path';\nimport { z } from 'zod/v4';\nimport {\n    x,\n} from 'left-pad';\nconst s = 'see the docs from \"strict\" mode';\nput('f', 'import x from \"y\";');\n// a comment naming import('commented-out') or } from 'also-comment'\n/* import { w } from 'block-comment'; */\nconst lazy = await " +
                // split so this test file's own source holds no dynamic import
                "import('dyn-pkg');\n"
        );
        try {
            const found = undeclaredDependencies(root, ['scripts/a.mjs']);
            assert.deepEqual(
                found.map((f) => /imports "([^"]+)"/.exec(f)[1]).sort(),
                ['dyn-pkg', 'left-pad', 'zod']
            );
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('hook mode', () => {
    const root = '/repo';
    test('checks only files inside the repository, and only the added text', () => {
        const write = (file_path, content) =>
            hookViolations(root, {
                tool_name: 'Write',
                tool_input: { file_path, content },
            });
        assert.deepEqual(
            write('/elsewhere/tests/shop/a.spec.ts', 'waitForTimeout(1)'),
            []
        );
        assert.equal(
            write('/repo/helpers/x.ts', 'waitForTimeout(1)').length,
            1
        );
        assert.deepEqual(
            hookViolations(root, {
                tool_name: 'Edit',
                tool_input: {
                    file_path: '/repo/helpers/x.ts',
                    old_string: 'waitForTimeout(1)',
                    new_string: 'await expect(x).toBeVisible()',
                },
            }),
            []
        );
        assert.deepEqual(
            hookViolations(root, {
                tool_name: 'Read',
                tool_input: { file_path: '/repo/helpers/x.ts' },
            }),
            []
        );
    });
});

describe('skips (INV-02, DEF-20)', () => {
    const PLAN = 'test-plans/shop/cart.md';
    const plan = [
        '# Cart — Test Plan',
        '',
        '## Skipped tests',
        '',
        '| Scenarios | Kind | Defect or reason |',
        '| --------- | ---- | ---------------- |',
        '| 1.2 | defect | BUG-1 — the total ignores the discount |',
        '| 2.1 | n/a | no file upload on WebKit |',
        '',
        '## Not covered here',
        '',
        '- BUG-9 is mentioned outside the section',
    ].join('\n');
    const read = (path) => (path === PLAN ? plan : null);
    const profile = (knownDefects) =>
        preset({ plans: { headingIsTitle: true, knownDefects } });
    const SPEC = 'tests/shop/cart.spec.ts';
    const spec = (...lines) =>
        [
            `// plan: ${PLAN}`,
            "import { test } from '../../fixtures/fixtures';",
            ...lines,
        ].join('\n');
    const quarantined = (id, annotation = `'${id} — wrong total'`) => [
        `// FIXME: ${id} — the total ignores the discount`,
        '// eslint-disable-next-line playwright/no-skipped-test',
        'test.skip(',
        "    'Cart total includes the discount',",
        `    { tag: '@regression', annotation: { type: 'defect', description: ${annotation} } },`,
        '    async () => {}',
        ');',
    ];
    const problems = (knownDefects, text) =>
        checkContent(profile(knownDefects), SPEC, text, { read });
    const notApplicable = spec(
        "test('upload', async ({ browserName }) => {",
        "    test.skip(browserName === 'webkit', 'n/a: no file upload on WebKit');",
        '});'
    );

    test('a test that does not apply here skips with a condition and a listed n/a reason, in either mode', () => {
        assert.deepEqual(problems('fail', notApplicable), []);
        assert.deepEqual(problems('quarantine', notApplicable), []);
        assert.equal(
            problems(
                'fail',
                spec(
                    "test.skip(({ browserName }) => browserName === 'webkit', 'n/a: unlisted reason');"
                )
            ).length,
            1
        );
    });

    test('preset default: a known defect stays failing — the quarantine form is refused', () => {
        const [problem, ...rest] = problems(
            'fail',
            spec(...quarantined('BUG-1'))
        );
        assert.deepEqual(rest, []);
        assert.match(problem, /knownDefects: fail/);
    });

    test('quarantine: the FIXME comment, the defect annotation and the plan entry are all required', () => {
        assert.deepEqual(
            problems('quarantine', spec(...quarantined('BUG-1'))),
            []
        );
        assert.match(
            problems('quarantine', spec(...quarantined('BUG-1').slice(1)))[0],
            /FIXME/
        );
        assert.match(
            problems(
                'quarantine',
                spec(...quarantined('BUG-1', "'wrong total'"))
            )[0],
            /annotation/
        );
        assert.match(
            problems('quarantine', spec(...quarantined('BUG-9')))[0],
            /BUG-9 is not listed/
        );
    });

    test('with a tracker in the profile, the defect ID must be one of its ticket IDs', () => {
        const withTracker = (text) =>
            checkContent(
                {
                    ...profile('quarantine'),
                    tracker: { system: 'jira', idPattern: '[A-Z]+-\\d+' },
                },
                SPEC,
                text,
                { read }
            );
        assert.deepEqual(withTracker(spec(...quarantined('BUG-1'))), []);
        assert.match(
            withTracker(spec(...quarantined('flaky-thing')))[0],
            /does not look like a ticket/
        );
    });

    test('never allowed: test.fail, test.fixme, skipped describe blocks, skips without an n/a reason', () => {
        const text = spec(
            "test('a', async () => { test.fail(); });",
            "test.fixme('b', async () => {});",
            "test.describe.skip('c', () => {});",
            "test('d', async () => { test.skip(); });",
            "test('e', async () => { test.skip(true, 'flaky on CI'); });"
        );
        for (const mode of ['fail', 'quarantine'])
            assert.equal(problems(mode, text).length, 5);
    });

    test('only spec files are checked — helpers may skip steps', () => {
        assert.deepEqual(
            checkContent(
                profile('fail'),
                'helpers/util/softChecks.ts',
                'test.skip(true)'
            ),
            []
        );
    });

    test('hook mode sees the edited file, and reports only skips in the added text', () => {
        const root = mkdtempSync(join(tmpdir(), 'rule-check-skip-'));
        try {
            const put = (path, content) => {
                mkdirSync(dirname(join(root, path)), { recursive: true });
                writeFileSync(join(root, path), content);
            };
            put(
                'PROJECT-PROFILE.md',
                '---\npaths:\n    tests: tests/shop\nplans:\n    knownDefects: quarantine\n---\n'
            );
            put(PLAN, plan);
            // The FIXME comment is already in the file; the edit turns test( into test.skip(,
            // and an older bare skip elsewhere in the file is not the edit's concern
            const lines = quarantined('BUG-1');
            put(
                SPEC,
                spec(
                    ...lines.slice(0, 2),
                    'test(',
                    ...lines.slice(3),
                    "test('x', async () => { test.skip(); });"
                )
            );
            const edit = (new_string) =>
                hookViolations(root, {
                    tool_name: 'Edit',
                    tool_input: {
                        file_path: join(root, SPEC),
                        old_string: 'test(\n',
                        new_string,
                    },
                });
            assert.deepEqual(edit('test.skip(\n'), []);
            assert.equal(edit('test.fixme(\n').length, 1);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
