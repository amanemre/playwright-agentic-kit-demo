#!/usr/bin/env node
/**
 * ci-publish.mjs — publishes a run's results from CI, only under a standing approval.
 *
 * Posting on a pull request or opening an issue is an outward step. This
 * script takes it only when PROJECT-PROFILE.md holds a standing approval for
 * exactly that action, in force today (`standingApprovals`, INV-10); otherwise
 * it says so and publishes nothing — the files stay in reports/.
 *
 *   node scripts/ci-publish.mjs --what run-summary [--pr <number>]   approval: post-run-summary
 *   node scripts/ci-publish.mjs --what triage-issue                  approval: open-triage-issue
 *   --dry-run        print what would be published, publish nothing
 *   --root <dir>     repository root (default: the parent of scripts/)
 *
 * Automated for GitHub with the `gh` CLI. On other hosts and trackers it
 * names the file to post by hand. Every published text names the approval it
 * was posted under.
 * Exit code 0 = published, or nothing to publish; 1 = publishing failed; 2 = usage error.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import {
    PROFILE_FILE,
    activeApprovals,
    splitFrontMatter,
} from './profile-sync.mjs';

export const TRIAGE_TITLE = '[needs confirmation] Test triage';
const WHAT = {
    'run-summary': {
        action: 'post-run-summary',
        file: 'reports/run-summary.md',
    },
    'triage-issue': {
        action: 'open-triage-issue',
        file: 'reports/triage.md',
    },
};

/**
 * Decides whether, and how, something may be published.
 *
 * @param {{ profile: Record<string, any>, what: string, today?: string }} options - The profile, what to publish, the date.
 * @returns {{ publish: boolean, reason: string, approval?: object, file?: string }} The decision.
 */
export function decide({ profile, what, today }) {
    const { action, file } = WHAT[what];
    const approval = activeApprovals(profile, today).find(
        (a) => a.action === action
    );
    if (!approval)
        return {
            publish: false,
            reason: `no standing approval \`${action}\` is in force — nothing published; the result is in ${file}`,
        };
    const automated =
        what === 'run-summary'
            ? profile.delivery?.host === 'github' &&
              profile.delivery?.cli === 'gh'
            : profile.tracker?.system === 'github' &&
              profile.tracker?.access === 'cli';
    if (!automated)
        return {
            publish: false,
            approval,
            reason: `the approval \`${action}\` is in force, but publishing is automated for GitHub with gh only — post ${file} by hand`,
        };
    return { publish: true, approval, file, reason: `under \`${action}\`` };
}

/**
 * The text to publish: the file, and the approval it is published under.
 *
 * @param {string} content - The file's content.
 * @param {{ action: string, approvedBy: string, date: string, expires: string, limits: string }} approval - The approval.
 * @returns {string} The body.
 */
export function withApproval(content, approval) {
    return `${content.trimEnd()}\n\n---\n\n_Published automatically under the standing approval \`${approval.action}\` — ${approval.approvedBy}, ${approval.date}, until ${approval.expires}; limits: ${approval.limits}._\n`;
}

const gh = (root, args) =>
    spawnSync('gh', args, { cwd: root, encoding: 'utf8' });

/** CLI entry point */
function main() {
    const args = process.argv.slice(2);
    const valueOf = (flag) =>
        args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
    const what = valueOf('--what');
    if (!WHAT[what]) {
        console.error(
            'usage: node scripts/ci-publish.mjs --what (run-summary [--pr <number>] | triage-issue) [--dry-run] [--root <dir>]'
        );
        process.exit(2);
    }
    const root = valueOf('--root')
        ? resolve(valueOf('--root'))
        : resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const profile =
        parseYaml(
            splitFrontMatter(readFileSync(join(root, PROFILE_FILE), 'utf8'))
                .yaml
        ) ?? {};
    const decision = decide({ profile, what });
    if (!decision.publish) {
        console.log(`Not published: ${decision.reason}.`);
        return;
    }
    const source = join(root, decision.file);
    if (!existsSync(source)) {
        console.log(
            `Not published: ${decision.file} does not exist — nothing to publish.`
        );
        return;
    }
    const body = join(root, `${decision.file}.published.md`);
    writeFileSync(
        body,
        withApproval(readFileSync(source, 'utf8'), decision.approval)
    );
    let command;
    if (what === 'run-summary') {
        // one comment per pull request, updated in place
        command = [
            'pr',
            'comment',
            ...(valueOf('--pr') ? [valueOf('--pr')] : []),
            '--body-file',
            body,
            '--edit-last',
            '--create-if-none',
        ];
    } else {
        // one open triage issue at a time: add to it when it exists
        const open = gh(root, [
            'issue',
            'list',
            '--state',
            'open',
            '--search',
            `"${TRIAGE_TITLE}" in:title`,
            '--json',
            'number',
            '-q',
            '.[0].number',
        ]).stdout?.trim();
        command = open
            ? ['issue', 'comment', open, '--body-file', body]
            : ['issue', 'create', '--title', TRIAGE_TITLE, '--body-file', body];
    }
    if (args.includes('--dry-run')) {
        console.log(
            `Would publish ${decision.reason}: gh ${command.join(' ')}`
        );
        return;
    }
    const result = gh(root, command);
    if (result.status !== 0) {
        console.error(`Publishing failed: ${result.stderr?.trim()}`);
        process.exit(1);
    }
    console.log(`Published ${decision.reason}: ${result.stdout?.trim()}`);
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
    main();
