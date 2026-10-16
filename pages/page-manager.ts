import { Page } from '@playwright/test';
import { ExamplePage } from './app/example.page';

/**
 * Every page object of contact-list-app, created on first access and reached
 * through the `pageManager` fixture: `pageManager.examplePage.open()`.
 * Add each new page object as a getter here — never `new` it in a test.
 */
export class PageManager {
    private examplePageInstance?: ExamplePage;

    constructor(private readonly page: Page) {}

    get examplePage(): ExamplePage {
        return (this.examplePageInstance ??= new ExamplePage(this.page));
    }
}
