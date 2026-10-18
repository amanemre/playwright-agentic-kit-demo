import { Locator, Page } from '@playwright/test';
import { ApiEndpoints, Headings, Messages } from '../../enums/app/app';
import { CreateContactRequest } from '../../fixtures/api/schemas/app/contactSchema';

export class AddContactPage {
    constructor(private readonly page: Page) {}

    // ==================== Locators ====================

    get heading(): Locator {
        return this.page.getByRole('heading', { name: Headings.ADD_CONTACT });
    }

    get firstNameInput(): Locator {
        return this.page.getByRole('textbox', { name: 'First Name' });
    }

    get lastNameInput(): Locator {
        return this.page.getByRole('textbox', { name: 'Last Name' });
    }

    get birthdateInput(): Locator {
        return this.page.getByRole('textbox', { name: 'Date of Birth' });
    }

    get emailInput(): Locator {
        return this.page.getByRole('textbox', { name: 'Email' });
    }

    get phoneInput(): Locator {
        return this.page.getByRole('textbox', { name: 'Phone' });
    }

    get street1Input(): Locator {
        return this.page.getByRole('textbox', { name: 'Street Address 1' });
    }

    get street2Input(): Locator {
        return this.page.getByRole('textbox', { name: 'Street Address 2' });
    }

    get cityInput(): Locator {
        return this.page.getByRole('textbox', { name: 'City' });
    }

    get stateProvinceInput(): Locator {
        return this.page.getByRole('textbox', { name: 'State or Province' });
    }

    get postalCodeInput(): Locator {
        return this.page.getByRole('textbox', { name: 'Postal Code' });
    }

    get countryInput(): Locator {
        return this.page.getByRole('textbox', { name: 'Country' });
    }

    get submitButton(): Locator {
        return this.page.getByRole('button', { name: 'Submit' });
    }

    get cancelButton(): Locator {
        return this.page.getByRole('button', { name: 'Cancel' });
    }

    // ==================== Feedback Locators ====================

    get validationError(): Locator {
        return this.page.getByText(Messages.CONTACT_VALIDATION_FAILED);
    }

    // ==================== Actions ====================

    /**
     * Fills in every field the contact has; fields it does not have stay empty.
     *
     * @param {CreateContactRequest} contact - The contact to enter.
     * @returns {Promise<void>}
     */
    async fillContact(contact: CreateContactRequest): Promise<void> {
        await this.firstNameInput.fill(contact.firstName);
        await this.lastNameInput.fill(contact.lastName);
        await this.birthdateInput.fill(contact.birthdate ?? '');
        await this.emailInput.fill(contact.email ?? '');
        await this.phoneInput.fill(contact.phone ?? '');
        await this.street1Input.fill(contact.street1 ?? '');
        await this.street2Input.fill(contact.street2 ?? '');
        await this.cityInput.fill(contact.city ?? '');
        await this.stateProvinceInput.fill(contact.stateProvince ?? '');
        await this.postalCodeInput.fill(contact.postalCode ?? '');
        await this.countryInput.fill(contact.country ?? '');
    }

    /**
     * Fills in the contact, clicks Submit and waits for the answer of
     * `POST /contacts`.
     *
     * @param {CreateContactRequest} contact - The contact to add.
     * @returns {Promise<void>}
     */
    async addContact(contact: CreateContactRequest): Promise<void> {
        await this.fillContact(contact);
        const response = this.page.waitForResponse(
            (r) =>
                r.url().endsWith(ApiEndpoints.CONTACTS) &&
                r.request().method() === 'POST'
        );
        await this.submitButton.click();
        await response;
    }
}
