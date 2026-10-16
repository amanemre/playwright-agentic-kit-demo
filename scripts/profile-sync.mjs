#!/usr/bin/env node
/**
 * profile-sync.mjs — keeps the constitution files in step with PROJECT-PROFILE.md.
 *
 * PROJECT-PROFILE.md (repository root) is the single source of project facts:
 * YAML front matter for the machine-readable part, Markdown for the rest. This
 * script validates the front matter and renders a summary of it into the block
 * between `<!-- profile:start -->` and `<!-- profile:end -->` in each tool's
 * always-loaded constitution file. Content outside the block is never touched.
 *
 *   node scripts/profile-sync.mjs --check   validate + fail on stale summaries (default)
 *   node scripts/profile-sync.mjs --write   validate + rewrite stale summaries
 *   --root <dir>                            repository root (default: the parent of scripts/)
 *
 * Commands listed in the profile are data: this script never executes them.
 * Exit code 0 = valid and in sync; 1 = problems (listed); 2 = usage error.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod/v4';

export const PROFILE_FILE = 'PROJECT-PROFILE.md';
export const START = '<!-- profile:start -->';
export const END = '<!-- profile:end -->';

/** Always-loaded instruction file of each supported tool */
export const TARGETS = [
    'CLAUDE.md',
    '.cursor/rules/rules.mdc',
    '.github/copilot-instructions.md',
];

/**
 * Preset defaults that a project may change only with a recorded override.
 * key: dotted profile key → [rule ID in RULE-INVENTORY.md, preset value]
 */
export const PRESET_DEFAULTS = {
    'architecture.pageAccess': ['DEF-01', 'pageManager'],
    'validation.unknownFieldPolicy': ['DEF-03', 'strict'],
    'validation.library': ['DEF-04', 'zod'],
    'reporting.style': ['DEF-05', 'readable-steps'],
    'tags.perTest': ['DEF-06', 1],
    'plans.headingIsTitle': ['DEF-07', true],
    'data.staticFormat': ['DEF-08', 'ts-as-const'],
    'data.factories': ['DEF-09', 'faker'],
    'lifecycle.setupVia': ['DEF-16', 'api'],
    'exploration.tool': ['DEF-17', 'playwright-cli'],
    'api.coverage': ['DEF-18', 'full-matrix'],
    'plans.knownDefects': ['DEF-20', 'fail'],
    'delivery.branchPattern': ['DEF-21', '{type}/{ticket}-{short-name}'],
    'delivery.commitStyle': ['DEF-21', 'conventional'],
    'ci.gate': ['DEF-22', 'summary'],
    'ci.pullRequest': ['DEF-22', 'smoke+changed'],
};

/** Outward actions a user may approve in advance (`standingApprovals`) */
export const APPROVABLE = [
    'post-run-summary',
    'open-triage-issue',
    'push-fixes-as-draft-pr',
];
/** Actions no standing approval can cover — they stay with a person, every time */
export const NEVER_APPROVABLE = [
    'merge',
    'push-to-base-branch',
    'force-push',
    'mark-known-defect',
    'file-confirmed-defect',
    'weaken-test',
    'skip-test',
];

/**
 * The standing approvals that count on a given day.
 *
 * @param {{ standingApprovals?: Array<{ action: string, date: string, expires: string }> }} profile - The profile.
 * @param {string} [today] - ISO date (default: now).
 * @returns {Array<{ action: string, date: string, expires: string }>} Approvals in force.
 */
export function activeApprovals(
    profile,
    today = new Date().toISOString().slice(0, 10)
) {
    return (profile.standingApprovals ?? []).filter(
        (a) =>
            APPROVABLE.includes(a.action) &&
            a.date <= today &&
            today <= a.expires
    );
}

/** Preset defaults that only apply when the project has the capability */
export const NEEDS_CAPABILITY = {
    'architecture.pageAccess': 'ui',
    'exploration.tool': 'ui',
    'validation.library': 'api',
    'validation.unknownFieldPolicy': 'api',
    'api.coverage': 'api',
};

const text = z.string().min(1);
const NONE = 'none';

