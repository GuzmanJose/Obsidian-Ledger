import { App, TFile, normalizePath } from 'obsidian';
import { DateTime } from 'luxon';
import { join } from 'path';
import { Vault } from 'obsidian';

export interface RecurringEntry {
  id: string;
  label: string;
  day: number; // e.g., 1 = 1st of month
  active: boolean;
  template: string;
  lastRun: string; // ISO date
}

export async function processRecurring(app: App, ledgerFilePath: string): Promise<void> {
  const configPath = '.obsidian/plugins/ledger-modern/recurring.json';
  const file = app.vault.getAbstractFileByPath(configPath);
  let entries: RecurringEntry[] = [];

  if (file && file instanceof TFile) {
    const content = await app.vault.read(file);
    entries = JSON.parse(content) as RecurringEntry[];
  }

  const today = DateTime.now();

  for (const entry of entries) {
    if (!entry.active) continue;

    const lastRun = DateTime.fromISO(entry.lastRun);
    if (today.day >= entry.day && lastRun.month < today.month) {
      const dueDate = DateTime.local(today.year, today.month, entry.day);
      const ledgerEntry = `${dueDate.toISODate()} ${entry.label}\n    ${entry.template}\n`;

      const ledgerFile = app.vault.getAbstractFileByPath(ledgerFilePath);
      if (ledgerFile && ledgerFile instanceof TFile) {
        const existing = await app.vault.read(ledgerFile);
        await app.vault.modify(ledgerFile, existing + '\n' + ledgerEntry);
      }

      // update lastRun
      entry.lastRun = dueDate.toISODate();
    }
  }

  // Save updated recurring config
  const updatedJson = JSON.stringify(entries, null, 2);
  if (file && file instanceof TFile) {
    await app.vault.modify(file, updatedJson);
  }
}

