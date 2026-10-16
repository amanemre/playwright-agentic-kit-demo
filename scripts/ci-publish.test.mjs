/**
 * Deterministic tests for ci-publish.mjs — run with `npm run test:kit`.
 * The decision and the published text are tested; the `gh` calls themselves
 * need a real pull request and are not run here.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { decide, withApproval } from './ci-publish.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'ci-publish.mjs');
const approval = (action, changes = {}) => ({
    action,
    limits: 'one comment per pull request',
    approvedBy: 'Sam Lee',
    date: '2026-10-01',
    expires: '2027-01-01',
    ...changes,
});
const profile = (standingApprovals, changes = {}) => ({
    delivery: { host: 'github', cli: 'gh' },
    tracker: { system: 'github', access: 'cli' },
    standingApprovals,
    ...changes,
});
const TODAY = '2026-10-11';

describe('whether something is published', () => {
    test('nothing without an approval for exactly that action', () => {
        const none = decide({
            profile: profile([]),
            what: 'run-summary',
            today: TODAY,
        });
        assert.equal(none.publish, false);
        assert.match(none.reason, /no standing approval `post-run-summary`/);
        // an approval for another action does not carry over
        assert.equal(
            decide({
                profile: profile([approval('open-triage-issue')]),
                what: 'run-summary',
                today: TODAY,
            }).publish,
            false
        );
    });

    test('nothing after the approval expired or before it started', () => {
        const p = profile([approval('post-run-summary')]);
        assert.equal(
            decide({ profile: p, what: 'run-summary', today: '2027-01-02' })
                .publish,
            false
        );
        assert.equal(
            decide({ profile: p, what: 'run-summary', today: '2026-09-30' })
                .publish,
            false
        );
        assert.equal(
            decide({ profile: p, what: 'run-summary', today: TODAY }).publish,
            true
        );
    });

    test('with an approval, only GitHub with gh is automated — other hosts are told to post by hand', () => {
        const gitlab = decide({
            profile: profile([approval('post-run-summary')], {
                delivery: { host: 'gitlab', cli: 'glab' },
            }),
            what: 'run-summary',
            today: TODAY,
        });
        assert.equal(gitlab.publish, false);
        assert.match(gitlab.reason, /post reports\/run-summary\.md by hand/);
        const jira = decide({
            profile: profile([approval('open-triage-issue')], {
                tracker: { system: 'jira', access: 'cli' },
            }),
            what: 'triage-issue',
            today: TODAY,
        });
        assert.equal(jira.publish, false);
        assert.equal(
            decide({
                profile: profile([approval('open-triage-issue')]),
                what: 'triage-issue',
                today: TODAY,
            }).file,
            'reports/triage.md'
        );
    });

    test('the published text names the approval it was posted under', () => {
        assert.match(
            withApproval('# Run summary\n', approval('post-run-summary')),
            /^# Run summary\n\n---\n\n_Published automatically under the standing approval `post-run-summary` — Sam Lee, 2026-10-01, until 2027-01-01; limits: one comment per pull request\._\n$/
        );
    });

    test('the CLI publishes nothing, and exits 0, when no approval is in force', () => {
        const root = mkdtempSync(join(tmpdir(), 'ci-publish-'));
        try {
            mkdirSync(join(root, 'reports'));
            writeFileSync(
                join(root, 'reports/run-summary.md'),
                '# Run summary\n'
            );
            writeFileSync(
                join(root, 'PROJECT-PROFILE.md'),
                '---\ndelivery:\n    host: github\n    cli: gh\nstandingApprovals: []\n---\n'
            );
            const run = spawnSync(
                process.execPath,
                [SCRIPT, '--root', root, '--what', 'run-summary'],
                { encoding: 'utf8' }
            );
            assert.equal(run.status, 0);
            assert.match(run.stdout, /^Not published: no standing approval/);
            assert.equal(
                spawnSync(process.execPath, [
                    SCRIPT,
                    '--root',
                    root,
                    '--what',
                    'everything',
                ]).status,
                2
            );
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