export const ProfileSchema = z.strictObject({
    profileSchema: z.literal(1),
    kitVersion: text,
    project: z.strictObject({ name: text, app: text }),
    mode: z.enum(['adopt', 'scaffold']),
    preset: z.enum(['playwright-house-preset', NONE]),
    stack: z.strictObject({
        framework: z.literal('playwright'),
        language: z.literal('typescript'),
    }),
    capabilities: z.strictObject({
        ui: z.boolean(),
        api: z.boolean(),
        auth: text,
        contractValidation: text,
        reporting: z.array(text),
    }),
    paths: z.record(z.string(), text),
    packageManager: z.enum(['npm', 'pnpm', 'yarn', 'bun']),
    commands: z.record(z.string(), text),
    env: z.strictObject({
        selector: text.optional(),
        files: text,
        default: text.optional(),
        appUrl: text.optional(),
        apiUrl: text.optional(),
        credentials: z.array(text),
    }),
    hosts: z.array(text).min(1),
    exploration: z.strictObject({
        tool: text,
        fallbacks: z.array(
            z.strictObject({
                tool: text,
                approvedBy: text,
                date: z.iso.date(),
                reason: text,
            })
        ),
    }),
    execution: z.strictObject({
        repairAttempts: z.int().min(0),
    }),
    architecture: z.strictObject({ pageAccess: text, pageObjects: text }),
    validation: z.strictObject({
        library: text,
        unknownFieldPolicy: text,
        assertionPattern: text,
    }),
    reporting: z.strictObject({
        style: text,
        helper: text.optional(),
        capture: text,
    }),
    tags: z.strictObject({
        allowed: z.array(z.string().startsWith('@')),
        perTest: z.int().min(0),
    }),
    plans: z.strictObject({
        headingIsTitle: z.boolean(),
        specHeader: text,
        knownDefects: z.enum(['fail', 'quarantine']),
    }),
    data: z.strictObject({ staticFormat: text, factories: text }),
    lifecycle: z.strictObject({ cleanup: text, setupVia: text }),
    api: z.strictObject({ coverage: text }),
    ci: z.strictObject({
        system: z.enum([
            'github-actions',
            'gitlab-ci',
            'azure-pipelines',
            'jenkins',
            'other',
            NONE,
        ]),
        gate: z.enum(['summary', 'exit-code']),
        pullRequest: z.enum(['smoke', 'smoke+changed', 'all']),
        shards: z.int().min(1),
        smokeTag: z.string().startsWith('@'),
        serialTag: z.string().startsWith('@').optional(),
    }),
    tracker: z.strictObject({
        system: z.enum([
            'github',
            'gitlab',
            'jira',
            'azure-boards',
            'linear',
            'other',
            NONE,
        ]),
        access: z.enum(['cli', 'mcp', 'manual']),
        project: text.optional(),
        idPattern: text.optional(),
        defectType: text.optional(),
    }),
    delivery: z.strictObject({
        host: z.enum([
            'github',
            'gitlab',
            'azure-devops',
            'bitbucket',
            'other',
        ]),
        baseBranch: text,
        cli: z.enum(['gh', 'glab', 'az', 'none']),
        branchPattern: text,
        commitStyle: text,
    }),
    overrides: z.array(
        z.strictObject({
            rule: z.string().regex(/^[A-Z]+-\d{2}$/),
            choice: text,
            reason: text,
            source: text.optional(),
        })
    ),
    projectTerms: z.array(text),
    termExceptions: z.array(z.strictObject({ path: text, reason: text })),
    // Optional: the model each role tier uses, per tool (scripts/roles-sync.mjs)
    agentModels: z
        .partialRecord(
            z.enum(['claude', 'cursor', 'copilot']),
            z.partialRecord(z.enum(['deep', 'balanced', 'fast']), text)
        )
        .optional(),
    standingApprovals: z.array(
        z.strictObject({
            action: text,
            limits: text,
            approvedBy: text,
            date: z.iso.date(),
            expires: z.iso.date(),
        })
    ),
    openQuestions: z.array(z.strictObject({ question: text, blocks: text })),
});

/**
 * Splits PROJECT-PROFILE.md into its YAML front matter and Markdown body.
 *
 * @param {string} source - The file's text.
 * @returns {{ yaml: string, body: string }} The two parts.
 */
export function splitFrontMatter(source) {
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
    if (!match) {
        throw new Error(
            `${PROFILE_FILE} must start with YAML front matter between "---" lines`
        );
    }
    return { yaml: match[1], body: match[2] };
}

