/**
 * Deterministic tests for profile-sync.mjs — run with `npm run test:kit`
 * (Node's built-in test runner; no browser, no network).
 *
 * Each test builds a throwaway repository in the OS temp folder: a profile,
 * the three constitution files with managed markers, and the paths the
 * profile names.
 */
import assert from 'node:assert/strict';
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
import { stringify } from 'yaml';
import {
    END,
    PROFILE_FILE,
    START,
    TARGETS,
    activeApprovals,
    run,
} from './profile-sync.mjs';

/** A valid scaffold-mode profile (front matter only) */
const baseProfile = () => ({
    profileSchema: 1,
    kitVersion: '0.1.0',
    project: { name: 'demo', app: 'a fictional shop' },
    mode: 'scaffold',
    preset: 'playwright-house-preset',
    stack: { framework: 'playwright', language: 'typescript' },
    capabilities: {
        ui: true,
        api: true,
        auth: 'cookie',
        contractValidation: 'zod',
        reporting: ['html'],
    },
    paths: {
        area: 'shop',
        tests: 'tests/shop',
        testEntry: 'fixtures/fixtures.ts',
    },
    packageManager: 'npm',
    commands: { test: 'npm test' },
    env: {
        files: 'env/.env.<ENVIRONMENT>',
        appUrl: 'APP_URL',
        credentials: ['APP_EMAIL'],
    },
    hosts: ['shop.example.test'],
    exploration: { tool: 'playwright-cli', fallbacks: [] },
    execution: { repairAttempts: 2 },
    architecture: { pageAccess: 'pageManager', pageObjects: 'getter-locators' },
    validation: {
        library: 'zod',
        unknownFieldPolicy: 'strict',
        assertionPattern: 'expect(Schema.parse(body)).toBeTruthy()',
    },
    reporting: {
        style: 'readable-steps',
        helper: 'helpers/util/softChecks.ts',
        capture: 'trace on first retry',
    },
    tags: { allowed: ['@smoke', '@regression'], perTest: 1 },
    plans: {
        headingIsTitle: true,
        specHeader: '// plan:',
        knownDefects: 'fail',
    },
    data: { staticFormat: 'ts-as-const', factories: 'faker' },
    lifecycle: { cleanup: 'teardown fixtures', setupVia: 'api' },
    api: { coverage: 'full-matrix' },
    ci: {
        system: 'github-actions',
        gate: 'summary',
        pullRequest: 'smoke+changed',
        shards: 2,
        smokeTag: '@smoke',
    },
    tracker: {
        system: 'jira',
        access: 'cli',
        project: 'SHOP',
        idPattern: '[A-Z]+-\\d+',
        defectType: 'Bug',
    },
    delivery: {
        host: 'github',
        baseBranch: 'main',
        cli: 'gh',
        branchPattern: '{type}/{ticket}-{short-name}',
        commitStyle: 'conventional',
    },
    overrides: [],
    projectTerms: ['fictionalshop'],
    termExceptions: [],
    standingApprovals: [],
    openQuestions: [],
});

const INVENTORY = [
    '| INV-02 | x |',
    '| FW-01 | x |',
    '| DEF-01 | x |',
    '| DEF-03 | x |',
    '| DEF-05 | x |',
    '| DEF-20 | x |',
    '| DEF-21 | x |',
    '| DEF-22 | x |',
].join('\n');
const constitution = (name) =>
    `# ${name}\n\nIntro.\n\n${START}\n${END}\n\n## Rules\n\nUnmanaged text stays.\n`;

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

/**
 * Writes PROJECT-PROFILE.md with the given front matter.
 *
 * @param {object} frontMatter - The profile fields.
 */
function putProfile(frontMatter) {
    put(PROFILE_FILE, `---\n${stringify(frontMatter)}---\n\n# Profile prose\n`);
}

