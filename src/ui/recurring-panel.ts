import { RecurringEntry } from '../core/recurring';
import { App, TFile, Notice } from 'obsidian';

const CONFIG_PATH = '.obsidian/plugins/ledger-modern/recurring.json';

export async function renderRecurringPanel(container: HTMLElement, app: App, onRefresh?: () => void) {
  container.empty();

  const file = app.vault.getAbstractFileByPath(CONFIG_PATH);
  if (!(file instanceof TFile)) {
    container.createEl('p', { text: 'Recurring config file not found.' });
    return;
  }

  const raw = await app.vault.read(file);
  let entries: RecurringEntry[] = [];
  try {
    entries = JSON.parse(raw);
  } catch (e) {
    container.createEl('p', { text: 'Error parsing recurring.json' });
    return;
  }

  const list = container.createEl('ul');
  list.style.listStyle = 'none';
  list.style.padding = '0';

  entries.forEach((entry, index) => {
    const item = list.createEl('li');
    item.style.padding = '0.5rem';
    item.style.borderBottom = '1px solid var(--background-modifier-border)';

    const label = item.createEl('strong', { text: entry.label });

    const controls = item.createDiv({ cls: 'recurring-controls' });
    controls.style.display = 'flex';
    controls.style.gap = '1rem';

    // Toggle Active
    const toggle = controls.createEl('input', { type: 'checkbox' });
    toggle.checked = entry.active;
    toggle.onchange = async () => {
      entry.active = toggle.checked;
      await save(entries, file, app);
      new Notice(`Recurring "${entry.label}" ${entry.active ? 'enabled' : 'disabled'}`);
      onRefresh?.();
    };

    // Run Now
    const runNow = controls.createEl('button', { text: 'Run Now' });
    runNow.onclick = async () => {
      const date = window.prompt('Date to run (YYYY-MM-DD)?', new Date().toISOString().slice(0, 10));
      if (!date) return;

      const ledgerFile = app.vault.getAbstractFileByPath('Ledger/2025.ledger');
      if (ledgerFile instanceof TFile) {
        const ledgerEntry = `${date} ${entry.label}\n    ${entry.template}\n`;
        const content = await app.vault.read(ledgerFile);
        await app.vault.modify(ledgerFile, content + '\n' + ledgerEntry);
        new Notice(`Added: ${entry.label}`);
        entry.lastRun = date;
        await save(entries, file, app);
        onRefresh?.();
      }
    };
  });

  container.createEl('p', {
    text: 'To edit full templates, open recurring.json manually.',
    cls: 'recurring-hint'
  });
}

async function save(entries: RecurringEntry[], file: TFile, app: App) {
  await app.vault.modify(file, JSON.stringify(entries, null, 2));
}

