import type { Page, Response } from '@playwright/test';

export class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(path: string): Promise<Response | null> {
    return this.page.goto(path);
  }

  async title(): Promise<string> {
    return this.page.title();
  }
}
