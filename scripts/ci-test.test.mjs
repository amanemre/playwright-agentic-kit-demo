/**
 * Deterministic tests for ci-test.mjs — run with `npm run test:kit`.
 * Only the run planning is tested here; running Playwright itself is checked
 * by hand against a real repository (see KIT-CHANGELOG.md).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { plan } from './ci-test.mjs';
import { splitFrontMatter } from './profile-sync.mjs';

const TEMPLATES = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'templates'
);

const ci = (changes = {}) => ({
    gate: 'summary',
    pullRequest: 'smoke+changed',
    smokeTag: '@smoke',
    serialTag: '@destructive',
    ...changes,
});
const argsOf = (runs) => Object.fromEntries(runs.map((r) => [r.name, r.args]));

describe('what a job runs', () => {
    test('a pull request runs the smoke tests, then the changed files without them', () => {
        const runs = plan({
            ci: ci(),
            mode: 'pull-request',
            base: 'origin/develop',
        });
        assert.deepEqual(argsOf(runs), {
            smoke: ['--grep', '@smoke', '--reporter=list,blob'],
            changed: [
                '--only-changed=origin/develop',
                '--grep-invert',
                '@smoke|@destructive',
                '--pass-with-no-tests',
                '--reporter=list,blob',
            ],
        });
        assert.deepEqual(
            runs.map((r) => r.blob),
            ['blob-report/smoke.zip', 'blob-report/changed.zip']
        );
    });

    test('the pull request scope follows the profile', () => {
        assert.deepEqual(
            Object.keys(
                argsOf(
                    plan({
                        ci: ci({ pullRequest: 'smoke' }),
                        mode: 'pull-request',
                    })
                )
            ),
            ['smoke']
        );
        assert.deepEqual(
            argsOf(
                plan({ ci: ci({ pullRequest: 'all' }), mode: 'pull-request' })
            ),
            { all: ['--grep-invert', '@destructive', '--reporter=list,blob'] }
        );
    });

    test('nightly runs everything except the serial tag; serial runs it alone with one worker', () => {
        assert.deepEqual(argsOf(plan({ ci: ci(), mode: 'nightly' })), {
            all: ['--grep-invert', '@destructive', '--reporter=list,blob'],
        });
        assert.deepEqual(argsOf(plan({ ci: ci(), mode: 'serial' })), {
            serial: [
                '--grep',
                '@destructive',
                '--workers=1',
                '--reporter=list,blob',
            ],
        });
    });

    test('without a serial tag nothing is excluded and the serial job has nothing to run', () => {
        const noSerial = ci({ serialTag: undefined });
        assert.deepEqual(argsOf(plan({ ci: noSerial, mode: 'nightly' })), {
            all: ['--reporter=list,blob'],
        });
        assert.deepEqual(plan({ ci: noSerial, mode: 'serial' }), []);
        assert.deepEqual(
            argsOf(plan({ ci: noSerial, mode: 'pull-request' })).changed.slice(
                1,
                3
            ),
            ['--grep-invert', '@smoke']
        );
    });

    test('a shard is passed to every run and named in its blob report', () => {
        const runs = plan({ ci: ci(), mode: 'pull-request', shard: '2/4' });
        for (const run of runs) assert.ok(run.args.includes('--shard=2/4'));
        assert.deepEqual(
            runs.map((r) => r.blob),
            ['blob-report/smoke-2.zip', 'blob-report/changed-2.zip']
        );
    });
});

describe('templates', () => {
    test('every CI template calls the shared script for the runs and for the merge', () => {
        for (const file of [
            'github-actions.yml',
            'gitlab-ci.yml',
            'azure-pipelines.yml',
            'Jenkinsfile',
        ]) {
            const text = readFileSync(join(TEMPLATES, 'ci', file), 'utf8');
            if (file.endsWith('.yml')) assert.ok(parseYaml(text), file);
            assert.match(text, /scripts\/ci-test\.mjs --mode "?\$/, file);
            assert.match(text, /scripts\/ci-test\.mjs --mode serial/, file);
            assert.match(text, /scripts\/ci-test\.mjs --merge/, file);
            assert.match(text, /scripts\/triage-draft\.mjs/, file);
            assert.match(
                text,
                /scripts\/ci-publish\.mjs --what run-summary/,
                file
            );
        }
    });

    test("the profile template's front matter is valid YAML with every block", () => {
        const profile = parseYaml(
            splitFrontMatter(
                readFileSync(
                    join(TEMPLATES, 'PROJECT-PROFILE.template.md'),
                    'utf8'
                )
            ).yaml
        );
        for (const block of [
            'paths',
            'tags',
            'plans',
            'ci',
            'tracker',
            'delivery',
        ])
            assert.equal(typeof profile[block], 'object', block);
    });
});
