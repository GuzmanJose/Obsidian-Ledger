// src/ui/InputFormModal.ts
import { App, Modal, Setting, TextComponent, ButtonComponent } from 'obsidian';
import type LedgerModernPlugin from '../main';

export class InputFormModal extends Modal {
  plugin: LedgerModernPlugin;
  private resolveFn: (entry: string | null) => void;
  private rows: { account: TextComponent; amount: TextComponent }[] = [];
  private commentInput: TextComponent;
  private dateInput: TextComponent;
  private payeeInput: TextComponent;
  private container: HTMLElement;

  constructor(app: App, plugin: LedgerModernPlugin) {
    super(app);
    this.plugin = plugin;
  }

  /**
   * Opens the modal and returns a Promise that resolves
   * to the formatted ledger entry (or null if cancelled)
   */
  open(): Promise<string | null> {
    super.open();
    return new Promise<string | null>(resolve => {
      this.resolveFn = resolve;
    });
  }

  onOpen() {
    this.containerEl.empty();
    this.container = this.containerEl.createEl('div', { cls: 'ledger-input-modal' });

    this.container.createEl('h2', { text: 'New Ledger Entry' });

    // Date field
    new Setting(this.container)
      .setName('Date')
      .addText(text => {
        this.dateInput = text
          .setType('date')
          .setValue(new Date().toISOString().slice(0, 10))
          .inputEl;
      });

    // Payee field
    new Setting(this.container)
      .setName('Payee')
      .addText(text => {
        this.payeeInput = text
          .setPlaceholder('e.g. Grocery Store')
          .setValue('')
          .inputEl;
      });

    // Entries container
    const entriesContainer = this.container.createEl('div', { cls: 'entries-container' });
    this.addEntryRow(entriesContainer);

    // "Add Line" button
    new Setting(this.container)
      .addButton(btn =>
        btn
          .setButtonText('Add Line')
          .onClick(() => this.addEntryRow(entriesContainer))
      );

    // Comment field (optional)
    new Setting(this.container)
      .setName('Comment')
      .addText(text => {
        this.commentInput = text
          .setPlaceholder('Optional comment')
          .setValue('')
          .inputEl;
      });

    // Submit / Cancel buttons
    const btnContainer = this.container.createEl('div', { cls: 'modal-buttons' });
    new ButtonComponent(btnContainer)
      .setButtonText('Submit')
      .onClick(() => this.submit());
    new ButtonComponent(btnContainer)
      .setButtonText('Cancel')
      .onClick(() => this.cancel());
  }

  onClose() {
    super.close();
    this.containerEl.empty();
  }

  private addEntryRow(parent: HTMLElement) {
    const row = parent.createEl('div', { cls: 'entry-row' });
    const account = new TextComponent(row);
    account.inputEl.setAttribute('placeholder', 'Expenses:Food');

    const amount = new TextComponent(row);
    amount.inputEl.setAttribute('placeholder', '42.50');

    this.rows.push({ account, amount });
  }

  private submit() {
    const date = this.dateInput.inputEl.value.trim();
    const payee = this.payeeInput.inputEl.value.trim();
    const comment = this.commentInput.inputEl.value.trim();

    if (!date || !payee || this.rows.length === 0) {
      // You could show a Notice here if desired
      return;
    }

    let entry = `${date} ${payee}`;
    if (comment) {
      entry += `    ; ${comment}`;
    }
    entry += '\n';

    for (const { account, amount } of this.rows) {
      const acc = account.inputEl.value.trim();
      const amt = amount.inputEl.value.trim();
      if (!acc || !amt) continue;
      entry += `    ${acc}    $${amt}\n`;
    }

    this.resolveFn(entry);
    this.close();
  }

  private cancel() {
    this.resolveFn(null);
    this.close();
  }
}

