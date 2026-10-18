// plan: test-plans/app/contact-list.md
import { z } from 'zod';
import { BrowserContext, expect, test } from '../../../fixtures/fixtures';
import {
    ApiEndpoints,
    AppRoutes,
    ContactTableColumns,
    CookieNames,
} from '../../../enums/app/app';
import { HttpStatusCodes } from '../../../enums/util/http-status-codes';
import { ApiRequestFn } from '../../../fixtures/api/api-types';
import { CreateContactRequest } from '../../../fixtures/api/schemas/app/contactSchema';
import {
    generateContact,
    generateFullContact,
} from '../../../test-data/factories/app/contact.factory';
import { generateUser } from '../../../test-data/factories/app/user.factory';
import {
    skipIfChecksFailed,
    skipIfEarlierStepSkipped,
} from '../../../helpers/util/softChecks';

/**
 * The contact's name as the Name column shows it.
 *
 * @param {CreateContactRequest} contact - The contact.
 * @returns {string} "firstName lastName".
 */
const fullName = (contact: CreateContactRequest): string =>
    `${contact.firstName} ${contact.lastName}`;

/**
 * The texts the contact's row shows, column by column — a missing field
 * leaves its cell, or its part of a cell, empty.
 *
 * @param {CreateContactRequest} contact - The contact.
 * @returns {string[]} One text per column, in the table's order.
 */
const rowTexts = (contact: CreateContactRequest): string[] => [
    fullName(contact),
    contact.birthdate ?? '',
    contact.email ?? '',
    contact.phone ?? '',
    `${contact.street1 ?? ''} ${contact.street2 ?? ''}`,
    `${contact.city ?? ''} ${contact.stateProvince ?? ''} ${contact.postalCode ?? ''}`,
    contact.country ?? '',
];

/**
 * Starts the account's session in the browser — the `token` cookie the UI reads.
 *
 * @param {BrowserContext} context - The test's browser context.
 * @param {string} token - The account's token.
 * @returns {Promise<void>}
 */
async function logIn(context: BrowserContext, token: string): Promise<void> {
    await context.addCookies([
        { name: CookieNames.TOKEN, value: token, url: process.env.APP_URL! },
    ]);
}

/**
 * Adds the contacts to the account through `POST /contacts`.
 *
 * @param {ApiRequestFn} apiRequest - The `apiRequest` fixture.
 * @param {string} token - The account's token.
 * @param {CreateContactRequest[]} contacts - The contacts to add.
 * @returns {Promise<void>}
 */
async function addContacts(
    apiRequest: ApiRequestFn,
    token: string,
    contacts: CreateContactRequest[]
): Promise<void> {
    for (const contact of contacts) {
        const { status } = await apiRequest({
            method: 'POST',
            url: ApiEndpoints.CONTACTS,
            baseUrl: process.env.API_URL,
            body: contact,
            headers: token,
        });
        expect(status).toBe(HttpStatusCodes.CREATED);
    }
}

/**
 * Deletes every contact of the account — also those added through the form.
 *
 * @param {ApiRequestFn} apiRequest - The `apiRequest` fixture.
 * @param {string} token - The account's token.
 * @returns {Promise<void>}
 */
async function deleteAllContacts(
    apiRequest: ApiRequestFn,
    token: string
): Promise<void> {
    const { status, body } = await apiRequest({
        method: 'GET',
        url: ApiEndpoints.CONTACTS,
        baseUrl: process.env.API_URL,
        headers: token,
    });
    expect(status).toBe(HttpStatusCodes.OK);

    for (const { _id: id } of z
        .array(z.looseObject({ _id: z.string() }))
        .parse(body)) {
        const deletion = await apiRequest({
            method: 'DELETE',
            url: `${ApiEndpoints.CONTACTS}/${id}`,
            baseUrl: process.env.API_URL,
            headers: token,
        });
        expect(deletion.status).toBe(HttpStatusCodes.OK);
    }
}

