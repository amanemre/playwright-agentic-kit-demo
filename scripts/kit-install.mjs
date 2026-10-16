#!/usr/bin/env node
/**
 * kit-install.mjs — installs or upgrades the portable kit in a repository.
 *
 *   node scripts/kit-install.mjs --target <dir> --mode adopt
 *   node scripts/kit-install.mjs --target <dir> --mode scaffold --area <folder> [--project <name>]
 *   … [--source <kit dir>]  install from another copy of the kit (an upgrade)
 *   … [--dry-run]           show what would happen, write nothing
 *
 * Adopt copies the kit files (rules, skills, scripts, templates); scaffold
 * also installs the playwright-house-preset (generic files as they are, plus
 * `templates/preset/` rendered with the project's area folder and name).
 *
 * Safety rules (GENERALIZATION-PLAN-AGREED.md §3, §7):
 * - Project files are never written: PROJECT-PROFILE.md, and anything outside
 *   the kit and preset lists in scripts/kit-files.mjs.
 * - A file that already exists and differs is a collision on first install,
 *   and on upgrade a conflict when it was edited after installation (its
 *   checksum differs from kit-lock.json). Both are reported, never overwritten.
 * - In the constitution files the managed profile block belongs to the
 *   project: it is ignored when comparing and kept when updating.
 * - Files the kit no longer ships are reported, never deleted.
 * - package.json is never rewritten when it exists: missing scripts and
 *   dependencies are reported for a manual merge.
 * kit-lock.json (in the target) records the kit version and each installed
 * file's checksum.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    CONSTITUTIONS,
    PRESET_TEMPLATE_DIR,
    PROJECT_OWNED,
    isKit,
    isPreset,
} from './kit-files.mjs';
import { END, START } from './profile-sync.mjs';

export const LOCK = 'kit-lock.json';

const sha = (text) => createHash('sha256').update(text).digest('hex');

/**
 * Empties the managed profile block, so constitutions compare without it.
 *
 * @param {string} text - File content.
 * @returns {string} Content with an empty managed block.
 */
export function withoutBlock(text) {
    const from = text.indexOf(START);
    const to = text.indexOf(END);
    if (from < 0 || to < from) return text;
    return `${text.slice(0, from)}${START}\n${END}${text.slice(to + END.length)}`;
}

/**
 * Puts the target's managed block back into the new constitution text.
 *
 * @param {string} incoming - New kit content (empty block).
 * @param {string} current - The target's current content.
 * @returns {string} New content carrying the target's block.
 */
function keepBlock(incoming, current) {
    const from = current.indexOf(START);
    const to = current.indexOf(END);
    if (from < 0 || to < from) return incoming;
    return incoming.replace(
        `${START}\n${END}`,
        current.slice(from, to + END.length)
    );
}

const comparable = (path, text) =>
    CONSTITUTIONS.includes(path) ? withoutBlock(text) : text;

/**
 * Lists a source tree's files: tracked files when it is a git repository,
 * otherwise every file (excluding node_modules and .git).
 *
 * @param {string} root - Source root.
 * @returns {string[]} Repository-relative paths.
 */
export function listFiles(root) {
    try {
        return execFileSync(
            'git',
            ['ls-files', '--cached', '--others', '--exclude-standard'],
            {
                cwd: root,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
            }
        )
            .split('\n')
            .filter(Boolean);
    } catch {
        const out = [];
        const walk = (dir) => {
            for (const name of readdirSync(dir)) {
                if (['node_modules', '.git'].includes(name)) continue;
                const full = join(dir, name);
                if (statSync(full).isDirectory()) walk(full);
                else out.push(relative(root, full).split('\\').join('/'));
            }
        };
        walk(root);
        return out;
    }
}

/**
 * The files the kit would install, with their content.
 *
 * @param {{ source: string, mode: 'adopt' | 'scaffold', area?: string, project?: string }} o - Options.
 * @returns {Map<string, string>} Target path → content.
 */
