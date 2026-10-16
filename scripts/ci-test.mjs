#!/usr/bin/env node
/**
 * ci-test.mjs — what a CI job runs, the same on every CI system.
 *
 * The CI file stays thin: it installs, calls this script once per shard, and
 * once more to merge. What a pull request or a nightly run selects, how the
 * shards are named and what decides the pipeline's result come from
 * PROJECT-PROFILE.md (`ci`), so GitHub Actions, GitLab CI, Azure Pipelines
 * and Jenkins behave alike.
 *
 *   node scripts/ci-test.mjs --mode pull-request [--shard 1/2] [--base origin/main]
 *   node scripts/ci-test.mjs --mode nightly [--shard 1/4]
 *   node scripts/ci-test.mjs --mode serial        the profile's serial tag, one worker
 *   node scripts/ci-test.mjs --merge              blob reports → JSON + HTML → run summary
 *   --root <dir>                                  repository root (default: the parent of scripts/)
 *
 * Every test run writes a blob report to blob-report/; the CI keeps that
 * folder as an artifact and hands all of them to the merge job.
 *
 * The gate (`ci.gate`): with `summary`, a test run always exits 0 when it
 * wrote its report, and the merge step fails the pipeline for new failures
 * and unstable tests only — a known defect stays a failing test without
 * blocking the pipeline. With `exit-code`, Playwright's own exit code decides.
 * Exit code 0 = done; 1 = the gate says fail, or a run wrote no report; 2 = usage error.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { PROFILE_FILE, splitFrontMatter } from './profile-sync.mjs';

export const MODES = ['pull-request', 'nightly', 'serial'];
export const BLOB_DIR = 'blob-report';
export const JSON_REPORT = 'reports/results.json';
export const HTML_REPORT = 'reports/playwright-report';

/**
 * The Playwright runs of one CI job.
 *
 * @param {{ ci: Record<string, any>, mode: string, shard?: string, base?: string }} options -
 *   The profile's `ci` block, the mode, the shard ("2/4") and the base ref for changed files.
 * @returns {Array<{ name: string, args: string[], blob: string }>} Runs, in order.
 */
export function plan({ ci, mode, shard, base = 'origin/main' }) {
    const smoke = ci.smokeTag;
    const serial = ci.serialTag;
    const without = (...tags) => {
        const present = tags.filter(Boolean);
        return present.length ? ['--grep-invert', present.join('|')] : [];
    };
    let runs;
    if (mode === 'serial') {
        runs = serial
            ? [{ name: 'serial', args: ['--grep', serial, '--workers=1'] }]
            : [];
    } else if (mode === 'nightly' || ci.pullRequest === 'all') {
        runs = [{ name: 'all', args: without(serial) }];
    } else {
        runs = [{ name: 'smoke', args: ['--grep', smoke] }];
        if (ci.pullRequest === 'smoke+changed')
            // The files the branch changed and the files that import them —
            // without the smoke tests, which the first run already covers
            runs.push({
                name: 'changed',
                args: [
                    `--only-changed=${base}`,
                    ...without(smoke, serial),
                    '--pass-with-no-tests',
                ],
            });
    }
    const index = shard ? `-${shard.split('/')[0]}` : '';
    return runs.map((run) => ({
        name: run.name,
        args: [
            ...run.args,
            ...(shard ? [`--shard=${shard}`] : []),
            '--reporter=list,blob',
        ],
        blob: `${BLOB_DIR}/${run.name}${index}.zip`,
    }));
}

/**
 * Reads the profile front matter.
 *
 * @param {string} root - Repository root.
 * @returns {Record<string, any>} The profile.
 */
function readProfile(root) {
    return (
        parseYaml(
            splitFrontMatter(readFileSync(join(root, PROFILE_FILE), 'utf8'))
                .yaml
        ) ?? {}
    );
}

const npx = (root, args, env = {}) =>
    spawnSync('npx', args, {
        cwd: root,
        stdio: 'inherit',
        env: { ...process.env, ...env },
    }).status ?? 1;

/** CLI entry point */
function main() {
    const args = process.argv.slice(2);
    const valueOf = (flag) =>
        args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
    const mode = valueOf('--mode');
    const merge = args.includes('--merge');
    const shard = valueOf('--shard');
    if (
        merge === Boolean(mode) ||
        (mode && !MODES.includes(mode)) ||
        (shard && !/^\d+\/\d+$/.test(shard))
    ) {
        console.error(
            `usage: node scripts/ci-test.mjs (--mode ${MODES.join('|')} [--shard i/n] [--base <ref>] | --merge) [--root <dir>]`
        );
        process.exit(2);
    }
    const root = valueOf('--root')
        ? resolve(valueOf('--root'))
        : resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const profile = readProfile(root);
    const ci = profile.ci ?? {};
    const bySummary = ci.gate !== 'exit-code';

    if (merge) {
        const blobs = existsSync(join(root, BLOB_DIR))
            ? readdirSync(join(root, BLOB_DIR)).filter((f) =>
                  f.endsWith('.zip')
              )
            : [];
        if (!blobs.length) {
            console.error(
                `No blob reports in ${BLOB_DIR}/ — nothing to merge.`
            );
            process.exit(1);
        }
        const merged = npx(
            root,
            ['playwright', 'merge-reports', '--reporter=json,html', BLOB_DIR],
            {
                PLAYWRIGHT_JSON_OUTPUT_NAME: JSON_REPORT,
                PLAYWRIGHT_HTML_OUTPUT_DIR: HTML_REPORT,
                PLAYWRIGHT_HTML_OPEN: 'never',
            }
        );
        if (merged !== 0) process.exit(1);
        const summary = spawnSync(
            process.execPath,
            [
                join(
                    dirname(fileURLToPath(import.meta.url)),
                    'run-summary.mjs'
                ),
                '--root',
                root,
                '--report',
                join(root, JSON_REPORT),
                ...(bySummary ? ['--fail-on', 'new,unstable'] : []),
            ],
            { stdio: 'inherit' }
        );
        process.exit(summary.status ?? 1);
    }

    const base =
        valueOf('--base') ?? `origin/${profile.delivery?.baseBranch ?? 'main'}`;
    let worst = 0;
    for (const run of plan({ ci, mode, shard, base })) {
        console.log(
            `\n── ${run.name}: npx playwright test ${run.args.join(' ')}`
        );
        const status = npx(root, ['playwright', 'test', ...run.args], {
            PLAYWRIGHT_BLOB_OUTPUT_FILE: run.blob,
        });
        if (status !== 0 && !existsSync(join(root, run.blob))) {
            console.error(
                `The ${run.name} run failed without a report — a configuration or environment error, not a test result.`
            );
            process.exit(1);
        }
        worst = Math.max(worst, status);
    }
    process.exit(bySummary ? 0 : worst);
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
    main();
