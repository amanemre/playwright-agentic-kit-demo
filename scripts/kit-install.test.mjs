/**
 * Deterministic tests for kit-install.mjs — run with `npm run test:kit`.
 * Each test builds a small fake kit source and a target in the OS temp folder
 * (neither is a git repository, so files are listed by walking the tree).
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
import { END, START } from './profile-sync.mjs';
import { LOCK, install, packageGaps } from './kit-install.mjs';

let source;
let target;

const put = (root, path, content) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
};
const read = (root, path) => readFileSync(join(root, path), 'utf8');
const actionsOf = (result) =>
    Object.fromEntries(result.actions.map((a) => [a.path, a.action]));

beforeEach(() => {
    source = mkdtempSync(join(tmpdir(), 'kit-src-'));
    target = mkdtempSync(join(tmpdir(), 'kit-dst-'));
    put(source, 'KIT-MANIFEST.md', 'Kit version: `0.1.0`\n');
    put(
        source,
        'CLAUDE.md',
        `# Rules\n\n${START}\nreference project summary\n${END}\n\nKit rules v1.\n`
    );
    put(source, '.claude/skills/a/SKILL.md', 'skill a v1\n');
    put(source, '.claude/skills/b/SKILL.md', 'skill b v1\n');
    put(source, 'scripts/rule-check.mjs', '// checker v1\n');
    put(source, 'PROJECT-PROFILE.md', 'the reference project profile\n');
    put(source, 'tests/app/x.spec.ts', 'a project test\n');
    put(source, 'helpers/util/softChecks.ts', '// preset helper\n');
    put(
        source,
        'templates/preset/pages/__AREA__/example.page.ts.tpl',
        '// page of __PROJECT__ in __AREA__\n'
    );
    put(
        source,
        'package.json',
        JSON.stringify({
            scripts: {
                'rules:check': 'node scripts/rule-check.mjs --all',
                test: 'npx playwright test',
            },
            devDependencies: { yaml: '^2' },
            dependencies: { zod: '^4' },
        })
    );
});

afterEach(() => {
    rmSync(source, { recursive: true, force: true });
    rmSync(target, { recursive: true, force: true });
});

describe('first install', () => {
    test('adopt copies kit files only — never project files or the reference profile', () => {
        install({ source, target, mode: 'adopt' });
        assert.ok(existsSync(join(target, '.claude/skills/a/SKILL.md')));
        assert.ok(existsSync(join(target, 'scripts/rule-check.mjs')));
        assert.equal(existsSync(join(target, 'PROJECT-PROFILE.md')), false);
        assert.equal(existsSync(join(target, 'tests/app/x.spec.ts')), false);
        assert.equal(
            existsSync(join(target, 'helpers/util/softChecks.ts')),
            false
        );
    });

    test("the reference project's summary block is not copied", () => {
        install({ source, target, mode: 'adopt' });
        const claude = read(target, 'CLAUDE.md');
        assert.ok(claude.includes(`${START}\n${END}`));
        assert.equal(claude.includes('reference project summary'), false);
    });

    test('scaffold adds the preset and renders its templates with the area and project', () => {
        install({
            source,
            target,
            mode: 'scaffold',
            area: 'shop',
            project: 'demo',
        });
        assert.ok(existsSync(join(target, 'helpers/util/softChecks.ts')));
        assert.equal(
            read(target, 'pages/shop/example.page.ts'),
            '// page of demo in shop\n'
        );
    });

    test('an existing file that differs is a collision — reported, not overwritten', () => {
        put(target, 'CLAUDE.md', '# Our own instructions\n');
        const result = install({ source, target, mode: 'adopt' });
        assert.equal(actionsOf(result)['CLAUDE.md'], 'collision');
        assert.equal(read(target, 'CLAUDE.md'), '# Our own instructions\n');
    });

    test('a dry run writes nothing', () => {
        install({ source, target, mode: 'adopt', dryRun: true });
        assert.equal(
            existsSync(join(target, '.claude/skills/a/SKILL.md')),
            false
        );
        assert.equal(existsSync(join(target, LOCK)), false);
    });

    test('kit-lock.json records the version and every installed file', () => {
        install({ source, target, mode: 'adopt' });
        const lock = JSON.parse(read(target, LOCK));
        assert.equal(lock.kitVersion, '0.1.0');
        assert.ok(lock.files['.claude/skills/a/SKILL.md']);
    });
});

describe('upgrade', () => {
    beforeEach(() => {
        install({ source, target, mode: 'adopt' });
        // the project tailors: its own summary block, a local edit to skill b
        writeFileSync(
            join(target, 'CLAUDE.md'),
            read(target, 'CLAUDE.md').replace(
                `${START}\n${END}`,
                `${START}\nour project summary\n${END}`
            )
        );
        writeFileSync(
            join(target, '.claude/skills/b/SKILL.md'),
            'skill b v1 + our local note\n'
        );
        put(target, 'PROJECT-PROFILE.md', 'our profile\n');
        // a new kit version
        put(source, 'KIT-MANIFEST.md', 'Kit version: `0.2.0`\n');
        put(
            source,
            'CLAUDE.md',
            `# Rules\n\n${START}\nreference project summary\n${END}\n\nKit rules v2.\n`
        );
        put(source, '.claude/skills/a/SKILL.md', 'skill a v2\n');
        put(source, '.claude/skills/b/SKILL.md', 'skill b v2\n');
        put(source, '.claude/skills/c/SKILL.md', 'skill c (new)\n');
        rmSync(join(source, 'scripts/rule-check.mjs'));
    });

    test('untouched kit files update; locally edited ones conflict and stay as they are', () => {
        const actions = actionsOf(install({ source, target, mode: 'adopt' }));
        assert.equal(actions['.claude/skills/a/SKILL.md'], 'update');
        assert.equal(read(target, '.claude/skills/a/SKILL.md'), 'skill a v2\n');
        assert.equal(actions['.claude/skills/b/SKILL.md'], 'conflict');
        assert.equal(
            read(target, '.claude/skills/b/SKILL.md'),
            'skill b v1 + our local note\n'
        );
        assert.equal(actions['.claude/skills/c/SKILL.md'], 'add');
    });

    test('a local edit to a file the kit did not change is kept, not a conflict', () => {
        put(target, 'scripts/rule-check.mjs', '// checker v1 + our tweak\n');
        put(source, 'scripts/rule-check.mjs', '// checker v1\n');
        const actions = actionsOf(install({ source, target, mode: 'adopt' }));
        assert.equal(actions['scripts/rule-check.mjs'], 'kept-local-edit');
        assert.equal(
            read(target, 'scripts/rule-check.mjs'),
            '// checker v1 + our tweak\n'
        );
    });

    test("the constitution updates but keeps the project's summary block", () => {
        install({ source, target, mode: 'adopt' });
        const claude = read(target, 'CLAUDE.md');
        assert.ok(claude.includes('Kit rules v2.'));
        assert.ok(claude.includes('our project summary'));
        assert.equal(claude.includes('reference project summary'), false);
    });

    test('the profile survives and files dropped by the kit are only reported', () => {
        const actions = actionsOf(install({ source, target, mode: 'adopt' }));
        assert.equal(read(target, 'PROJECT-PROFILE.md'), 'our profile\n');
        assert.equal(actions['scripts/rule-check.mjs'], 'removed-upstream');
        assert.ok(existsSync(join(target, 'scripts/rule-check.mjs')));
        assert.equal(JSON.parse(read(target, LOCK)).kitVersion, '0.2.0');
    });
});

describe('package.json', () => {
    test('missing kit scripts and dependencies are reported, never written', () => {
        const kit = JSON.parse(read(source, 'package.json'));
        const gaps = packageGaps(kit, {
            scripts: { test: 'x' },
            devDependencies: {},
        });
        assert.ok(gaps.some((g) => g.startsWith('script "rules:check"')));
        assert.ok(gaps.some((g) => g.startsWith('dependency "yaml"')));
        assert.ok(gaps.some((g) => g.startsWith('dependency "zod"')));
        assert.equal(
            gaps.some((g) => g.includes('"test"')),
            false
        );
    });

    test('a script that runs a file the kit does not install is not suggested', () => {
        const kit = {
            scripts: {
                'check:version': 'bash scripts/check-version-drift.sh',
                'rules:check': 'node scripts/rule-check.mjs --all',
            },
        };
        const gaps = packageGaps(
            kit,
            { scripts: {} },
            new Set(['scripts/rule-check.mjs'])
        );
        assert.deepEqual(gaps, [
            'script "rules:check": node scripts/rule-check.mjs --all',
        ]);
    });
});