test.describe('contact list', () => {
    /** The second account of the privacy scenario, deleted after the test */
    let otherUserToken: string | undefined;

    test.afterEach(async ({ apiRequest, createdUser }) => {
        await deleteAllContacts(apiRequest, createdUser.token);

        if (otherUserToken) {
            await deleteAllContacts(apiRequest, otherUserToken);
            const deletion = await apiRequest({
                method: 'DELETE',
                url: ApiEndpoints.CURRENT_USER,
                baseUrl: process.env.API_URL,
                headers: otherUserToken,
            });
            expect(deletion.status).toBe(HttpStatusCodes.OK);
            otherUserToken = undefined;
        }
    });

    test(
        'a user with one contact sees all of its fields in the table',
        { tag: '@smoke' },
        async ({ apiRequest, context, createdUser, pageManager }) => {
            const contact = generateFullContact();

            await test.step('GIVEN a user with one contact that has every field filled', async () => {
                await addContacts(apiRequest, createdUser.token, [contact]);
                await logIn(context, createdUser.token);
            });

            await test.step('WHEN they open the contact list', async () => {
                await pageManager.contactListPage.open();
            });

            await test.step('THEN one contact row is shown', async () => {
                await expect
                    .soft(pageManager.contactListPage.contactRows)
                    .toHaveCount(1);
            });

            await test.step("AND the row shows each of the contact's fields in its column", async () => {
                await expect
                    .soft(
                        pageManager.contactListPage.contactRowCells(
                            fullName(contact)
                        )
                    )
                    .toHaveText(rowTexts(contact));
            });
        }
    );

    test(
        'a user with no contacts sees only the column headings',
        { tag: '@regression' },
        async ({ context, createdUser, pageManager }) => {
            await test.step('GIVEN a user with no contacts', async () => {
                await logIn(context, createdUser.token);
            });

            await test.step('WHEN they open the contact list', async () => {
                await pageManager.contactListPage.open();
            });

            await test.step("THEN the table's column headings are shown", async () => {
                await expect
                    .soft(pageManager.contactListPage.columnHeadings)
                    .toHaveText(Object.values(ContactTableColumns));
            });

            await test.step('AND no contact row is shown', async () => {
                await expect
                    .soft(pageManager.contactListPage.contactRows)
                    .toHaveCount(0);
            });
        }
    );

    test(
        'a user with two contacts sees both of them with their own values',
        { tag: '@regression' },
        async ({ apiRequest, context, createdUser, pageManager }) => {
            const fullContact = generateFullContact();
            const nameOnlyContact = generateContact();

            await test.step('GIVEN a user who has added two contacts, one with every field filled and one with only a name', async () => {
                await addContacts(apiRequest, createdUser.token, [
                    fullContact,
                    nameOnlyContact,
                ]);
                await logIn(context, createdUser.token);
            });

            await test.step('WHEN they open the contact list', async () => {
                await pageManager.contactListPage.open();
            });

            await test.step('THEN two contact rows are shown', async () => {
                await expect
                    .soft(pageManager.contactListPage.contactRows)
                    .toHaveCount(2);
            });

            await test.step('AND the contact with every field shows each of its fields in its column', async () => {
                await expect
                    .soft(
                        pageManager.contactListPage.contactRowCells(
                            fullName(fullContact)
                        )
                    )
                    .toHaveText(rowTexts(fullContact));
            });

            await test.step('AND the contact with only a name shows its name and empty cells in the other columns', async () => {
                await expect
                    .soft(
                        pageManager.contactListPage.contactRowCells(
                            fullName(nameOnlyContact)
                        )
                    )
                    .toHaveText(rowTexts(nameOnlyContact));
            });
        }
    );

    test(
        "a user does not see another user's contacts",
        { tag: '@regression' },
        async ({ apiRequest, context, createdUser, pageManager }) => {
            const ownContact = generateContact();
            const otherUsersContact = generateContact();

            await test.step('GIVEN a user with one contact, and another user with a contact of their own', async () => {
                await addContacts(apiRequest, createdUser.token, [ownContact]);
                const { status, body } = await apiRequest({
                    method: 'POST',
                    url: ApiEndpoints.USERS,
                    baseUrl: process.env.API_URL,
                    body: generateUser(),
                });
                expect(status).toBe(HttpStatusCodes.CREATED);
                otherUserToken = z
                    .looseObject({ token: z.string() })
                    .parse(body).token;
                await addContacts(apiRequest, otherUserToken, [
                    otherUsersContact,
                ]);
                await logIn(context, createdUser.token);
            });

            await test.step('WHEN the first user opens the contact list', async () => {
                await pageManager.contactListPage.open();
            });

            await test.step('THEN one contact row is shown', async () => {
                await expect
                    .soft(pageManager.contactListPage.contactRows)
                    .toHaveCount(1);
            });

            await test.step("AND the row is the user's own contact", async () => {
                await expect
                    .soft(
                        pageManager.contactListPage.contactName(
                            fullName(ownContact)
                        )
                    )
                    .toBeVisible();
            });

            await test.step("AND the other user's contact is not listed", async () => {
                await expect
                    .soft(
                        pageManager.contactListPage.contactName(
                            fullName(otherUsersContact)
                        )
                    )
                    .toBeHidden();
            });
        }
    );

    test(
        "clicking a contact opens that contact's details",
        { tag: '@regression' },
        async ({ apiRequest, context, createdUser, pageManager }) => {
            const contacts = [generateContact(), generateContact()];

            // The rows have no stated order: the contact shown in the second row is read from the page
            const secondContact =
                await test.step('GIVEN a user with two contacts is on the contact list', async () => {
                    await addContacts(apiRequest, createdUser.token, contacts);
                    await logIn(context, createdUser.token);
                    await pageManager.contactListPage.open();
                    await expect(
                        pageManager.contactListPage.contactRows
                    ).toHaveCount(contacts.length);
                    const [, secondRow] =
                        await pageManager.contactListPage.contactRows.allInnerTexts();
                    const shown = contacts.find((contact) =>
                        secondRow.includes(fullName(contact))
                    );
                    expect(shown).toBeDefined();
                    return shown!;
                });

            await test.step("WHEN they click the second contact's row", async () => {
                await pageManager.contactListPage
                    .contactName(fullName(secondContact))
                    .click();
            });

            await test.step("THEN the details show that contact's first name", async () => {
                await expect
                    .soft(
                        pageManager.contactDetailsPage.firstName(
                            secondContact.firstName
                        )
                    )
                    .toBeVisible();
            });

            await test.step("AND the details show that contact's last name", async () => {
                await expect
                    .soft(
                        pageManager.contactDetailsPage.lastName(
                            secondContact.lastName
                        )
                    )
                    .toBeVisible();
            });
        }
    );

    test(
        'a contact added through the form appears in the contact list',
        { tag: '@e2e' },
        async ({ context, createdUser, pageManager }) => {
            const contact = generateFullContact();

            await test.step('GIVEN a user with no contacts is on the contact list', async () => {
                await logIn(context, createdUser.token);
                await pageManager.contactListPage.open();
            });

            await test.step('WHEN they click "Add a New Contact"', async () => {
                await pageManager.contactListPage.addContactButton.click();
            });

            await test.step('THEN the add contact form is shown', async () => {
                await expect
                    .soft(pageManager.addContactPage.heading)
                    .toBeVisible();
            });

            await test.step('WHEN they fill in every field and submit', async (step) => {
                skipIfChecksFailed(step);
                await pageManager.addContactPage.addContact(contact);
            });

            await test.step('THEN one contact row is shown', async (step) => {
                skipIfEarlierStepSkipped(step);
                await expect
                    .soft(pageManager.contactListPage.contactRows)
                    .toHaveCount(1);
            });

            await test.step("AND the row shows each of the new contact's fields in its column", async (step) => {
                skipIfEarlierStepSkipped(step);
                await expect
                    .soft(
                        pageManager.contactListPage.contactRowCells(
                            fullName(contact)
                        )
                    )
                    .toHaveText(rowTexts(contact));
            });
        }
    );

    test(
        'cancelling the add contact form adds no contact',
        { tag: '@e2e' },
        async ({ context, createdUser, pageManager }) => {
            await test.step('GIVEN a user with no contacts is on the contact list', async () => {
                await logIn(context, createdUser.token);
                await pageManager.contactListPage.open();
            });

            await test.step('WHEN they click "Add a New Contact", fill in a name and click "Cancel"', async () => {
                await pageManager.contactListPage.addContactButton.click();
                await pageManager.addContactPage.fillContact(generateContact());
                await pageManager.addContactPage.cancelButton.click();
            });

            await test.step("THEN the table's column headings are shown", async () => {
                await expect
                    .soft(pageManager.contactListPage.columnHeadings)
                    .toHaveText(Object.values(ContactTableColumns));
            });

            await test.step('AND no contact row is shown', async () => {
                await expect
                    .soft(pageManager.contactListPage.contactRows)
                    .toHaveCount(0);
            });
        }
    );
});

test.describe('contact list without a session', () => {
    test(
        'opening the contact list without logging in shows the login page',
        { tag: '@regression' },
        async ({ page, pageManager, resetStorageState }) => {
            await test.step('GIVEN a visitor who is not logged in', async () => {
                await resetStorageState();
            });

            await test.step('WHEN they open the contact list', async () => {
                await page.goto(AppRoutes.CONTACT_LIST);
            });

            await test.step('THEN the login form is shown', async () => {
                await expect
                    .soft(pageManager.loginPage.emailInput)
                    .toBeVisible();
            });
        }
    );
});
