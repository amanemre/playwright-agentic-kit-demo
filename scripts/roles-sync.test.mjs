/**
 * Deterministic tests for roles-sync.mjs — run with `npm run test:kit`.
 * Each test builds a throwaway repository (roles, tool trees, skill files) in
 * the OS temp folder.
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
import { parse as parseYaml } from 'yaml';
import { splitFrontMatter } from './profile-sync.mjs';
import { MARKER, readModels, readRoles, run } from './roles-sync.mjs';

let root;
const put = (path, content = '') => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
};
const read = (path) => readFileSync(join(root, path), 'utf8');
const frontMatter = (path) => parseYaml(splitFrontMatter(read(path)).yaml);

const role = ({
    name,
    skills = ['debugging'],
    readonly = false,
    model = 'deep',
    handsTo = 'conductor',
    body = '# Role\n\n## Reads\n\n- a\n\n## Writes\n\n- b\n\n## Never\n\n- c\n\n## Hands over\n\n- d\n',
}) =>
    `---\nname: ${name}\nsummary: What ${name} does.\nskills: [${skills.join(', ')}]\nmodel: ${model}\nreadonly: ${readonly}\nhandsTo: ${handsTo}\n---\n\n${body}`;

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'roles-sync-'));
    put('CLAUDE.md');
    put('.cursor/rules/rules.mdc');
    put('.github/copilot-instructions.md');
    for (const skill of ['debugging', 'pr-reviewer']) {
        put(`.claude/skills/${skill}/SKILL.md`);
        put(`.cursor/skills/${skill}/SKILL.md`);
    }
    put('.github/instructions/debugging.instructions.md');
    put('.github/prompts/pr-reviewer.prompt.md'); // Copilot keeps this skill as a prompt
    put(
        'roles/healer.md',
        role({ name: 'test-healer', handsTo: 'test-reviewer' })
    );
    put(
        'roles/reviewer.md',
        role({ name: 'test-reviewer', skills: ['pr-reviewer'], readonly: true })
    );
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('wrappers', () => {
    test('write creates one wrapper per role and tool; check then passes; a second write changes nothing', () => {
        const first = run({ root, write: true });
        assert.deepEqual(first.problems, []);
        assert.equal(first.updated.length, 6);
        assert.deepEqual(run({ root, write: false }).problems, []);
        assert.deepEqual(run({ root, write: true }).updated, []);
    });

    test('each tool gets its own format, rules file and skill paths', () => {
        run({ root, write: true });
        assert.deepEqual(frontMatter('.claude/agents/test-reviewer.md'), {
            name: 'test-reviewer',
            description: 'What test-reviewer does.',
            model: 'opus',
            disallowedTools: 'Write, Edit',
        });
        assert.equal(
            frontMatter('.claude/agents/test-healer.md').disallowedTools,
            undefined
        );
        assert.deepEqual(frontMatter('.cursor/agents/test-reviewer.md'), {
            name: 'test-reviewer',
            description: 'What test-reviewer does.',
            model: 'inherit',
            readonly: true,
        });
        const copilot = frontMatter('.github/agents/test-healer.agent.md');
        assert.equal(copilot.handoffs[0].agent, 'test-reviewer');
        assert.equal(copilot.handoffs[0].send, false);
        assert.equal(
            frontMatter('.github/agents/test-reviewer.agent.md').handoffs,
            undefined
        );
        assert.match(
            read('.cursor/agents/test-healer.md'),
            /read `\.cursor\/rules\/rules\.mdc`[\s\S]*`\.cursor\/skills\/debugging\/SKILL\.md`/
        );
        assert.match(
            read('.github/agents/test-reviewer.agent.md'),
            /`\.github\/prompts\/pr-reviewer\.prompt\.md`/
        );
        assert.match(read('.claude/agents/test-healer.md'), /## Hands over/);
    });

    test('check reports a stale wrapper after the role changes, without writing', () => {
        run({ root, write: true });
        const before = read('.claude/agents/test-healer.md');
        put(
            'roles/healer.md',
            role({ name: 'test-healer', handsTo: 'test-reviewer' }).replace(
                '- a',
                '- changed'
            )
        );
        const { problems } = run({ root, write: false });
        assert.equal(problems.filter((p) => p.includes('is stale')).length, 3);
        assert.equal(read('.claude/agents/test-healer.md'), before);
    });

    test('a pruned tool tree is skipped', () => {
        rmSync(join(root, '.cursor'), { recursive: true });
        const { problems, updated } = run({ root, write: true });
        assert.deepEqual(problems, []);
        assert.equal(updated.length, 4);
        assert.ok(!existsSync(join(root, '.cursor/agents')));
    });

    test("the project's own agents are never touched; a generated wrapper without a role is removed", () => {
        run({ root, write: true });
        put('.claude/agents/my-agent.md', '---\nname: my-agent\n---\nMine.\n');
        rmSync(join(root, 'roles/healer.md'));
        put(
            'roles/reviewer.md',
            role({
                name: 'test-reviewer',
                skills: ['pr-reviewer'],
                readonly: true,
            })
        );
        assert.ok(
            run({ root, write: false }).problems.some((p) =>
                p.includes('has no role any more')
            )
        );
        run({ root, write: true });
        assert.ok(!existsSync(join(root, '.claude/agents/test-healer.md')));
        assert.equal(
            read('.claude/agents/my-agent.md'),
            '---\nname: my-agent\n---\nMine.\n'
        );
        // a hand-written file where a wrapper should go is reported, not overwritten
        put('.claude/agents/test-reviewer.md', 'hand-written');
        assert.ok(
            run({ root, write: true }).problems.some((p) =>
                p.includes('was not generated')
            )
        );
        assert.equal(read('.claude/agents/test-reviewer.md'), 'hand-written');
    });
});

describe('models', () => {
    test('a role names a tier; Claude gets an alias, Cursor inherits, Copilot keeps its picker', () => {
        put(
            'roles/healer.md',
            role({
                name: 'test-healer',
                model: 'balanced',
                handsTo: 'test-reviewer',
            })
        );
        run({ root, write: true });
        assert.equal(
            frontMatter('.claude/agents/test-healer.md').model,
            'sonnet'
        );
        assert.equal(
            frontMatter('.claude/agents/test-reviewer.md').model,
            'opus'
        );
        assert.equal(
            frontMatter('.cursor/agents/test-healer.md').model,
            'inherit'
        );
        assert.equal(
            frontMatter('.github/agents/test-healer.agent.md').model,
            undefined
        );
    });

    test("the profile's agentModels changes what a tier means, per tool", () => {
        put(
            'PROJECT-PROFILE.md',
            '---\nagentModels:\n    claude:\n        deep: fable\n    cursor:\n        deep: some-model\n---\n'
        );
        run({ root, write: true });
        assert.equal(
            frontMatter('.claude/agents/test-reviewer.md').model,
            'fable'
        );
        assert.equal(
            frontMatter('.cursor/agents/test-reviewer.md').model,
            'some-model'
        );
        // tiers the profile does not mention keep their default
        assert.equal(readModels(root).claude.balanced, 'sonnet');
    });

    test('a tier the kit does not know is reported', () => {
        put('roles/healer.md', role({ name: 'test-healer', model: 'huge' }));
        assert.ok(
            readRoles(root).problems.some((p) =>
                p.startsWith('roles/healer.md: model')
            )
        );
    });
});

describe('role definitions', () => {
    test('an unknown hand-over target, a missing section and a wrong field are reported', () => {
        put(
            'roles/healer.md',
            role({ name: 'test-healer', handsTo: 'nobody' })
        );
        put(
            'roles/planner.md',
            role({ name: 'Test Planner', body: '# Role\n\n## Reads\n\n- a\n' })
        );
        put(
            'roles/generator.md',
            role({
                name: 'test-generator',
                body: '# Role\n\n## Reads\n\n- a\n\n## Writes\n\n- b\n',
            })
        );
        const { problems } = readRoles(root);
        assert.ok(problems.some((p) => p.includes('handsTo "nobody"')));
        assert.ok(problems.some((p) => p.startsWith('roles/planner.md: name')));
        assert.ok(
            problems.some(
                (p) =>
                    p.startsWith('roles/generator.md') &&
                    p.includes('"## Never"')
            )
        );
    });

    test('a skill without a file in a tree is reported for that tree', () => {
        put(
            'roles/healer.md',
            role({ name: 'test-healer', skills: ['debugging', 'ghost'] })
        );
        const { problems } = run({ root, write: false });
        for (const tree of ['claude', 'cursor', 'copilot'])
            assert.ok(
                problems.some((p) =>
                    p.includes(`"ghost" has no file in the ${tree} tree`)
                )
            );
    });

    test('every generated file carries the marker', () => {
        run({ root, write: true });
        assert.ok(read('.github/agents/test-healer.agent.md').includes(MARKER));
    });
});
