import { Page } from '@playwright/test';
import { ExamplePage } from './__AREA__/example.page';

/**
 * Every page object of __PROJECT__, created on first access and reached
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