const read = (path) => readFileSync(join(root, path), 'utf8');
const problemsOf = (write = false) => run({ root, write }).problems;

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'profile-sync-'));
    for (const target of TARGETS) put(target, constitution(target));
    put('RULE-INVENTORY.md', INVENTORY);
    put('KIT-MANIFEST.md', 'Kit version: `0.1.0`\n');
    put('tests/shop/a.spec.ts', '');
    put('fixtures/fixtures.ts', '');
    put('helpers/util/softChecks.ts', '');
    putProfile(baseProfile());
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('synchronization', () => {
    test('write fills every managed block, and check then passes', () => {
        const { problems, updated } = run({ root, write: true });
        assert.deepEqual(problems, []);
        assert.deepEqual(updated, TARGETS);
        for (const target of TARGETS)
            assert.match(read(target), /## Project Profile \(summary\)/);
        assert.deepEqual(problemsOf(), []);
    });

    test('a second write changes nothing (idempotent)', () => {
        run({ root, write: true });
        const before = TARGETS.map(read);
        const { updated } = run({ root, write: true });
        assert.deepEqual(updated, []);
        assert.deepEqual(TARGETS.map(read), before);
    });

    test('content outside the markers is preserved byte for byte', () => {
        run({ root, write: true });
        const text = read('CLAUDE.md');
        assert.ok(
            text.startsWith('# CLAUDE.md\n\nIntro.\n\n<!-- profile:start -->')
        );
        assert.ok(
            text.endsWith(
                '<!-- profile:end -->\n\n## Rules\n\nUnmanaged text stays.\n'
            )
        );
    });

    test('check reports a stale block after the profile changes, without writing', () => {
        run({ root, write: true });
        putProfile({
            ...baseProfile(),
            project: { name: 'renamed', app: 'a fictional shop' },
        });
        const before = read('CLAUDE.md');
        const problems = problemsOf();
        assert.equal(
            problems.filter((p) => p.includes('stale')).length,
            TARGETS.length
        );
        assert.equal(read('CLAUDE.md'), before);
    });

    test('missing or duplicated markers are reported and the file is left alone', () => {
        put('CLAUDE.md', '# No markers\n');
        put('.cursor/rules/rules.mdc', `${START}\n${END}\n${START}\n${END}\n`);
        const problems = problemsOf(true);
        assert.ok(
            problems.some((p) => p.startsWith('CLAUDE.md: needs exactly one'))
        );
        assert.ok(
            problems.some((p) =>
                p.startsWith('.cursor/rules/rules.mdc: needs exactly one')
            )
        );
        assert.equal(read('CLAUDE.md'), '# No markers\n');
    });

    test('commands in the profile are never executed', () => {
        putProfile({ ...baseProfile(), commands: { test: 'touch EXECUTED' } });
        run({ root, write: true });
        assert.equal(existsSync(join(root, 'EXECUTED')), false);
    });
});

describe('malformed profiles', () => {
    test('a profile without front matter is reported', () => {
        put(PROFILE_FILE, '# Only prose\n');
        assert.match(problemsOf()[0], /must start with YAML front matter/);
    });

    test('invalid YAML is reported', () => {
        put(PROFILE_FILE, '---\nmode: [unclosed\n---\n');
        assert.equal(problemsOf().length, 1);
    });

    test('an unknown key and a wrong value are reported with their path', () => {
        putProfile({ ...baseProfile(), surprise: true, mode: 'sometimes' });
        const problems = problemsOf();
        assert.ok(
            problems.some((p) => p.includes('(root)') || p.includes('surprise'))
        );
        assert.ok(problems.some((p) => p.includes('mode')));
    });
});

describe('contradictory choices', () => {
    test('scaffold mode requires the readable report structure', () => {
        putProfile({
            ...baseProfile(),
            reporting: { style: 'plain', capture: 'x' },
            overrides: [
                { rule: 'DEF-05', choice: 'plain', reason: 'team habit' },
            ],
        });
        assert.ok(
            problemsOf().some((p) =>
                p.includes('readable report structure is a rule')
            )
        );
    });

    test('adopt mode may use another report style when the override records it', () => {
        putProfile({
            ...baseProfile(),
            mode: 'adopt',
            preset: 'none',
            reporting: { style: 'plain', capture: 'x' },
            overrides: [
                {
                    rule: 'DEF-05',
                    choice: 'plain',
                    reason: 'existing suite; migration not requested',
                },
            ],
        });
        assert.deepEqual(problemsOf(true), []);
    });

    test('a departure from a preset default without an override is reported', () => {
        putProfile({
            ...baseProfile(),
            mode: 'adopt',
            architecture: { pageAccess: 'fixtures', pageObjects: 'none' },
        });
        assert.ok(
            problemsOf().some(
                (p) =>
                    p.includes('architecture.pageAccess') &&
                    p.includes('DEF-01')
            )
        );
    });

    test('quarantining known defects needs a DEF-20 override with its reason', () => {
        const quarantine = {
            ...baseProfile(),
            plans: { ...baseProfile().plans, knownDefects: 'quarantine' },
        };
        putProfile(quarantine);
        assert.ok(
            problemsOf().some(
                (p) => p.includes('plans.knownDefects') && p.includes('DEF-20')
            )
        );
        putProfile({
            ...quarantine,
            overrides: [
                {
                    rule: 'DEF-20',
                    choice: 'quarantine',
                    reason: 'CI must stay green while minor defects wait for a fix',
                },
            ],
        });
        problemsOf(true);
        assert.deepEqual(problemsOf(), []);
    });

    test('the delivery CLI must belong to the host; another commit style needs DEF-21', () => {
        putProfile({
            ...baseProfile(),
            delivery: { ...baseProfile().delivery, host: 'gitlab' },
        });
        assert.ok(
            problemsOf().some(
                (p) => p.includes('delivery.cli') && p.includes('"glab"')
            )
        );
        putProfile({
            ...baseProfile(),
            delivery: {
                ...baseProfile().delivery,
                host: 'bitbucket',
                cli: 'none',
                commitStyle: 'free text',
            },
        });
        assert.ok(problemsOf().some((p) => p.includes('DEF-21')));
        putProfile({
            ...baseProfile(),
            delivery: {
                ...baseProfile().delivery,
                host: 'bitbucket',
                cli: 'none',
                commitStyle: 'free text',
            },
            overrides: [
                {
                    rule: 'DEF-21',
                    choice: 'free text',
                    reason: 'the team writes plain commit subjects',
                },
            ],
        });
        problemsOf(true);
        assert.deepEqual(problemsOf(), []);
    });

    test('the tracker must be reachable the way the profile says, with recognisable IDs', () => {
        const withTracker = (tracker) => {
            putProfile({ ...baseProfile(), tracker });
            return problemsOf();
        };
        assert.ok(
            withTracker({ system: 'none', access: 'cli' }).some((p) =>
                p.includes('must be "manual"')
            )
        );
        assert.ok(
            withTracker({
                system: 'linear',
                access: 'cli',
                idPattern: '[A-Z]+-\\d+',
            }).some((p) => p.includes('"mcp" or "manual"'))
        );
        assert.ok(
            withTracker({ system: 'github', access: 'cli' }).some((p) =>
                p.includes('tracker.idPattern is missing')
            )
        );
        assert.ok(
            withTracker({
                system: 'github',
                access: 'cli',
                idPattern: '#(\\d+',
            }).some((p) => p.includes('not a valid regular expression'))
        );
        putProfile({
            ...baseProfile(),
            tracker: { system: 'none', access: 'manual' },
        });
        problemsOf(true);
        assert.deepEqual(problemsOf(), []);
    });

    test('CI tags must be tags the project uses; another gate needs DEF-22', () => {
        putProfile({
            ...baseProfile(),
            ci: { ...baseProfile().ci, serialTag: '@slow' },
        });
        assert.ok(
            problemsOf().some(
                (p) => p.includes('ci.serialTag') && p.includes('tags.allowed')
            )
        );
        putProfile({
            ...baseProfile(),
            ci: { ...baseProfile().ci, gate: 'exit-code' },
        });
        assert.ok(problemsOf().some((p) => p.includes('DEF-22')));
    });

    test('standing approvals: only approvable actions, once each, with an end date after the start', () => {
        const approval = (changes = {}) => ({
            action: 'post-run-summary',
            limits: 'one comment per pull request',
            approvedBy: 'Sam Lee',
            date: '2026-10-01',
            expires: '2027-01-01',
            ...changes,
        });
        const withApprovals = (...standingApprovals) => {
            putProfile({ ...baseProfile(), standingApprovals });
            return problemsOf();
        };
        assert.ok(
            withApprovals(approval({ action: 'merge' })).some((p) =>
                p.includes('can never be approved in advance')
            )
        );
        assert.ok(
            withApprovals(approval({ action: 'deploy' })).some((p) =>
                p.includes('unknown action "deploy"')
            )
        );
        assert.ok(
            withApprovals(approval(), approval()).some((p) =>
                p.includes('listed twice')
            )
        );
        assert.ok(
            withApprovals(approval({ expires: '2026-10-01' })).some((p) =>
                p.includes('on or before the day it was given')
            )
        );
        putProfile({ ...baseProfile(), standingApprovals: [approval()] });
        problemsOf(true);
        assert.deepEqual(problemsOf(), []);
        assert.match(
            read('CLAUDE.md'),
            /`post-run-summary` \(Sam Lee, until 2027-01-01\)/
        );
    });

    test('an approval counts only between its two dates', () => {
        const profile = {
            standingApprovals: [
                {
                    action: 'post-run-summary',
                    date: '2026-10-01',
                    expires: '2027-01-01',
                },
                { action: 'merge', date: '2026-10-01', expires: '2027-01-01' },
            ],
        };
        const actions = (today) =>
            activeApprovals(profile, today).map((a) => a.action);
        assert.deepEqual(actions('2026-09-30'), []);
        assert.deepEqual(actions('2026-10-01'), ['post-run-summary']);
        assert.deepEqual(actions('2027-01-01'), ['post-run-summary']);
        assert.deepEqual(actions('2027-01-02'), []);
    });

    test('agentModels is optional and only maps known tools and tiers', () => {
        putProfile({
            ...baseProfile(),
            agentModels: { claude: { deep: 'fable' } },
        });
        problemsOf(true);
        assert.deepEqual(problemsOf(), []);
        putProfile({
            ...baseProfile(),
            agentModels: { claude: { enormous: 'x' } },
        });
        assert.ok(problemsOf().some((p) => p.includes('agentModels')));
    });

    test('invariants and framework rules cannot be overridden', () => {
        putProfile({
            ...baseProfile(),
            overrides: [
                {
                    rule: 'INV-02',
                    choice: 'skip known defects',
                    reason: 'green builds',
                },
                { rule: 'FW-01', choice: 'hard waits', reason: 'slow site' },
            ],
        });
        const problems = problemsOf();
        assert.ok(
            problems.some(
                (p) =>
                    p.includes('INV-02') && p.includes('cannot be overridden')
            )
        );
        assert.ok(
            problems.some(
                (p) => p.includes('FW-01') && p.includes('cannot be overridden')
            )
        );
    });

    test('a non-strict unknown-field policy must cite the contract', () => {
        putProfile({
            ...baseProfile(),
            validation: {
                library: 'zod',
                unknownFieldPolicy: 'passthrough',
                assertionPattern: 'x',
            },
            overrides: [
                {
                    rule: 'DEF-03',
                    choice: 'passthrough',
                    reason: 'extensible API',
                },
            ],
        });
        assert.ok(
            problemsOf().some((p) => p.includes('must cite the contract'))
        );
    });

    test('a UI-less project cannot declare page-object access', () => {
        putProfile({
            ...baseProfile(),
            capabilities: { ...baseProfile().capabilities, ui: false },
        });
        assert.ok(
            problemsOf().some((p) => p.includes('capabilities.ui is false'))
        );
    });

    test('an API-only project needs no override for UI settings, and may import from a package', () => {
        put('node_modules/@playwright/test/package.json', '{}');
        putProfile({
            ...baseProfile(),
            mode: 'adopt',
            preset: 'none',
            capabilities: { ...baseProfile().capabilities, ui: false },
            architecture: { pageAccess: 'none', pageObjects: 'none' },
            exploration: { tool: 'none', fallbacks: [] },
            reporting: { style: 'plain', capture: 'x' },
            paths: {
                area: 'api',
                tests: 'tests/shop',
                testEntry: '@playwright/test',
            },
            overrides: [
                { rule: 'DEF-05', choice: 'plain', reason: 'existing suite' },
            ],
        });
        assert.deepEqual(problemsOf(true), []);
    });

    test('a path that does not exist is reported', () => {
        putProfile({
            ...baseProfile(),
            paths: { ...baseProfile().paths, plans: 'test-plans/shop' },
        });
        assert.ok(
            problemsOf().some((p) =>
                p.includes('"test-plans/shop" does not exist')
            )
        );
    });

    test('a kit version that differs from the manifest is reported', () => {
        putProfile({ ...baseProfile(), kitVersion: '9.9.9' });
        assert.ok(
            problemsOf().some((p) =>
                p.includes('does not match KIT-MANIFEST.md')
            )
        );
    });
});
