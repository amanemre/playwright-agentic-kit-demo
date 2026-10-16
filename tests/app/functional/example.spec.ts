// plan: test-plans/app/example.md
import { expect, test } from '../../../fixtures/fixtures';
import { Messages } from '../../../enums/app/app';
import {
    skipIfChecksFailed,
    skipIfEarlierStepSkipped,
} from '../../../helpers/util/softChecks';

/*
 * Example spec in the readable report structure: every GIVEN / WHEN / THEN /
 * AND line is a step, each check step holds one soft check, and a later part
 * runs only when every check before it passed. Replace it with real specs.
 */
test.describe('example', () => {
    test(
        'submitting a name shows a greeting and an empty name asks for one',
        { tag: '@smoke' },
        async ({ pageManager }) => {
            const name = 'Ada';

            await test.step('GIVEN the example form is open', async () => {
                await pageManager.examplePage.open();
            });

            await test.step(`WHEN the user submits the name "${name}"`, async () => {
                await pageManager.examplePage.sayHello(name);
            });

            await test.step(`THEN the greeting is "${Messages.GREETING_PREFIX}${name}"`, async () => {
                await expect
                    .soft(pageManager.examplePage.greeting)
                    .toHaveText(`${Messages.GREETING_PREFIX}${name}`);
            });

            await test.step('WHEN they submit an empty name', async (step) => {
                skipIfChecksFailed(step);
                await pageManager.examplePage.sayHello('');
            });

            await test.step(`THEN "${Messages.NAME_REQUIRED}" is shown`, async (step) => {
                skipIfEarlierStepSkipped(step);
                await expect
                    .soft(pageManager.examplePage.requiredMessage)
                    .toBeVisible();
            });
        }
    );
});