/**
 * Reads a dotted key from an object.
 *
 * @param {Record<string, unknown>} object - The object.
 * @param {string} key - e.g. "reporting.style".
 * @returns {unknown} The value, or undefined.
 */
function valueAt(object, key) {
    return key
        .split('.')
        .reduce(
            (value, part) => (value == null ? undefined : value[part]),
            object
        );
}

/**
 * Rule IDs and their categories from RULE-INVENTORY.md (empty when it is absent).
 *
 * @param {string} root - Repository root.
 * @returns {Map<string, string>} rule ID → category (INV / FW / DEF).
 */
export function readRuleIds(root) {
    const file = join(root, 'RULE-INVENTORY.md');
    const ids = new Map();
    if (!existsSync(file)) return ids;
    for (const match of readFileSync(file, 'utf8').matchAll(
        /^\| ((INV|FW|DEF)-\d{2}) \|/gm
    )) {
        ids.set(match[1], match[2]);
    }
    return ids;
}

/**
 * The kit version recorded in KIT-MANIFEST.md ("Kit version: x.y.z"), if any.
 *
 * @param {string} root - Repository root.
 * @returns {string | undefined} The version.
 */
export function readKitVersion(root) {
    const file = join(root, 'KIT-MANIFEST.md');
    if (!existsSync(file)) return undefined;
    return /^Kit version: `?([^`\s]+)`?/m.exec(readFileSync(file, 'utf8'))?.[1];
}

/**
 * Checks a parsed profile for contradictions, unsupported overrides and
 * references to paths that do not exist.
 *
 * @param {z.infer<typeof ProfileSchema>} profile - The validated front matter.
 * @param {string} root - Repository root.
 * @returns {string[]} Problems found (empty when consistent).
 */
export function checkConsistency(profile, root) {
    const problems = [];
    const ruleIds = readRuleIds(root);
    const overridden = new Map(profile.overrides.map((o) => [o.rule, o]));

    const kitVersion = readKitVersion(root);
    if (kitVersion && kitVersion !== profile.kitVersion) {
        problems.push(
            `kitVersion ${profile.kitVersion} does not match KIT-MANIFEST.md (${kitVersion})`
        );
    }

    // Overrides may change preset defaults only — never invariants or framework rules
    for (const { rule } of profile.overrides) {
        const category = ruleIds.get(rule);
        if (ruleIds.size > 0 && !category) {
            problems.push(
                `override names unknown rule ${rule} (not in RULE-INVENTORY.md)`
            );
        } else if (category && category !== 'DEF') {
            problems.push(
                `override of ${rule} is not allowed: ${category} rules cannot be overridden`
            );
        }
    }

    // Every departure from a preset default needs a recorded override —
    // except a setting that does not apply because its capability is absent
    for (const [key, [rule, presetValue]] of Object.entries(PRESET_DEFAULTS)) {
        const value = valueAt(profile, key);
        const capability = NEEDS_CAPABILITY[key];
        if (capability && !profile.capabilities[capability]) continue;
        if (
            value !== undefined &&
            value !== presetValue &&
            !overridden.has(rule)
        ) {
            problems.push(
                `${key} is "${value}" but the preset default is "${presetValue}" — add an override for ${rule} with a reason`
            );
        }
    }

    // A non-strict unknown-field policy must cite the contract that documents it
    if (
        profile.validation.unknownFieldPolicy !== 'strict' &&
        !overridden.get('DEF-03')?.source
    ) {
        problems.push(
            'validation.unknownFieldPolicy differs from "strict": the DEF-03 override must cite the contract as its source'
        );
    }

    // Scaffold mode installs the preset, and the report structure is a rule there
    if (profile.mode === 'scaffold') {
        if (profile.preset !== 'playwright-house-preset') {
            problems.push(
                'mode "scaffold" installs the playwright-house-preset: set preset accordingly'
            );
        }
        if (profile.reporting.style !== 'readable-steps') {
            problems.push(
                'mode "scaffold": the readable report structure is a rule — reporting.style must be "readable-steps"'
            );
        }
    }
    if (
        profile.reporting.style === 'readable-steps' &&
        !profile.reporting.helper
    ) {
        problems.push(
            'reporting.style "readable-steps" needs reporting.helper (the soft-check helper, or a verified equivalent)'
        );
    }

    // Standing approvals: only the actions the kit allows, one each, with a real end date
    const approved = new Set();
    for (const approval of profile.standingApprovals) {
        const { action } = approval;
        if (NEVER_APPROVABLE.includes(action)) {
            problems.push(
                `standingApprovals: "${action}" can never be approved in advance — it needs a person's decision every time`
            );
        } else if (!APPROVABLE.includes(action)) {
            problems.push(
                `standingApprovals: unknown action "${action}" — approvable: ${APPROVABLE.join(', ')}`
            );
        }
        if (approved.has(action))
            problems.push(`standingApprovals: "${action}" is listed twice`);
        approved.add(action);
        if (approval.expires <= approval.date)
            problems.push(
                `standingApprovals: "${action}" expires (${approval.expires}) on or before the day it was given (${approval.date})`
            );
    }

    // The tags CI selects by must be tags the project uses
    for (const key of ['smokeTag', 'serialTag']) {
        const tag = profile.ci[key];
        if (
            tag &&
            profile.tags.allowed.length &&
            !profile.tags.allowed.includes(tag)
        )
            problems.push(
                `ci.${key} "${tag}" is not in tags.allowed (${profile.tags.allowed.join(' ')})`
            );
    }

    // The tracker: how it is reached must be possible, and its IDs recognisable
    const TRACKER_CLI = ['github', 'gitlab', 'jira', 'azure-boards'];
    const { tracker } = profile;
    if (tracker.system === NONE && tracker.access !== 'manual') {
        problems.push(
            'tracker.system is "none": tracker.access must be "manual"'
        );
    }
    if (tracker.access === 'cli' && !TRACKER_CLI.includes(tracker.system)) {
        problems.push(
            `tracker.access "cli" is not available for tracker.system "${tracker.system}" — use "mcp" or "manual"`
        );
    }
    if (tracker.system !== NONE && !tracker.idPattern) {
        problems.push(
            'tracker.idPattern is missing: it tells ticket and defect IDs apart from other text'
        );
    }
    if (tracker.idPattern) {
        try {
            new RegExp(tracker.idPattern);
        } catch {
            problems.push(
                `tracker.idPattern "${tracker.idPattern}" is not a valid regular expression`
            );
        }
    }

    // The command-line tool must belong to the host
    const HOST_CLI = { github: 'gh', gitlab: 'glab', 'azure-devops': 'az' };
    if (
        profile.delivery.cli !== NONE &&
        HOST_CLI[profile.delivery.host] !== profile.delivery.cli
    ) {
        problems.push(
            `delivery.cli "${profile.delivery.cli}" does not work with delivery.host "${profile.delivery.host}" — use ${HOST_CLI[profile.delivery.host] ? `"${HOST_CLI[profile.delivery.host]}" or ` : ''}"none"`
        );
    }

    // Capabilities must agree with the conventions that depend on them
    if (!profile.capabilities.ui && profile.architecture.pageAccess !== NONE) {
        problems.push(
            'capabilities.ui is false: architecture.pageAccess must be "none"'
        );
    }
    if (
        profile.capabilities.api &&
        profile.capabilities.contractValidation === NONE
    ) {
        problems.push(
            'capabilities.api is true: API specs validate against the contract — contractValidation cannot be "none"'
        );
    }
    if (!profile.capabilities.api && profile.api.coverage !== NONE) {
        problems.push('capabilities.api is false: api.coverage must be "none"');
    }
    if (profile.tags.perTest > 0 && profile.tags.allowed.length === 0) {
        problems.push('tags.perTest > 0 needs a non-empty tags.allowed list');
    }

    // Paths must exist (the area name is a folder name, not a path)
    const paths = Object.entries(profile.paths).filter(
        ([key, value]) => key !== 'area' && value !== NONE
    );
    if (profile.reporting.helper)
        paths.push(['reporting.helper', profile.reporting.helper]);
    for (const { path } of profile.termExceptions)
        paths.push(['termExceptions', path]);
    for (const [key, value] of paths) {
        // the test entry may be a package (an adopted suite importing from @playwright/test)
        const isPackage =
            key === 'testEntry' &&
            existsSync(join(root, 'node_modules', value));
        if (!isPackage && !existsSync(join(root, value)))
            problems.push(`${key}: path "${value}" does not exist`);
    }

    return problems;
}