export function kitPayload({ source, mode, area, project }) {
    const files = new Map();
    for (const path of listFiles(source)) {
        if (!existsSync(join(source, path))) continue;
        const preset = mode === 'scaffold' && isPreset(path);
        if (!isKit(path) && !preset) continue;
        const text = readFileSync(join(source, path), 'utf8');
        files.set(
            path,
            CONSTITUTIONS.includes(path) ? withoutBlock(text) : text
        );
    }
    if (mode === 'scaffold') {
        const prefix = `${PRESET_TEMPLATE_DIR}/`;
        for (const path of [...files.keys()].filter((p) =>
            p.startsWith(prefix)
        )) {
            const target = path
                .slice(prefix.length)
                .replace(/\.tpl$/, '')
                .replaceAll('__AREA__', area);
            files.set(
                target,
                files
                    .get(path)
                    .replaceAll('__AREA__', area)
                    .replaceAll('__PROJECT__', project)
            );
        }
    }
    return files;
}

/**
 * Decides, for every kit file, what installing into the target means.
 *
 * @param {Map<string, string>} payload - Files to install.
 * @param {(path: string) => string | undefined} readTarget - Reads a target file (undefined when absent).
 * @param {{ files?: Record<string, string> } | undefined} lock - The target's kit-lock.json.
 * @returns {Array<{ path: string, action: 'add' | 'update' | 'same' | 'kept-local-edit' | 'collision' | 'conflict' | 'removed-upstream' | 'project-owned', content?: string }>} Actions.
 */
export function plan(payload, readTarget, lock) {
    const actions = [];
    for (const [path, content] of payload) {
        if (PROJECT_OWNED.some((re) => re.test(path))) {
            actions.push({ path, action: 'project-owned' });
            continue;
        }
        const current = readTarget(path);
        if (current === undefined) {
            actions.push({ path, action: 'add', content });
        } else if (comparable(path, current) === comparable(path, content)) {
            actions.push({ path, action: 'same' });
        } else if (
            lock?.files?.[path] &&
            lock.files[path] === sha(comparable(path, current))
        ) {
            const next = CONSTITUTIONS.includes(path)
                ? keepBlock(content, current)
                : content;
            actions.push({ path, action: 'update', content: next });
        } else if (lock?.files?.[path] === sha(comparable(path, content))) {
            // edited locally, but the kit did not change it: nothing to merge
            actions.push({ path, action: 'kept-local-edit' });
        } else {
            actions.push({
                path,
                action: lock?.files?.[path] ? 'conflict' : 'collision',
            });
        }
    }
    for (const path of Object.keys(lock?.files ?? {})) {
        if (!payload.has(path))
            actions.push({ path, action: 'removed-upstream' });
    }
    return actions;
}

/**
 * Scripts and dependencies the target's package.json lacks.
 *
 * @param {object} kitPackage - The kit's package.json.
 * @param {object} targetPackage - The target's package.json.
 * @param {Set<string>} [installed] - Files the kit installs; a script whose
 *     command runs a `scripts/…` file outside this set is not suggested.
 * @returns {string[]} What to merge by hand.
 */
export function packageGaps(kitPackage, targetPackage, installed) {
    const gaps = [];
    for (const [name, command] of Object.entries(kitPackage.scripts ?? {})) {
        if (
            !/^(check:|profile:|plans:|rules:|roles:|ci:|test:kit|test:summary)/.test(
                name
            ) ||
            targetPackage.scripts?.[name]
        )
            continue;
        const files = [
            ...command.matchAll(/scripts\/[\w.-]+\.(?:sh|mjs|js)/g),
        ].map((m) => m[0]);
        if (installed && files.some((f) => !installed.has(f))) continue;
        gaps.push(`script "${name}": ${command}`);
    }
    const has = {
        ...targetPackage.dependencies,
        ...targetPackage.devDependencies,
    };
    for (const name of ['yaml', 'zod']) {
        const version =
            kitPackage.devDependencies?.[name] ??
            kitPackage.dependencies?.[name];
        if (version && !has[name])
            gaps.push(
                `dependency "${name}": ${version} (used by the kit scripts)`
            );
    }
    return gaps;
}

/**
 * Installs or upgrades the kit.
 *
 * @param {{ source: string, target: string, mode: 'adopt' | 'scaffold', area?: string, project?: string, dryRun?: boolean }} o - Options.
 * @returns {{ actions: Array<{ path: string, action: string }>, packageNotes: string[], kitVersion?: string }} What happened.
 */
