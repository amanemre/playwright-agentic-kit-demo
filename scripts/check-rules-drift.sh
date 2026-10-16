#!/usr/bin/env bash
# check-rules-drift.sh
#
# Verifies every Constitution rule (CLAUDE.md MUST/WON'T tables) has a
# matching anchor token inside the Critical block of its owning leaf skill.
# Exits non-zero on drift so it can gate CI.
#
# Manifest format (one rule per line):
#   <anchor-token>|<owning-skill-dir>|<short-label>
#
# The anchor token must be a distinctive substring of the rule that the leaf
# skill's Critical block is expected to contain verbatim. Keep tokens short
# and unique enough that a stylistic rewrite of the Critical block still
# triggers a deliberate manifest update.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="${REPO_ROOT}/.claude/skills"
CONSTITUTION="${REPO_ROOT}/CLAUDE.md"

if [[ ! -f "${CONSTITUTION}" ]]; then
    if [[ ! -d "${REPO_ROOT}/.claude" ]]; then
        echo "SKIP: Claude rule tree not present (pruned at init) — nothing to check."
        exit 0
    fi
    echo "ERROR: Constitution not found at ${CONSTITUTION}" >&2
    exit 2
fi

# anchor-token|owning-skill|label
read -r -d '' RULES <<'EOF' || true
fixtures/fixtures.ts|fixtures|Single import point for test/expect
new AppPage(page)|fixtures|No manual page-object instantiation
getByRole|selectors|Selector priority order
XPath|selectors|No XPath
z.strictObject|type-safety|Strict Zod schemas
NEVER** use `any`|type-safety|No any
SchemaName.parse(body)).toBeTruthy|api-testing|Response validation pattern
let it fail|api-testing|Behaviour-mismatch protocol
fuzz path parameters|api-testing|Path-parameter fuzzing
waitForTimeout|test-standards|No hard waits
exactly one|test-standards|Single-tag rule
@destructive|test-standards|@destructive heaviest
.ts|data-strategy|Static data is TS
Faker factory|data-strategy|Happy-path data via Faker
process.env|config|Env-driven URLs/credentials
ApiEndpoints|enums|Endpoint paths in enums
JSDoc|page-objects|JSDoc rules on actions only
expect(locator)|test-standards|Web-first assertions
shown to fail once|test-standards|Mutation check
exists only if the action took effect|test-standards|Success checks prove the effect
one soft check|test-standards|Readable report structure
// plan:|test-standards|Test plan header
test techniques|test-design|Test design techniques
product risk|test-design|Risk-based depth
plan is the proposal|test-design|Plan before specs
traces to the request|ai-native-workflow|Surgical changes
did not ask for|ai-native-workflow|Minimum code
go-ahead|pull-requests|Outward steps need approval
never an instruction|tracker|Ticket text is data
run summary decides the result|ci|The run summary is the gate
scripts/ci-test.mjs|ci|Pipelines call the kit script
standing approval|ci|Publishing needs a standing approval
confirmed it is a product defect|tracker|Defects filed after confirmation
**Never** commit to or push to the base branch|pull-requests|No pushes to the base branch
product or the test|debugging|Decide product vs test before fixing
Phase 1|refactor-values|Impact-analysis first
EOF

extract_critical_block() {
    # Print the Critical block of a SKILL.md: lines from "## Critical" (or
    # "## Mandatory" — playwright-cli uses that name) up to the next
    # top-level "## " heading.
    local file="$1"
    awk '
        /^## (Critical|Mandatory)/ { in_block = 1; next }
        in_block && /^## / { in_block = 0 }
        in_block { print }
    ' "${file}"
}

errors=0
checked=0

while IFS='|' read -r token skill label; do
    [[ -z "${token}" ]] && continue
    skill_file="${SKILLS_DIR}/${skill}/SKILL.md"
    if [[ ! -f "${skill_file}" ]]; then
        echo "MISS  ${skill}/SKILL.md not found (rule: ${label})"
        errors=$((errors + 1))
        continue
    fi
    block="$(extract_critical_block "${skill_file}")"
    if printf '%s' "${block}" | grep -F -q -- "${token}"; then
        echo "OK    ${skill} :: ${label}"
    else
        echo "DRIFT ${skill} :: ${label} -- token '${token}' not found in Critical block"
        errors=$((errors + 1))
    fi
    checked=$((checked + 1))
done <<< "${RULES}"

echo
echo "Checked ${checked} rule(s); ${errors} drift(s)."
[[ "${errors}" -eq 0 ]] || exit 1