/**
 * Renders the summary block that goes into each constitution file.
 *
 * @param {z.infer<typeof ProfileSchema>} p - The validated front matter.
 * @returns {string} The block, markers included.
 */
export function renderSummary(p) {
    const code = (value) => `\`${value}\``;
    const list = (values) =>
        values.length ? values.map(code).join(', ') : 'none';
    const pathLine = Object.entries(p.paths)
        .map(([key, value]) => `${key} ${code(value)}`)
        .join(' · ');
    const commandLine = Object.entries(p.commands)
        .map(([key, value]) => `${key} ${code(value)}`)
        .join(' · ');
    const overrides = p.overrides.length
        ? p.overrides
              .map((o) => `${o.rule} → ${o.choice} (${o.reason})`)
              .join('; ')
        : 'none — every preset default applies';
    const fallbacks = p.exploration.fallbacks.length
        ? p.exploration.fallbacks
              .map((f) => `${f.tool} (approved by ${f.approvedBy}, ${f.date})`)
              .join(', ')
        : 'none approved';

    return [
        START,
        '<!-- Generated from PROJECT-PROFILE.md by `npm run profile:sync` — edit the profile, not this block. -->',
        '',
        '## Project Profile (summary)',
        '',
        `Source: \`${PROFILE_FILE}\` (profile schema ${p.profileSchema}, kit ${p.kitVersion}). Read it — or the \`project-profile\` skill — for the full facts, API conventions and examples. Rules marked as preset defaults apply as overridden below; invariants always apply.`,
        '',
        `- **Project:** ${p.project.name} — ${p.project.app}`,
        `- **Mode / preset:** ${p.mode} · ${p.preset}`,
        `- **Capabilities:** UI ${p.capabilities.ui ? 'yes' : 'no'} · API ${p.capabilities.api ? 'yes' : 'no'} · auth: ${p.capabilities.auth} · contract validation: ${p.capabilities.contractValidation}`,
        `- **Overrides of preset defaults:** ${overrides}`,
        `- **Paths:** ${pathLine}`,
        `- **Env var names:** URLs ${list([p.env.appUrl, p.env.apiUrl].filter(Boolean))} · credentials ${list(p.env.credentials)} · values in ${code(p.env.files)}${p.env.default ? ` (default ${code(p.env.default)})` : ''}${p.env.selector ? `, chosen by ${code(p.env.selector)}` : ''}`,
        `- **Commands** (verified references; run only after checking their target): ${commandLine}`,
        `- **Exploration:** ${code(p.exploration.tool)} · fallbacks: ${fallbacks}`,
        `- **CI:** ${p.ci.system === NONE ? 'none' : `${p.ci.system} · pull requests run ${p.ci.pullRequest} · ${p.ci.shards} shard(s) · the pipeline result follows ${p.ci.gate === 'summary' ? 'the run summary (new failures and unstable tests fail it; known defects do not)' : "Playwright's exit code"} (the \`ci\` skill)`}`,
        `- **Tracker:** ${p.tracker.system === NONE ? 'none — tickets and defects go through the user' : `${p.tracker.system} (${p.tracker.access})${p.tracker.project ? ` · project ${code(p.tracker.project)}` : ''}${p.tracker.idPattern ? ` · IDs ${code(p.tracker.idPattern)}` : ''}${p.tracker.defectType ? ` · defects as ${code(p.tracker.defectType)}` : ''} (the \`tracker\` skill)`}`,
        `- **Delivery:** ${p.delivery.host} · base ${code(p.delivery.baseBranch)} · CLI ${p.delivery.cli} · branches ${code(p.delivery.branchPattern)} · commits ${p.delivery.commitStyle} (the \`pull-requests\` skill)`,
        `- **Conventions:** report style ${p.reporting.style}${p.reporting.helper ? ` (${code(p.reporting.helper)})` : ''} · tags ${list(p.tags.allowed)}, ${p.tags.perTest} per test · validation ${p.validation.library} (${p.validation.unknownFieldPolicy}), ${code(p.validation.assertionPattern)} · static data ${p.data.staticFormat} · factories ${p.data.factories} · GIVEN state via ${p.lifecycle.setupVia} · known defects ${p.plans.knownDefects === 'quarantine' ? 'quarantined (skipped: FIXME comment + defect annotation, listed in the plan)' : 'stay failing tests'}`,
        `- **Standing approvals:** ${p.standingApprovals.length ? `${p.standingApprovals.map((a) => `${code(a.action)} (${a.approvedBy}, until ${a.expires})`).join(' · ')} — each counts only until its date, within its limits` : "none — every outward step needs the user's go-ahead"}`,
        `- **Open questions:** ${p.openQuestions.length ? `${p.openQuestions.length} — listed in the profile` : 'none'}`,
        '',
        END,
    ].join('\n');
}

/**
 * Replaces the managed block in a file's text.
 *
 * @param {string} source - The file's text.
 * @param {string} block - The new block, markers included.
 * @returns {{ text?: string, problem?: string }} The new text, or why it cannot be updated.
 */
export function replaceBlock(source, block) {
    const starts = source.split(START).length - 1;
    const ends = source.split(END).length - 1;
    if (starts !== 1 || ends !== 1) {
        return {
            problem: `needs exactly one ${START} and one ${END} (found ${starts} / ${ends})`,
        };
    }
    const from = source.indexOf(START);
    const to = source.indexOf(END);
    if (to < from) return { problem: `${END} comes before ${START}` };
    return {
        text: source.slice(0, from) + block + source.slice(to + END.length),
    };
}

/**
 * Validates the profile and checks (or rewrites) every managed block.
 *
 * @param {{ root: string, write: boolean }} options - Repository root and mode.
 * @returns {{ problems: string[], updated: string[] }} What is wrong, and which files were rewritten.
 */
export function run({ root, write }) {
    const problems = [];
    const updated = [];
    const profilePath = join(root, PROFILE_FILE);
    if (!existsSync(profilePath))
        return { problems: [`${PROFILE_FILE} not found in ${root}`], updated };

    let profile;
    try {
        const { yaml } = splitFrontMatter(readFileSync(profilePath, 'utf8'));
        const parsed = ProfileSchema.safeParse(parseYaml(yaml));
        if (!parsed.success) {
            return {
                problems: parsed.error.issues.map(
                    (issue) =>
                        `${PROFILE_FILE}: ${issue.path.join('.') || '(root)'} — ${issue.message}`
                ),
                updated,
            };
        }
        profile = parsed.data;
    } catch (error) {
        return { problems: [`${PROFILE_FILE}: ${error.message}`], updated };
    }

    problems.push(...checkConsistency(profile, root));

    const block = renderSummary(profile);
    for (const target of TARGETS) {
        const file = join(root, target);
        if (!existsSync(file)) {
            problems.push(`${target}: not found`);
            continue;
        }
        const source = readFileSync(file, 'utf8');
        const { text, problem } = replaceBlock(source, block);
        if (problem) {
            problems.push(`${target}: ${problem}`);
        } else if (text !== source) {
            if (write) {
                writeFileSync(file, text);
                updated.push(target);
            } else {
                problems.push(
                    `${target}: profile summary is stale — run \`npm run profile:sync\``
                );
            }
        }
    }
    return { problems, updated };
}

/** CLI entry point */
function main() {
    const args = process.argv.slice(2);
    const unknown = args.filter(
        (a, i) =>
            !['--check', '--write', '--root'].includes(a) &&
            args[i - 1] !== '--root'
    );
    if (
        unknown.length ||
        (args.includes('--check') && args.includes('--write'))
    ) {
        console.error(
            'usage: node scripts/profile-sync.mjs [--check | --write] [--root <dir>]'
        );
        process.exit(2);
    }
    const rootIndex = args.indexOf('--root');
    const root =
        rootIndex >= 0
            ? resolve(args[rootIndex + 1])
            : resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const { problems, updated } = run({
        root,
        write: args.includes('--write'),
    });

    for (const file of updated) console.log(`UPDATED ${file}`);
    for (const problem of problems) console.log(`PROBLEM ${problem}`);
    console.log(
        `\nProfile check: ${problems.length} problem(s)${updated.length ? `, ${updated.length} file(s) updated` : ''}.`
    );
    process.exit(problems.length ? 1 : 0);
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
    main();
