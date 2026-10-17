#!/usr/bin/env node
/**
 * rule-check.mjs — the mechanical subset of the constitution, as one
 * profile-aware checker for CI, pre-commit and the Claude write hook.
 *
 * Each rule carries its ID from RULE-INVENTORY.md. Invariant (INV) and
 * framework (FW) rules always run. Preset-default (DEF) rules read their
 * setting from PROJECT-PROFILE.md and switch off when the profile records an
 * override for them — an allowed project choice never trips a blanket rule.
 *
 *   node scripts/rule-check.mjs --all            every tracked file (CI)
 *   node scripts/rule-check.mjs --files a b …    the given files (pre-commit)
 *   node scripts/rule-check.mjs --hook           Claude Code PreToolUse hook: reads the tool call
 *                                                as JSON on stdin, checks only the text it adds;
 *                                                exit 2 blocks it (message on stderr)
 *   --root <dir>                                 repository root (default: parent of scripts/)
 *
 * --all also runs the portability checks: project terms (the profile's
 * `projectTerms`) in kit files, and packages imported by kit scripts that
 * package.json does not declare.
 * Exit code 0 = no violations; 1 = violations (listed); 2 = hook block or usage error.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { KIT } from './kit-files.mjs';
import { END, PROFILE_FILE, START, splitFrontMatter } from './profile-sync.mjs';

/**
 * Reads the profile front matter; an unreadable profile yields `{}` so the
 * invariant and framework rules still run (the profile check reports the error).
 *
 * @param {string} root - Repository root.
 * @returns {Record<string, any>} The profile, or {}.
 */
