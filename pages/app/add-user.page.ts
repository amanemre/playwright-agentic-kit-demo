import { Locator, Page } from '@playwright/test';
import { Headings, Messages } from '../../enums/app/app';

export class AddUserPage {
    constructor(private readonly page: Page) {}

    // ==================== Locators ====================

    get heading(): Locator {
        return this.page.getByRole('heading', { name: Headings.ADD_USER });
    }

    // ==================== Feedback Locators ====================

    get validationError(): Locator {
        return this.page.getByText(Messages.USER_VALIDATION_FAILED);
    }
}
