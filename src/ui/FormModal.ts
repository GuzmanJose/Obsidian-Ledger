import { App, Modal, Notice } from 'obsidian';
import type LedgerModernPlugin from '../main';
import { ledgerFormSchema, LedgerFormSchema } from '../schema/ledgerFormSchema';

export interface LedgerFormData {
  date: string;
  payee: string;
  narration?: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  currency: string;
  tags: string[];
  cleared: boolean;
  recurring: boolean;
  frequency?: 'daily' | 'weekly' | 'monthly';
}

export class FormModal extends Modal {
  plugin: LedgerModernPlugin;
  private resolve!: (data: LedgerFormData | null) => void;
  private schema: LedgerFormSchema;

  constructor(app: App, plugin: LedgerModernPlugin) {
    super(app);
    this.plugin = plugin;
    this.schema = {
      ...ledgerFormSchema,
      fromAccount: {
        ...ledgerFormSchema.fromAccount,
        options: this.plugin.settings.accountOptions,
      },
      toAccount: {
        ...ledgerFormSchema.toAccount,
        options: this.plugin.settings.accountOptions,
      },
    };
  }

  open(): Promise<LedgerFormData | null> {
    super.open();
    this.contentEl.empty();
    this.contentEl.addClass('ledger-modal');
    this.renderForm();
    return new Promise(res => (this.resolve = res));
  }

  close() {
    super.close();
    this.contentEl.empty();
  }

  private renderForm() {
    const form = this.contentEl.createEl('form', { cls: 'ledger-input-form' });

    this.buildDataList('fromAccount-list');
    this.buildDataList('toAccount-list');

    const dateInput = this.createField('date', form);
    const payeeInput = this.createField('payee', form);
    const narrInput = this.createField('narration', form) as HTMLTextAreaElement;
    const fromInput = this.createField('fromAccount', form);
    const toInput = this.createField('toAccount', form);
    const amountInput = this.createField('amount', form);
    const currencyInput = this.createField('currency', form);
    const tagsInput = this.createField('tags', form);
    const clearedInput = this.createField('cleared', form) as HTMLInputElement;
    const recurringInput = this.createField('recurring', form) as HTMLInputElement;
    const frequencyInput = this.createField('frequency', form) as HTMLSelectElement;

    frequencyInput.style.display = recurringInput.checked ? 'block' : 'none';
    recurringInput.addEventListener('change', () => {
      frequencyInput.style.display = recurringInput.checked ? 'block' : 'none';
    });

    const ctrl = form.createEl('div', { cls: 'ledger-control-row' });
    const cancel = ctrl.createEl('button', { text: 'Cancel' });
    cancel.type = 'button';
    cancel.onclick = e => { e.preventDefault(); this.resolve(null); this.close(); };

    const submit = ctrl.createEl('button', { text: 'Submit' });
    submit.type = 'submit';

    form.onsubmit = async e => {
      e.preventDefault();
      const data: LedgerFormData = {
        date: (dateInput as HTMLInputElement).value,
        payee: (payeeInput as HTMLInputElement).value.trim(),
        narration: narrInput.value.trim() || undefined,
        fromAccount: (fromInput as HTMLInputElement).value.trim(),
        toAccount: (toInput as HTMLInputElement).value.trim(),
        amount: parseFloat((amountInput as HTMLInputElement).value),
        currency: (currencyInput as HTMLInputElement).value.trim() || 'USD',
        tags: (tagsInput as HTMLInputElement).value.split(/\s+/).filter(t => t),
        cleared: (clearedInput as HTMLInputElement).checked,
        recurring: (recurringInput as HTMLInputElement).checked,
        frequency: recurringInput.checked ? (frequencyInput as HTMLSelectElement).value as 'daily' | 'weekly' | 'monthly' : undefined,
      };

      if (!data.date || !data.payee || isNaN(data.amount) || !data.fromAccount || !data.toAccount) {
        new Notice('Please fill all required fields');
        return;
      }

      this.resolve(data);
      this.close();
    };
  }

  private buildDataList(listId: string) {
    const dl = this.contentEl.createEl('datalist', { attr: { id: listId } });
    for (const acct of this.plugin.settings.accountOptions) {
      dl.createEl('option', { attr: { value: acct } });
    }
    for (const [alias, acct] of Object.entries(this.plugin.settings.accountAliases)) {
      const opt = dl.createEl('option', { attr: { value: acct } });
      opt.textContent = alias;
    }
  }

  private createField<K extends keyof LedgerFormSchema>(
    key: K,
    form: HTMLElement
  ): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
    const cfg = this.schema[key];
    const wrap = form.createEl('div', { cls: 'ledger-field-wrap' });
    wrap.createEl('label', { text: cfg.label });

    let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    switch (cfg.type) {
      case 'textarea':
        input = wrap.createEl('textarea', { cls: 'ledger-input' }) as HTMLTextAreaElement;
        break;
      case 'checkbox':
        input = wrap.createEl('input', { type: 'checkbox', cls: 'ledger-input' }) as HTMLInputElement;
        break;
      case 'autocomplete':
        input = wrap.createEl('input', { type: 'text', cls: 'ledger-input', attr: { list: `${key}-list` } }) as HTMLInputElement;
        break;
      case 'select':
        input = wrap.createEl('select', { cls: 'ledger-input' }) as HTMLSelectElement;
        cfg.options?.forEach(opt => {
          const option = input.createEl('option', { attr: { value: opt } });
          option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
        });
        break;
      default:
        input = wrap.createEl('input', { type: cfg.type, cls: 'ledger-input' }) as HTMLInputElement;
    }

    if (cfg.placeholder) input.setAttr('placeholder', cfg.placeholder);
    if (cfg.step) input.setAttr('step', cfg.step);
    if (cfg.default) input.setAttr('value', cfg.default);
    if (cfg.required && cfg.type !== 'checkbox') input.required = true;

    return input;
  }
}
