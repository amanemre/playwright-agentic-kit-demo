// plan: test-plans/app/login.md
import { expect, test } from '../../../fixtures/fixtures';
import { CookieNames, Messages } from '../../../enums/app/app';
import { generateUser } from '../../../test-data/factories/app/user.factory';
import {
    skipIfChecksFailed,
    skipIfEarlierStepSkipped,
} from '../../../helpers/util/softChecks';

type Credentials = { email: string; password: string };

/** One representative per invalid partition, built from the test's own account */
const rejectedLogins: {
    partition: string;
    credentials: (account: Credentials) => Credentials;
}[] = [
    {
        partition: 'a wrong password',
        credentials: ({ email }) => ({
            email,
            password: generateUser().password,
        }),
    },
    {
        partition: 'an unregistered email',
        credentials: ({ password }) => ({
            email: generateUser().email,
            password,
        }),
    },
    {
        partition: 'an empty email',
        credentials: ({ password }) => ({ email: '', password }),
    },
    {
        partition: 'an empty password',
        credentials: ({ email }) => ({ email, password: '' }),
    },
];

test.describe('login', () => {
    test(
        'a registered user logs in and sees their own contacts',
        { tag: '@smoke' },
        async ({ createdUser, createdContact, pageManager }) => {
            await test.step('GIVEN a registered user with one contact', async () => {
                await pageManager.loginPage.open();
            });

            await test.step('WHEN they log in with their email and password', async () => {
                await pageManager.loginPage.login(
                    createdUser.email,
                    createdUser.password
                );
            });

            await test.step('THEN their contact is listed', async () => {
                await expect
                    .soft(
                        pageManager.contactListPage.contactName(
                            `${createdContact.firstName} ${createdContact.lastName}`
                        )
                    )
                    .toBeVisible();
            });
        }
    );

    test(
        'logging in with a pressed Enter key instead of the Submit button works',
        { tag: '@regression' },
        async ({ createdUser, createdContact, pageManager }) => {
            await test.step('GIVEN a registered user with one contact', async () => {
                await pageManager.loginPage.open();
            });

            await test.step('WHEN they enter their email and password and press Enter', async () => {
                await pageManager.loginPage.loginWithEnterKey(
                    createdUser.email,
                    createdUser.password
                );
            });

            await test.step('THEN their contact is listed', async () => {
                await expect
                    .soft(
                        pageManager.contactListPage.contactName(
                            `${createdContact.firstName} ${createdContact.lastName}`
                        )
                    )
                    .toBeVisible();
            });
        }
    );

    for (const { partition, credentials } of rejectedLogins) {
        test(
            `logging in with ${partition} is rejected`,
            { tag: '@regression' },
            async ({ createdUser, pageManager }) => {
                await test.step('GIVEN a registered user', async () => {
                    await pageManager.loginPage.open();
                });

                await test.step(`WHEN they log in with ${partition} and the other field valid`, async () => {
                    const { email, password } = credentials(createdUser);
                    await pageManager.loginPage.login(email, password);
                });

                await test.step(`THEN "${Messages.INCORRECT_CREDENTIALS}" is shown`, async () => {
                    await expect
                        .soft(pageManager.loginPage.incorrectCredentialsError)
                        .toBeVisible();
                });

                await test.step('AND the login form is still shown', async () => {
                    await expect
                        .soft(pageManager.loginPage.emailInput)
                        .toBeVisible();
                });
            }
        );
    }

    test(
        "after logging out the user's contacts are no longer shown",
        { tag: '@regression' },
        async ({ context, createdUser, createdContact, pageManager }) => {
            const contactName = `${createdContact.firstName} ${createdContact.lastName}`;

            await test.step('GIVEN a registered user with one contact is logged in', async () => {
                await context.addCookies([
                    {
                        name: CookieNames.TOKEN,
                        value: createdUser.token,
                        url: process.env.APP_URL!,
                    },
                ]);
                await pageManager.contactListPage.open();
                await expect(
                    pageManager.contactListPage.contactName(contactName)
                ).toBeVisible();
            });

            await test.step('WHEN they log out', async () => {
                await pageManager.contactListPage.logout();
            });

            await test.step('THEN the login form is shown', async () => {
                await expect
                    .soft(pageManager.loginPage.emailInput)
                    .toBeVisible();
            });

            await test.step('WHEN they open the contact list again', async (step) => {
                skipIfChecksFailed(step);
                await pageManager.contactListPage.open();
            });

            await test.step('THEN their contact is not listed', async (step) => {
                skipIfEarlierStepSkipped(step);
                await expect
                    .soft(pageManager.contactListPage.contactName(contactName))
                    .toBeHidden();
            });
        }
    );

    test(
        'the Sign up button opens the add user page',
        { tag: '@regression' },
        async ({ pageManager }) => {
            await test.step('GIVEN the login page is open', async () => {
                await pageManager.loginPage.open();
            });

            await test.step('WHEN the user clicks "Sign up"', async () => {
                await pageManager.loginPage.signUpButton.click();
            });

            await test.step('THEN the "Add User" heading is shown', async () => {
                await expect
                    .soft(pageManager.addUserPage.heading)
                    .toBeVisible();
            });
        }
    );

    test(
        'an email in other letter case or with surrounding spaces still logs in',
        { tag: '@regression' },
        async ({ createdUser, createdContact, pageManager }) => {
            await test.step('GIVEN a registered user with one contact', async () => {
                await pageManager.loginPage.open();
            });

            await test.step('WHEN they log in with their email in capitals and surrounded by spaces', async () => {
                await pageManager.loginPage.login(
                    `  ${createdUser.email.toUpperCase()}  `,
                    createdUser.password
                );
            });

            await test.step('THEN their contact is listed', async () => {
                await expect
                    .soft(
                        pageManager.contactListPage.contactName(
                            `${createdContact.firstName} ${createdContact.lastName}`
                        )
                    )
                    .toBeVisible();
            });
        }
    );

    test(
        'a password in other letter case is rejected',
        { tag: '@regression' },
        async ({ createdUser, pageManager }) => {
            await test.step('GIVEN a registered user', async () => {
                await pageManager.loginPage.open();
            });

            await test.step('WHEN they log in with their password in capitals', async () => {
                await pageManager.loginPage.login(
                    createdUser.email,
                    createdUser.password.toUpperCase()
                );
            });

            await test.step(`THEN "${Messages.INCORRECT_CREDENTIALS}" is shown`, async () => {
                await expect
                    .soft(pageManager.loginPage.incorrectCredentialsError)
                    .toBeVisible();
            });
        }
    );
});