export function install({
    source,
    target,
    mode,
    area = 'app',
    project = 'my-tests',
    dryRun = false,
}) {
    const payload = kitPayload({ source, mode, area, project });
    const lockPath = join(target, LOCK);
    const lock = existsSync(lockPath)
        ? JSON.parse(readFileSync(lockPath, 'utf8'))
        : undefined;
    const readTarget = (path) =>
        existsSync(join(target, path))
            ? readFileSync(join(target, path), 'utf8')
            : undefined;
    const actions = plan(payload, readTarget, lock);
    const kitVersion = /^Kit version: `?([^`\s]+)`?/m.exec(
        payload.get('KIT-MANIFEST.md') ?? ''
    )?.[1];

    const packageNotes = [];
    const targetPackage = join(target, 'package.json');
    if (existsSync(targetPackage)) {
        packageNotes.push(
            ...packageGaps(
                JSON.parse(readFileSync(join(source, 'package.json'), 'utf8')),
                JSON.parse(readFileSync(targetPackage, 'utf8')),
                new Set(payload.keys())
            )
        );
    }

    if (!dryRun) {
        const files = { ...(lock?.files ?? {}) };
        for (const a of actions) {
            if (a.action === 'add' || a.action === 'update') {
                mkdirSync(dirname(join(target, a.path)), { recursive: true });
                writeFileSync(join(target, a.path), a.content);
            }
            if (['add', 'update', 'same'].includes(a.action))
                files[a.path] = sha(comparable(a.path, readTarget(a.path)));
        }
        writeFileSync(
            lockPath,
            `${JSON.stringify({ kitVersion, mode, files }, null, 4)}\n`
        );
    }
    return { actions, packageNotes, kitVersion };
}

/** CLI entry point */
function main() {
    const args = process.argv.slice(2);
    const value = (flag) =>
        args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
    const mode = value('--mode');
    const target = value('--target');
    if (
        !target ||
        !['adopt', 'scaffold'].includes(mode) ||
        (mode === 'scaffold' && !value('--area'))
    ) {
        console.error(
            'usage: node scripts/kit-install.mjs --target <dir> --mode adopt|scaffold [--area <folder>] [--project <name>] [--source <kit dir>] [--dry-run]'
        );
        process.exit(2);
    }
    // --source: install from another copy of the kit (e.g. a newer version)
    const source = value('--source')
        ? resolve(value('--source'))
        : resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const { actions, packageNotes, kitVersion } = install({
        source,
        target: resolve(target),
        mode,
        area: value('--area'),
        project: value('--project') ?? 'my-tests',
        dryRun: args.includes('--dry-run'),
    });
    const count = (a) => actions.filter((x) => x.action === a).length;
    for (const a of actions.filter((x) =>
        [
            'collision',
            'conflict',
            'kept-local-edit',
            'removed-upstream',
            'project-owned',
        ].includes(x.action)
    )) {
        const why = {
            collision:
                'exists and differs — not from the kit; merge by hand (constitutions: add the profile markers)',
            conflict:
                'edited after installation and changed by the kit — not overwritten; merge the new kit version by hand',
            'kept-local-edit':
                'edited after installation; the kit did not change it — your version stays',
            'removed-upstream':
                'no longer shipped by the kit — not deleted; remove it if unused',
            'project-owned': 'project file — never written by the kit',
        }[a.action];
        console.log(`${a.action.toUpperCase().padEnd(16)} ${a.path} — ${why}`);
    }
    for (const note of packageNotes) console.log(`PACKAGE          ${note}`);
    console.log(
        `\nKit ${kitVersion} ${args.includes('--dry-run') ? '(dry run — nothing written)' : `→ ${target}`}: ${count('add')} added, ${count('update')} updated, ${count('same')} unchanged, ${count('collision')} collision(s), ${count('conflict')} conflict(s), ${count('kept-local-edit')} local edit(s) kept, ${count('removed-upstream')} removed upstream.`
    );
    console.log(
        'Next: install dependencies, write PROJECT-PROFILE.md with the kit-tailor skill (templates/PROJECT-PROFILE.template.md), then npm run profile:sync and the checks.'
    );
    process.exit(count('collision') + count('conflict') > 0 ? 1 : 0);
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
    main();
