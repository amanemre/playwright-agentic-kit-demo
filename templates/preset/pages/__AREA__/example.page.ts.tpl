import { Locator, Page } from '@playwright/test';
import { Messages } from '../../enums/__AREA__/__AREA__';

/**
 * Example page object — replace it with the application's first real page.
 * It renders its own small form (no network), so a freshly scaffolded
 * project has one working test from the start.
 */
export class ExamplePage {
    constructor(private readonly page: Page) {}

    // ==================== Locators ====================

    get nameInput(): Locator {
        return this.page.getByRole('textbox', { name: 'Name' });
    }

    get submitButton(): Locator {
        return this.page.getByRole('button', { name: 'Say hello' });
    }

    // ==================== Feedback Locators ====================

    get greeting(): Locator {
        return this.page.getByRole('status');
    }

    get requiredMessage(): Locator {
        return this.page.getByText(Messages.NAME_REQUIRED);
    }

    // ==================== Actions ====================

    /**
     * Shows the example form.
     *
     * @returns {Promise<void>}
     */
    async open(): Promise<void> {
        await this.page.setContent(`
            <form onsubmit="event.preventDefault();
                const name = this.name.value.trim();
                document.getElementById('out').textContent = name ? '${Messages.GREETING_PREFIX}' + name : '';
                document.getElementById('err').hidden = Boolean(name);">
                <label>Name <input name="name"></label>
                <button>Say hello</button>
                <p role="status" id="out"></p>
                <p id="err" hidden>${Messages.NAME_REQUIRED}</p>
            </form>`);
    }

    /**
     * Types a name and submits the form.
     *
     * @param {string} name - The name to submit ('' for none).
     * @returns {Promise<void>}
     */
    async sayHello(name: string): Promise<void> {
        await this.nameInput.fill(name);
        await this.submitButton.click();
    }
}
