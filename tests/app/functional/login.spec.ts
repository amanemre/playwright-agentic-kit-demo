import { AppRoutes } from '../../../enums/app/app';
import { expect, test } from '../../../fixtures/pom/test-options';
import { generateLoginCredentials } from '../../../test-data/factories/app/user.factory';
import { INVALID_LOGIN_ATTEMPTS } from '../../../test-data/static/app/invalidCredentials';

const loginUrl = `${process.env.APP_URL!}${AppRoutes.LOGIN}`;
const contactListUrl = `${process.env.APP_URL!}${AppRoutes.CONTACT_LIST}`;

test.describe('functional login', () => {
    test.beforeEach(async ({ resetStorageState, loginPage }) => {
        await resetStorageState();
        await loginPage.open();
    });

    test(
        'should show the contact list after login with valid credentials',
        { tag: '@smoke' },
        async ({ page, loginPage, contactListPage, registeredUser }) => {
            await test.step('WHEN the user logs in with valid credentials', async () => {
                await loginPage.login(
                    registeredUser.email,
                    registeredUser.password
                );
            });

            await test.step('THEN the contact list loads', async () => {
                await expect(page).toHaveURL(contactListUrl);
                await expect(contactListPage.heading).toBeVisible();
                await expect(contactListPage.logoutButton).toBeVisible();
                await expect(contactListPage.contactsTable).toBeVisible();
            });
        }
    );

    test(
        'should show an empty login form with a masked password field',
        { tag: '@regression' },
        async ({ loginPage }) => {
            await expect(loginPage.emailInput).toBeEmpty();
            await expect(loginPage.passwordInput).toBeEmpty();
            await expect(loginPage.passwordInput).toHaveAttribute(
                'type',
                'password'
            );
            await expect(loginPage.submitButton).toBeEnabled();
            await expect(loginPage.signUpButton).toBeEnabled();
            await expect(loginPage.errorMessage).toBeHidden();
        }
    );

    test(
        'should log in when the form is submitted with the Enter key',
        { tag: '@regression' },
        async ({ page, loginPage, contactListPage, registeredUser }) => {
            await test.step('WHEN the user submits valid credentials with Enter', async () => {
                await loginPage.loginWithEnterKey(
                    registeredUser.email,
                    registeredUser.password
                );
            });

            await test.step('THEN the contact list loads', async () => {
                await expect(page).toHaveURL(contactListUrl);
                await expect(contactListPage.contactsTable).toBeVisible();
            });
        }
    );

    test(
        'should log in when the email is entered in upper case',
        { tag: '@regression' },
        async ({ page, loginPage, contactListPage, registeredUser }) => {
            await test.step('WHEN the user logs in with the email in upper case', async () => {
                await loginPage.login(
                    registeredUser.email.toUpperCase(),
                    registeredUser.password
                );
            });

            await test.step('THEN the contact list loads', async () => {
                await expect(page).toHaveURL(contactListUrl);
                await expect(contactListPage.contactsTable).toBeVisible();
            });
        }
    );

    test(
        'should show an error for a registered email with a wrong password',
        { tag: '@regression' },
        async ({ page, loginPage }) => {
            const { password } = generateLoginCredentials();

            await test.step('WHEN the user logs in with a wrong password', async () => {
                await loginPage.login(process.env.APP_EMAIL!, password);
            });

            await test.step('THEN the error is shown and the user stays on the login page', async () => {
                await expect(loginPage.errorMessage).toBeVisible();
                await expect(page).toHaveURL(loginUrl);
            });
        }
    );

    test(
        'should show an error for an unregistered email',
        { tag: '@regression' },
        async ({ page, loginPage }) => {
            const { email, password } = generateLoginCredentials();

            await test.step('WHEN the user logs in with an unregistered email', async () => {
                await loginPage.login(email, password);
            });

            await test.step('THEN the error is shown and the user stays on the login page', async () => {
                await expect(loginPage.errorMessage).toBeVisible();
                await expect(page).toHaveURL(loginUrl);
            });
        }
    );

    for (const { description, email, password } of INVALID_LOGIN_ATTEMPTS) {
        test(
            `should show an error for invalid input - ${description}`,
            { tag: '@regression' },
            async ({ page, loginPage }) => {
                await test.step(`WHEN the user submits ${description}`, async () => {
                    await loginPage.login(email, password);
                });

                await test.step('THEN the error is shown and the user stays on the login page', async () => {
                    await expect(loginPage.errorMessage).toBeVisible();
                    await expect(page).toHaveURL(loginUrl);
                });
            }
        );
    }

    test(
        'should open the sign-up page from the Sign up button',
        { tag: '@regression' },
        async ({ page, loginPage }) => {
            await test.step('WHEN the user clicks Sign up', async () => {
                await loginPage.clickSignUp();
            });

            await test.step('THEN the sign-up page opens', async () => {
                await expect(page).toHaveURL(
                    `${process.env.APP_URL!}${AppRoutes.ADD_USER}`
                );
            });
        }
    );

    test(
        'should return to the login page after logout',
        { tag: '@regression' },
        async ({ page, loginPage, contactListPage, registeredUser }) => {
            await test.step('GIVEN the user is logged in', async () => {
                await loginPage.login(
                    registeredUser.email,
                    registeredUser.password
                );
                await expect(contactListPage.contactsTable).toBeVisible();
            });

            await test.step('WHEN the user logs out', async () => {
                await contactListPage.logout();
            });

            await test.step('THEN the login form is shown', async () => {
                await expect(page).toHaveURL(loginUrl);
                await expect(loginPage.emailInput).toBeVisible();
            });
        }
    );

    test(
        'should not load contacts when the contact list is opened after logout',
        { tag: '@regression' },
        async ({ loginPage, contactListPage, registeredUser }) => {
            await test.step('GIVEN the user has logged in and out', async () => {
                await loginPage.login(
                    registeredUser.email,
                    registeredUser.password
                );
                await expect(contactListPage.contactsTable).toBeVisible();
                await contactListPage.logout();
                await expect(loginPage.emailInput).toBeVisible();
            });

            await test.step('WHEN the user opens the contact list directly', async () => {
                await contactListPage.open();
            });

            await test.step('THEN no contacts are loaded', async () => {
                await expect(contactListPage.contactsTable).toBeHidden();
            });
        }
    );

    // FIXME: after logout, /contactList renders its frame (heading, Logout,
    // Add a New Contact) instead of redirecting to the login page — the stale
    // `token` cookie stays in the browser and GET /contacts answers 401.
    // App bug; un-skip once the app redirects unauthenticated users.
    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(
        'should redirect to the login page when the contact list is opened after logout',
        { tag: '@regression' },
        async ({ page, loginPage, contactListPage, registeredUser }) => {
            await test.step('GIVEN the user has logged in and out', async () => {
                await loginPage.login(
                    registeredUser.email,
                    registeredUser.password
                );
                await expect(contactListPage.contactsTable).toBeVisible();
                await contactListPage.logout();
                await expect(loginPage.emailInput).toBeVisible();
            });

            await test.step('WHEN the user opens the contact list directly', async () => {
                await contactListPage.open();
            });

            await test.step('THEN the user is redirected to the login page', async () => {
                await expect(page).toHaveURL(loginUrl);
                await expect(loginPage.emailInput).toBeVisible();
            });
        }
    );
});
