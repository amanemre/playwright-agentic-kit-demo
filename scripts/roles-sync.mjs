#!/usr/bin/env node
/**
 * roles-sync.mjs — one definition per agent role, one generated wrapper per tool.
 *
 * `roles/<role>.md` is the tool-neutral source: YAML front matter (name,
 * summary, skills, model, readonly, handsTo) and a Markdown body (Purpose, Reads,
 * Writes, Steps, Never, Done when, Hands over). This script renders each role
 * into the agent format of every tool tree the repository has:
 *
 *   Claude Code   .claude/agents/<name>.md
 *   Cursor        .cursor/agents/<name>.md
 *   Copilot       .github/agents/<name>.agent.md
 *
 * A tree whose constitution file is missing (pruned) is skipped. Agent files
 * without the "Generated from roles/" marker are the project's own and are
 * never touched.
 *
 *   node scripts/roles-sync.mjs --check   validate + fail on stale wrappers (default)
 *   node scripts/roles-sync.mjs --write   validate + rewrite the wrappers
 *   --root <dir>                          repository root (default: the parent of scripts/)
 *
 * Exit code 0 = valid and in sync; 1 = problems (listed); 2 = usage error.
 */
import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml, stringify } from 'yaml';
import { z } from 'zod/v4';
import { PROFILE_FILE, splitFrontMatter } from './profile-sync.mjs';

export const ROLES_DIR = 'roles';
/**
 * Model tiers a role may name, and what each means on every tool. A role asks
 * for a tier, never a model: `deep` for work where judgment decides the result,
 * `balanced` for high-volume work from an approved plan, `fast` for simple work.
 * Claude Code gets aliases, which follow the newest version of each model;
 * Cursor inherits the session's model and Copilot keeps its model picker,
 * unless the profile's `agentModels` maps the tiers for them.
 */
export const TIERS = ['deep', 'balanced', 'fast'];
export const DEFAULT_MODELS = {
    claude: { deep: 'opus', balanced: 'sonnet', fast: 'haiku' },
    cursor: {},
    copilot: {},
};
export const MARKER = 'Generated from roles/';
/** A role may hand over to another role, or back to the main session */
export const CONDUCTOR = 'conductor';
const SECTIONS = ['## Reads', '## Writes', '## Never', '## Hands over'];

/** The tool trees: where agents live, and where each tree keeps its rules and skills */
export const TREES = [
    {
        id: 'claude',
        dir: '.claude/agents',
        file: (name) => `${name}.md`,
        constitution: 'CLAUDE.md',
        skill: (s) => [`.claude/skills/${s}/SKILL.md`],
        frontMatter: (role, models) => ({
            name: role.name,
            description: role.summary,
            ...(models[role.model] ? { model: models[role.model] } : {}),
            ...(role.readonly ? { disallowedTools: 'Write, Edit' } : {}),
        }),
    },
    {
        id: 'cursor',
        dir: '.cursor/agents',
        file: (name) => `${name}.md`,
        constitution: '.cursor/rules/rules.mdc',
        skill: (s) => [`.cursor/skills/${s}/SKILL.md`],
        frontMatter: (role, models) => ({
            name: role.name,
            description: role.summary,
            model: models[role.model] ?? 'inherit',
            readonly: role.readonly,
        }),
    },
    {
        id: 'copilot',
        dir: '.github/agents',
        file: (name) => `${name}.agent.md`,
        constitution: '.github/copilot-instructions.md',
        skill: (s) => [
            `.github/instructions/${s}.instructions.md`,
            `.github/prompts/${s}.prompt.md`,
            `.github/skills/${s}/SKILL.md`,
        ],
        frontMatter: (role, models) => ({
            name: role.name,
            description: role.summary,
            ...(models[role.model] ? { model: models[role.model] } : {}),
            ...(role.handsTo === CONDUCTOR
                ? {}
                : {
                      handoffs: [
                          {
                              label: `Hand over to ${role.handsTo}`,
                              agent: role.handsTo,
                              prompt: 'Continue from the files the previous role wrote — see its "Hands over" section.',
                              send: false,
                          },
                      ],
                  }),
        }),
    },
];

const text = z.string().min(1);
export const RoleSchema = z.strictObject({
    name: z.string().regex(/^[a-z][a-z0-9-]*$/),
    summary: text,
    skills: z.array(text).min(1),
    model: z.enum(TIERS),
    readonly: z.boolean(),
    handsTo: text,
});

/**
 * Reads and validates the role definitions.
 *
 * @param {string} root - Repository root.
 * @returns {{ roles: Array<z.infer<typeof RoleSchema> & { source: string, body: string }>, problems: string[] }} Roles and what is wrong with them.
 */
export function readRoles(root) {
    const dir = join(root, ROLES_DIR);
    const roles = [];
    const problems = [];
    if (!existsSync(dir))
        return { roles, problems: [`${ROLES_DIR}/ not found`] };
    for (const file of readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .sort()) {
        const source = `${ROLES_DIR}/${file}`;
        let parts;
        try {
            parts = splitFrontMatter(readFileSync(join(root, source), 'utf8'));
        } catch {
            problems.push(`${source}: no YAML front matter`);
            continue;
        }
        const parsed = RoleSchema.safeParse(parseYaml(parts.yaml));
        if (!parsed.success) {
            for (const issue of parsed.error.issues)
                problems.push(
                    `${source}: ${issue.path.join('.') || 'front matter'} — ${issue.message}`
                );
            continue;
        }
        for (const section of SECTIONS)
            if (!parts.body.includes(`${section}\n`))
                problems.push(`${source}: the "${section}" section is missing`);
        roles.push({ ...parsed.data, source, body: parts.body.trim() });
    }
    const names = roles.map((r) => r.name);
    for (const role of roles) {
        if (names.filter((n) => n === role.name).length > 1)
            problems.push(
                `${role.source}: the name "${role.name}" is used twice`
            );
        if (role.handsTo !== CONDUCTOR && !names.includes(role.handsTo))
            problems.push(
                `${role.source}: handsTo "${role.handsTo}" is neither a role nor "${CONDUCTOR}"`
            );
    }
    return { roles, problems };
}

