export interface LedgerFormSchema {
  date: { type: 'date'; label: string; default: string; required: boolean };
  payee: { type: 'text'; label: string; placeholder: string; required: boolean };
  narration: { type: 'textarea'; label: string; placeholder: string };
  fromAccount: { type: 'autocomplete'; label: string; options: string[]; required: boolean };
  toAccount: { type: 'autocomplete'; label: string; options: string[]; required: boolean };
  amount: { type: 'number'; label: string; step: string; required: boolean };
  currency: { type: 'text'; label: string; default: string; required: boolean };
  tags: { type: 'text'; label: string; placeholder: string };
  cleared: { type: 'checkbox'; label: string };
  recurring: { type: 'checkbox'; label: string };
  frequency: { type: 'select'; label: string; options: string[] };
}

export const ledgerFormSchema: LedgerFormSchema = {
  date: {
    type: 'date',
    label: 'Date',
    default: new Date().toISOString().split('T')[0],
    required: true,
  },
  payee: {
    type: 'text',
    label: 'Payee',
    placeholder: 'Enter payee',
    required: true,
  },
  narration: {
    type: 'textarea',
    label: 'Narration',
    placeholder: 'Optional description',
  },
  fromAccount: {
    type: 'autocomplete',
    label: 'From Account',
    options: [],
    required: true,
  },
  toAccount: {
    type: 'autocomplete',
    label: 'To Account',
    options: [],
    required: true,
  },
  amount: {
    type: 'number',
    label: 'Amount',
    step: '0.01',
    required: true,
  },
  currency: {
    type: 'text',
    label: 'Currency',
    default: 'USD',
    required: true,
  },
  tags: {
    type: 'text',
    label: 'Tags',
    placeholder: 'Space-separated tags',
  },
  cleared: {
    type: 'checkbox',
    label: 'Cleared',
  },
  recurring: {
    type: 'checkbox',
    label: 'Recurring',
  },
  frequency: {
    type: 'select',
    label: 'Frequency',
    options: ['daily', 'weekly', 'monthly'],
  },
};