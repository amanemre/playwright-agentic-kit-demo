/**
 * kit-files.mjs — which files belong to the portable kit and to the
 * playwright-house-preset. The one machine-readable source for the installer
 * (kit-install.mjs) and the leak check (rule-check.mjs); KIT-MANIFEST.md is
 * the human-readable version of the same lists.
 */

/** Kit files: copied into every repository (adopt and scaffold) */
export const KIT = [
    /^CLAUDE\.md$/,
    /^\.cursor\/rules\//,
    /^\.github\/copilot-instructions\.md$/,
    /^\.claude\/skills\//,
    /^\.claude\/agents\/test-[\w-]+\.md$/,
    /^\.cursor\/skills\//,
    /^\.cursor\/agents\/test-[\w-]+\.md$/,
    /^\.github\/instructions\//,
    /^\.github\/agents\/test-[\w-]+\.agent\.md$/,
    /^roles\//,
    /^\.github\/prompts\//,
    /^\.github\/skills\//,
    /^\.claude\/settings\.json$/,
    /^\.claude\/scripts\/status_line\.py$/,
    /^AI-WORKFLOWS\.md$/,
    /^RULE-INVENTORY\.md$/,
    /^KIT-MANIFEST\.md$/,
    /^KIT-CHANGELOG\.md$/,
    /^NOTICE\.md$/,
    /^skills-lock\.json$/,
    /^templates\//,
    /^scripts\/(check-rules-drift|check-skill-crossrefs|check-skill-references-drift)\.sh$/,
    /^scripts\/(profile-sync|plan-check|rule-check|run-summary|roles-sync|ci-test|ci-publish|triage-draft|kit-install|kit-files)(\.test)?\.mjs$/,
    /^scripts\/(playwright-cli\.(sh|cmd)|install-playwright-cli-browsers\.(sh|js)|link-cli\.sh|sync-upstream-skills\.sh)$/,
];

/** Preset files copied as they are (scaffold mode; offered in adopt mode) */
export const PRESET = [
    /^fixtures\/api\/(api-request-fixture|plain-function)\.ts$/,
    /^fixtures\/pom\/page-object-fixture\.ts$/,
    /^fixtures\/network\/ad-block-fixture\.ts$/,
    /^helpers\/util\/(softChecks|util)\.ts$/,
    /^enums\/util\/(http-status-codes|ad-hosts|roles)\.ts$/,
    /^test-data\/static\/util\/invalid-values\.ts$/,
    /^config\/util\/util\.ts$/,
    /^tsconfig\.json$/,
    /^eslint\.config\.mts$/,
    /^\.prettierrc$/,
    /^\.prettierignore$/,
];

/**
 * Preset files that need the new project's names: rendered from
 * `templates/preset/`, with `__AREA__` (folder) and `__PROJECT__` (name)
 * replaced in paths and content. TypeScript templates end in `.tpl`, so no
 * type checker or linter reads them before they are rendered.
 */
export const PRESET_TEMPLATE_DIR = 'templates/preset';

/** Constitution files: kit-owned, but their managed profile block belongs to the project */
export const CONSTITUTIONS = [
    'CLAUDE.md',
    '.cursor/rules/rules.mdc',
    '.github/copilot-instructions.md',
];

/** Files the kit never writes: they belong to the project */
export const PROJECT_OWNED = [/^PROJECT-PROFILE\.md$/, /^kit-lock\.json$/];

export const isKit = (path) => KIT.some((re) => re.test(path));
export const isPreset = (path) => PRESET.some((re) => re.test(path));

/** Kit development tooling: lives with the kit's own repository, never installed */
export const KIT_DEV = [/^scripts\/kit-matrix\.mjs$/, /^KIT-ACCEPTANCE\.md$/];