export function readProfile(root) {
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

const overridden = (profile, rule) =>
    (profile.overrides ?? []).some((o) => o.rule === rule);
const under = (path, folder) =>
    Boolean(folder) &&
    (path === folder || path.startsWith(`${folder.replace(/\/$/, '')}/`));
const isSpec = (profile, path) =>
    under(path, profile.paths?.tests) && /\.(spec|setup)\.ts$/.test(path);

/** Tags a spec assigns, per `{ tag: … }` option */
function tagOptions(content) {
    return [
        ...content.matchAll(/\btag:\s*(\[[^\]]*\]|['"`][^'"`]*['"`])/g),
    ].map((m) => [...m[1].matchAll(/['"`](@[\w-]+)['"`]/g)].map((t) => t[1]));
}

/**
 * Splits the arguments of a call at top level.
 *
 * @param {string} text - Source text.
 * @param {number} open - Index of the call's opening parenthesis.
 * @returns {string[]} The arguments, trimmed (empty for `()`).
 */
export function callArgs(text, open) {
    const args = [];
    let depth = 0;
    let start = open + 1;
    for (let i = open + 1; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"' || ch === "'" || ch === '`') {
            for (i++; i < text.length && text[i] !== ch; i++)
                if (text[i] === '\\') i++;
        } else if (ch === '/' && text[i + 1] === '/') {
            i = text.indexOf('\n', i);
            if (i < 0) break;
        } else if (ch === '/' && text[i + 1] === '*') {
            i = text.indexOf('*/', i + 2) + 1;
            if (i <= 0) break;
        } else if ('([{'.includes(ch)) depth++;
        else if (ch === ',' && depth === 0) {
            args.push(text.slice(start, i).trim());
            start = i + 1;
        } else if (')]}'.includes(ch)) {
            if (depth === 0) {
                const last = text.slice(start, i).trim();
                if (last || args.length) args.push(last);
                return args;
            }
            depth--;
        }
    }
    return args;
}

/** The value of a string literal argument, or undefined for anything else */
function literal(arg) {
    const m = /^(['"`])([\s\S]*)\1$/.exec(arg ?? '');
    if (!m || (m[1] === '`' && m[2].includes('${'))) return undefined;
    return m[2];
}

/** The `## Skipped tests` section of a plan (empty when absent) */
export function skippedSection(plan) {
    const lines = plan.split('\n');
    const start = lines.findIndex((l) => /^## Skipped tests\s*$/.test(l));
    if (start < 0) return '';
    const end = lines.findIndex((l, i) => i > start && /^## /.test(l));
    return lines.slice(start + 1, end < 0 ? undefined : end).join('\n');
}

/**
 * Skip calls in a spec and what is wrong with each (INV-02, DEF-20).
 *
 * A test that does not apply here skips with a condition and an `n/a:`
 * reason. A known product defect stays a failing test — unless the profile
 * chose `plans.knownDefects: quarantine`, where it may be skipped in the
 * quarantine form: `test.skip(title, { …, annotation: { type: 'defect',
 * description: '<ID> — …' } }, body)` under a `// FIXME: <ID> — …` comment.
 * Either kind is listed in the plan's "## Skipped tests" section.
 * `test.fixme`, `test.fail` and skipped describe blocks are never allowed.
 *
 * @param {string} text - The spec's text.
 * @param {Record<string, any>} profile - The profile front matter.
 * @param {(path: string) => string | null} [read] - Reads a repository file; enables the plan cross-check.
 * @returns {Array<{ index: number, message: string }>} Problems with the offset of their call.
 */
export function skipProblems(text, profile, read) {
    const problems = [];
    const quarantine = profile.plans?.knownDefects === 'quarantine';
    const planPath = /^\/\/ plan:\s*(\S+)/m.exec(text)?.[1];
    let skipped; // the plan's "Skipped tests" section, read once when needed
    const listed = (needle) => {
        if (!planPath || !read) return true; // partial text: nothing to cross-check
        skipped ??= skippedSection(read(planPath) ?? '');
        return skipped.includes(needle);
    };
    const calls =
        /\btest(\.describe(?:\.(?:serial|parallel))?)?\.(skip|fixme|fail)\s*\(/g;
    for (const m of text.matchAll(calls)) {
        const add = (message) => {
            const line = text.slice(0, m.index).split('\n').length;
            problems.push({
                index: m.index,
                message: `line ${line}: ${message}`,
            });
        };
        const [, describe, kind] = m;
        if (describe) {
            add(
                `\`test.describe.${kind}\` is not allowed — skip individual tests, each with its reason.`
            );
            continue;
        }
        if (kind === 'fail') {
            add(
                '`test.fail` is not allowed — it turns the failure into a pass and hides any other failure in the same test.'
            );
            continue;
        }
        if (kind === 'fixme') {
            add(
                quarantine
                    ? "`test.fixme` is not allowed — quarantine a known defect with `test.skip(title, { annotation: { type: 'defect', … } }, body)` under a `// FIXME: <ID> — …` comment."
                    : '`test.fixme` is not allowed — a known defect stays a failing test, listed in the plan under "Why tests currently fail".'
            );
            continue;
        }
        const args = callArgs(text, m.index + m[0].length - 1);
        const first = literal(args[0]);
        if (first === undefined) {
            // test.skip(condition, reason): a test that does not apply here
            const reason = literal(args[1])?.trim();
            if (args.length === 0 || reason === undefined)
                add(
                    "a skip needs a condition and a reason — `test.skip(<condition>, 'n/a: <why it does not apply here>')`."
                );
            else if (!/^n\/a:/.test(reason))
                add(
                    `a conditional skip is only for a test that does not apply here — its reason starts with "n/a:" (got "${reason}"). ${quarantine ? 'A known defect uses the quarantine form with a FIXME comment.' : 'A known defect stays a failing test.'}`
                );
            else if (!listed(reason.slice(4).trim()))
                add(
                    `the skip reason "${reason.slice(4).trim()}" is not listed in the "## Skipped tests" section of ${planPath}.`
                );
            continue;
        }
        // test.skip(title, details, body): a quarantined known defect
        if (!quarantine) {
            add(
                `known defects stay failing tests in this project (\`plans.knownDefects: fail\`) — remove the skip and list the failure in the plan under "Why tests currently fail".`
            );
            continue;
        }
        const above = text.slice(0, m.index).split('\n').slice(0, -1).reverse();
        const comments = [];
        for (const l of above) {
            if (!/^\s*\/\//.test(l)) break;
            comments.push(l);
        }
        const id = comments
            .map((l) => /\/\/\s*FIXME:\s*(\S+)/.exec(l)?.[1])
            .find(Boolean)
            ?.replace(/[:,;.]+$/, '');
        if (!id) {
            add(
                'a quarantined test needs a `// FIXME: <defect ID> — <what is wrong>` comment directly above it.'
            );
            continue;
        }
        // With a tracker in the profile, the defect ID is one of its ticket IDs
        const idPattern = profile.tracker?.idPattern;
        let trackerId = true;
        try {
            trackerId = !idPattern || new RegExp(`^(?:${idPattern})$`).test(id);
        } catch {
            // an invalid pattern is the profile check's finding, not this rule's
        }
        if (!trackerId) {
            add(
                `the defect ID "${id}" does not look like a ticket of this project's tracker (profile \`tracker.idPattern\`: ${idPattern}).`
            );
            continue;
        }
        const details = args[1] ?? '';
        const description =
            /\bdescription\s*:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/.exec(
                details
            )?.[2];
        if (
            !/\bannotation\s*:/.test(details) ||
            !/\btype\s*:\s*['"`]defect['"`]/.test(details) ||
            !description?.includes(id)
        )
            add(
                `a quarantined test carries \`annotation: { type: 'defect', description: '${id} — …' }\` in its details, so reports show why it is skipped.`
            );
        else if (!listed(id))
            add(
                `defect ${id} is not listed in the "## Skipped tests" section of ${planPath}.`
            );
    }
    return problems;
}

/**
 * The rules. `active(profile)` decides whether a rule applies to this
 * project; `applies(profile, path)` picks the files; `check(content, profile,
 * context)` returns a violation message, a list of them, or nothing.
 * `check: null` forbids the file itself.
 */
export const RULES = [
    {
        id: 'no-hard-wait',
        rule: 'FW-01',
        active: () => true,
        applies: (_p, path) => /\.ts$/.test(path),
        check: (c) =>
            c.includes('waitForTimeout(')
                ? '`waitForTimeout()` is forbidden — use a web-first assertion such as `expect(locator).toBeVisible()`.'
                : null,
    },
    {
        id: 'no-xpath',
        rule: 'FW-03',
        active: () => true,
        applies: (p, path) =>
            /\.ts$/.test(path) &&
            [p.paths?.pageObjects, p.paths?.components, p.paths?.tests].some(
                (f) => under(path, f)
            ),
        check: (c) =>
            /xpath=|locator\(\s*[`'"]\/\//.test(c)
                ? 'XPath selectors are forbidden — use getByRole > getByLabel > getByPlaceholder > getByText > getByTestId.'
                : null,
    },
    {
        id: 'skip-reason',
        rule: 'INV-02',
        active: () => true,
        applies: (p, path) => isSpec(p, path),
        // In hook mode the check sees the whole edited file (`context.full`)
        // but reports only the skips inside the added text (`context.ranges`)
        check: (c, p, context = {}) => {
            const inRange = (i) =>
                !context.ranges ||
                context.ranges.some(([from, to]) => i >= from && i < to);
            return skipProblems(context.full ?? c, p, context.read)
                .filter((s) => inRange(s.index))
                .map((s) => s.message);
        },
    },
    {
        id: 'no-body-cast',
        rule: 'FW-04',
        active: () => true,
        // Where responses are consumed; a type parameter (`as T`) is the
        // request layer typing its own result
        applies: (p, path) =>
            /\.ts$/.test(path) &&
            [p.paths?.tests, p.paths?.fixtures, p.paths?.helpers].some((f) =>
                under(path, f)
            ),
        check: (c) =>
            /\bbody\)?\s+as\s+(?!const\b|[A-Z]\b)/.test(c)
                ? 'A response body is never cast with `as` — parse it with its schema (API specs), or read the field setup needs with a runtime check: `z.looseObject({ token: z.string() }).parse(body)`.'
                : null,
    },
    {
        id: 'test-entry-import',
        rule: 'DEF-02',
        active: (p) =>
            Boolean(p.paths?.testEntry) &&
            p.paths.testEntry !== '@playwright/test' &&
            !overridden(p, 'DEF-02'),
        applies: (p, path) => isSpec(p, path),
        check: (c, p) =>
            /from\s+['"]@playwright\/test['"]/.test(c)
                ? `Specs import \`test\` / \`expect\` from \`${p.paths.testEntry}\`, never from \`@playwright/test\`.`
                : null,
    },
    {
        id: 'strict-schema',
        rule: 'DEF-03',
        active: (p) =>
            p.validation?.library === 'zod' &&
            p.validation?.unknownFieldPolicy === 'strict' &&
            !overridden(p, 'DEF-03'),
        applies: (p, path) => {
            const schemas = p.paths?.schemas;
            return (
                Boolean(schemas) &&
                /\.ts$/.test(path) &&
                (under(path, schemas) ||
                    under(path, join(dirname(schemas), 'util')))
            );
        },
        check: (c) =>
            /\bz\.object\(/.test(c)
                ? 'API schemas use `z.strictObject()`, never `z.object()`.'
                : null,
    },
    {
        id: 'allowed-tags',
        rule: 'DEF-06',
        active: (p) =>
            Array.isArray(p.tags?.allowed) &&
            p.tags.allowed.length > 0 &&
            !overridden(p, 'DEF-06'),
        applies: (p, path) => isSpec(p, path),
        check: (c, p) => {
            const options = tagOptions(c);
            const unknown = [
                ...new Set(
                    options.flat().filter((t) => !p.tags.allowed.includes(t))
                ),
            ];
            if (unknown.length)
                return `Tag(s) ${unknown.join(', ')} not in the profile's tags.allowed (${p.tags.allowed.join(' ')}).`;
            if (
                p.tags.perTest &&
                options.some((tags) => tags.length > p.tags.perTest)
            )
                return `A test has more than ${p.tags.perTest} tag(s).`;
            return null;
        },
    },
    {
        id: 'no-tags-on-describe',
        rule: 'DEF-06',
        active: (p) => !overridden(p, 'DEF-06'),
        applies: (p, path) => isSpec(p, path),
        check: (c) =>
            /test\.describe(?:\.\w+)?\(\s*(?:[`'"][^`'"]*@[\w-]+|[`'"][^`'"]*[`'"]\s*,\s*\{\s*tag\s*:)/.test(
                c
            )
                ? 'Tags belong on individual tests, never on `test.describe()`.'
                : null,
    },
    {
        id: 'no-json-static-data',
        rule: 'DEF-08',
        active: (p) =>
            p.data?.staticFormat === 'ts-as-const' &&
            Boolean(p.paths?.staticData) &&
            !overridden(p, 'DEF-08'),
        applies: (p, path) =>
            /\.json$/.test(path) && under(path, dirname(p.paths.staticData)),
        check: null,
        message:
            'Static test data is TypeScript with `as const` exports — JSON is not allowed here.',
    },
];

/**
 * Checks one file's content (or the text a tool call adds) against the rules.
 *
 * @param {Record<string, any>} profile - The profile front matter.
 * @param {string} path - Repository-relative path, forward slashes.
 * @param {string} content - Text to check.
 * @param {{ read?: (path: string) => string | null, full?: string, ranges?: Array<[number, number]> }} [context] -
 *   `read` reads repository files (cross-checks); hook mode adds the whole edited file and the added ranges.
 * @returns {string[]} Violations, "[id · RULE] message".
 */
export function checkContent(profile, path, content, context = {}) {
    const violations = [];
    for (const r of RULES) {
        if (!r.active(profile) || !r.applies(profile, path)) continue;
        const result =
            r.check === null ? r.message : r.check(content, profile, context);
        for (const message of [result].flat().filter(Boolean))
            violations.push(`[${r.id} · ${r.rule}] ${message}`);
    }
    return violations;
}

/** Files the kit owns — scanned for project terms (one list with the installer) */
export const KIT_FILES = KIT;

/**
 * Project terms found in kit files (outside the generated summary blocks and
 * the profile's recorded exceptions).
 *
 * @param {Record<string, any>} profile - The profile.
 * @param {string[]} files - Repository-relative paths.
 * @param {(path: string) => string} read - Reads a file.
 * @returns {string[]} Violations.
 */
export function leaks(profile, files, read) {
    const terms = profile.projectTerms ?? [];
    const exceptions = new Set(
        (profile.termExceptions ?? []).map((e) => e.path)
    );
    const problems = [];
    for (const path of files) {
        if (!KIT_FILES.some((re) => re.test(path)) || exceptions.has(path))
            continue;
        let text = read(path);
        const from = text.indexOf(START);
        const to = text.indexOf(END);
        if (from >= 0 && to > from)
            text = text.slice(0, from) + text.slice(to + END.length);
        for (const term of terms) {
            if (text.includes(term))
                problems.push(
                    `[kit-leak · INV] ${path}: project term "${term}" in a kit file — move it to PROJECT-PROFILE.md, or record a termException with its reason`
                );
        }
    }
    return problems;
}

/**
 * Packages imported by kit scripts that package.json does not declare.
 *
 * @param {string} root - Repository root.
 * @param {string[]} files - Repository-relative paths.
 * @returns {string[]} Violations.
 */
export function undeclaredDependencies(root, files) {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const declared = new Set([
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.devDependencies ?? {}),
    ]);
    const problems = [];
    for (const path of files.filter((f) => /^scripts\/.*\.m?js$/.test(f))) {
        // Comments are not imports — drop block and line comments first
        const text = readFileSync(join(root, path), 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, '');
        // Real import statements only: `import … from 'x'`, a multi-line
        // import's closing `} from 'x'`, a bare `import 'x'`, or a dynamic
        // import called in code (after `await`, `=` or `(`)
        const imports =
            /^\s*(?:import|export)\s[^\n]*?\sfrom\s+['"]([^'"]+)['"]|^\s*\}\s*from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]|(?:\bawait|=|\()\s*import\(\s*['"]([^'"]+)['"]\s*\)/gm;
        for (const m of text.matchAll(imports)) {
            const spec = m[1] ?? m[2] ?? m[3] ?? m[4];
            if (spec.startsWith('.') || spec.startsWith('/')) continue;
            if (spec.startsWith('node:') || builtinModules.includes(spec))
                continue;
            const name = spec.startsWith('@')
                ? spec.split('/').slice(0, 2).join('/')
                : spec.split('/')[0];
            if (!declared.has(name))
                problems.push(
                    `[kit-deps · INV] ${path}: imports "${name}", which package.json does not declare`
                );
        }
    }
    return problems;
}

/**
 * The text a Claude Code tool call would add to a file.
 *
 * @param {{ tool_name?: string, tool_input?: Record<string, any> }} payload - Hook payload.
 * @returns {string} Added text.
 */
export function addedText(payload) {
    const input = payload.tool_input ?? {};
    if (payload.tool_name === 'Write') return input.content ?? '';
    if (payload.tool_name === 'Edit') return input.new_string ?? '';
    if (payload.tool_name === 'MultiEdit')
        return (input.edits ?? []).map((e) => e.new_string ?? '').join('\n');
    return '';
}

/**
 * The whole file a Write or Edit would produce, and where its added text
 * sits — so a rule that needs the surrounding lines (a comment above an
 * edited call, the spec's plan header) sees them. `{}` when unknown
 * (MultiEdit, or an Edit whose file or old text is not found).
 *
 * @param {string} root - Repository root.
 * @param {string} path - Repository-relative path.
 * @param {{ tool_name?: string, tool_input?: Record<string, any> }} payload - Hook payload.
 * @returns {{ full?: string, ranges?: Array<[number, number]> }} The edited file and added ranges.
 */
export function editedFile(root, path, payload) {
    const input = payload.tool_input ?? {};
    if (payload.tool_name === 'Write') return { full: input.content ?? '' };
    if (payload.tool_name !== 'Edit' || !input.old_string) return {};
    const file = join(root, path);
    if (!existsSync(file)) return {};
    const before = readFileSync(file, 'utf8');
    const added = input.new_string ?? '';
    let full = '';
    const ranges = [];
    let from = 0;
    for (;;) {
        const at = before.indexOf(input.old_string, from);
        if (at < 0) break;
        full += before.slice(from, at);
        ranges.push([full.length, full.length + added.length]);
        full += added;
        from = at + input.old_string.length;
        if (!input.replace_all) break;
    }
    if (!ranges.length) return {};
    return { full: full + before.slice(from), ranges };
}

/**
 * Hook mode: decide one tool call.
 *
 * @param {string} root - Repository root.
 * @param {object} payload - Hook payload.
 * @returns {string[]} Violations (empty → allow).
 */
export function hookViolations(root, payload) {
    const file = payload.tool_input?.file_path;
    if (!file || !['Write', 'Edit', 'MultiEdit'].includes(payload.tool_name))
        return [];
    const path = relative(root, isAbsolute(file) ? file : resolve(file))
        .split(sep)
        .join('/');
    if (path.startsWith('..') || isAbsolute(path)) return []; // outside this repository
    return checkContent(readProfile(root), path, addedText(payload), {
        read: readRepoFile(root),
        ...editedFile(root, path, payload),
    });
}

/** A reader for repository files that yields null for a missing file */
const readRepoFile = (root) => (path) => {
    const file = join(root, path);
    return existsSync(file) && statSync(file).isFile()
        ? readFileSync(file, 'utf8')
        : null;
};

/** CLI entry point */
function main() {
    const args = process.argv.slice(2);
    const rootIndex = args.indexOf('--root');
    const root =
        rootIndex >= 0
            ? resolve(args[rootIndex + 1])
            : resolve(dirname(fileURLToPath(import.meta.url)), '..');

    if (args.includes('--hook')) {
        let payload;
        try {
            payload = JSON.parse(readFileSync(0, 'utf8'));
        } catch {
            process.exit(0); // never block on hook infrastructure errors
        }
        const violations = hookViolations(root, payload);
        if (violations.length) {
            console.error(
                `BLOCKED by the rule check (${payload.tool_input.file_path}):\n${violations.map((v) => `  - ${v}`).join('\n')}`
            );
            process.exit(2);
        }
        process.exit(0);
    }

    let files;
    if (args.includes('--all')) {
        files = execFileSync('git', ['ls-files'], {
            cwd: root,
            encoding: 'utf8',
        })
            .split('\n')
            .filter(Boolean);
    } else if (args.includes('--files')) {
        files = args
            .slice(args.indexOf('--files') + 1)
            .filter((a) => !a.startsWith('--') && a !== args[rootIndex + 1]);
    } else {
        console.error(
            'usage: node scripts/rule-check.mjs (--all | --files <paths…> | --hook) [--root <dir>]'
        );
        process.exit(2);
    }
    const profile = readProfile(root);
    // only existing regular files (a tracked symlink to a folder, e.g. node_modules, is skipped)
    files = files.filter(
        (path) =>
            existsSync(join(root, path)) && statSync(join(root, path)).isFile()
    );
    const read = (path) => readFileSync(join(root, path), 'utf8');
    const problems = [];
    for (const path of files) {
        for (const v of checkContent(profile, path, read(path), {
            read: readRepoFile(root),
        }))
            problems.push(`${path}: ${v}`);
    }
    if (args.includes('--all')) {
        problems.push(...leaks(profile, files, read));
        problems.push(...undeclaredDependencies(root, files));
    }
    for (const p of problems) console.log(`VIOLATION ${p}`);
    const active = RULES.filter((r) => r.active(profile)).map((r) => r.id);
    console.log(
        `\nRule check: ${files.length} file(s), rules ${active.join(', ')}${args.includes('--all') ? ', kit-leak, kit-deps' : ''} — ${problems.length} violation(s).`
    );
    process.exit(problems.length ? 1 : 0);
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
    main();