/**
 * The model of each tier per tool: the defaults, with the profile's
 * `agentModels` on top. A missing or unreadable profile leaves the defaults.
 *
 * @param {string} root - Repository root.
 * @returns {Record<string, Record<string, string>>} tool → tier → model.
 */
export function readModels(root) {
    let chosen = {};
    try {
        chosen =
            parseYaml(
                splitFrontMatter(readFileSync(join(root, PROFILE_FILE), 'utf8'))
                    .yaml
            )?.agentModels ?? {};
    } catch {
        // no profile: the defaults apply
    }
    return Object.fromEntries(
        Object.entries(DEFAULT_MODELS).map(([tool, tiers]) => [
            tool,
            { ...tiers, ...(chosen[tool] ?? {}) },
        ])
    );
}

/**
 * Renders one role as a tool's agent file.
 *
 * @param {z.infer<typeof RoleSchema> & { source: string, body: string }} role - The role.
 * @param {(typeof TREES)[number]} tree - The tool tree.
 * @param {string[]} skillPaths - The tree's file for each of the role's skills.
 * @param {Record<string, string>} [models] - The tree's model for each tier.
 * @returns {string} The agent file's content.
 */
export function render(
    role,
    tree,
    skillPaths,
    models = DEFAULT_MODELS[tree.id]
) {
    return [
        '---',
        // indent 4 = the repository's Prettier tab width, so generated files pass the format check
        stringify(tree.frontMatter(role, models), {
            lineWidth: 0,
            indent: 4,
        }).trimEnd(),
        '---',
        '',
        `<!-- ${MARKER}${role.source.slice(ROLES_DIR.length + 1)} by scripts/roles-sync.mjs — edit the role, then run \`npm run roles:sync\`. -->`,
        '',
        `Before starting, read \`${tree.constitution}\` and \`PROJECT-PROFILE.md\`. Load these skills as the work needs them, one at a time:`,
        '',
        ...skillPaths.map((p) => `- \`${p}\``),
        '',
        role.body,
        '',
    ].join('\n');
}

/**
 * Validates the roles and checks or writes their wrappers.
 *
 * @param {{ root: string, write: boolean }} options - Root and mode.
 * @returns {{ problems: string[], updated: string[] }} Problems, and the files written.
 */
export function run({ root, write }) {
    const { roles, problems } = readRoles(root);
    const models = readModels(root);
    const updated = [];
    for (const tree of TREES) {
        if (!existsSync(join(root, tree.constitution))) continue; // tree pruned
        const expected = new Map();
        for (const role of roles) {
            const skillPaths = [];
            for (const skill of role.skills) {
                const path = tree
                    .skill(skill)
                    .find((p) => existsSync(join(root, p)));
                if (path) skillPaths.push(path);
                else
                    problems.push(
                        `${role.source}: skill "${skill}" has no file in the ${tree.id} tree`
                    );
            }
            expected.set(
                `${tree.dir}/${tree.file(role.name)}`,
                render(role, tree, skillPaths, models[tree.id])
            );
        }
        for (const [path, content] of expected) {
            const current = existsSync(join(root, path))
                ? readFileSync(join(root, path), 'utf8')
                : null;
            if (current === content) continue;
            if (current !== null && !current.includes(MARKER)) {
                problems.push(
                    `${path} exists and was not generated — rename it or the role`
                );
            } else if (write) {
                mkdirSync(dirname(join(root, path)), { recursive: true });
                writeFileSync(join(root, path), content);
                updated.push(path);
            } else {
                problems.push(
                    `${path} is ${current === null ? 'missing' : 'stale'} — run \`npm run roles:sync\``
                );
            }
        }
        // A generated wrapper whose role is gone
        const dir = join(root, tree.dir);
        for (const file of existsSync(dir) ? readdirSync(dir) : []) {
            const path = `${tree.dir}/${file}`;
            if (expected.has(path) || !file.endsWith('.md')) continue;
            if (!readFileSync(join(root, path), 'utf8').includes(MARKER))
                continue;
            if (write) {
                rmSync(join(root, path));
                updated.push(`${path} (removed)`);
            } else {
                problems.push(
                    `${path} has no role any more — run \`npm run roles:sync\``
                );
            }
        }
    }
    return { problems, updated };
}

/** CLI entry point */
function main() {
    const args = process.argv.slice(2);
    const rootIndex = args.indexOf('--root');
    const known = new Set(['--check', '--write', '--root']);
    if (
        args.some(
            (a, i) => a.startsWith('--') && !known.has(a) && i !== rootIndex + 1
        ) ||
        (rootIndex >= 0 && !args[rootIndex + 1])
    ) {
        console.error(
            'usage: node scripts/roles-sync.mjs [--check | --write] [--root <dir>]'
        );
        process.exit(2);
    }
    const root =
        rootIndex >= 0
            ? resolve(args[rootIndex + 1])
            : resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const write = args.includes('--write');
    const { problems, updated } = run({ root, write });
    for (const problem of problems) console.log(`PROBLEM ${problem}`);
    console.log(
        `\nRoles check: ${problems.length} problem(s)${write ? `, ${updated.length} file(s) updated` : ''}.`
    );
    process.exit(problems.length ? 1 : 0);
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
    main();
