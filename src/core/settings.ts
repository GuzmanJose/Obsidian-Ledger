export interface LedgerSettings {
  ledgerFolder: string;
  defaultAccount: string;
  autoRunRecurring: boolean;
  accountOptions: string[];
  accountAliases: Record<string, string>;
  budgets: Record<string, number>;
  lastGroupBy: string;
  lastDataBy: string;
  fileExtension: string; // New
}

export const DEFAULT_SETTINGS: LedgerSettings = {
  ledgerFolder: 'Finances/Ledger',
  defaultAccount: 'Assets:Checking',
  autoRunRecurring: false,
  accountOptions: [],
  accountAliases: {},
  budgets: {},
  lastGroupBy: 'week',
  lastDataBy: '',
  fileExtension: 'md', // New
};
