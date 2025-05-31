import { App, PluginSettingTab, Plugin, MarkdownPostProcessorContext, TFile, Notice, normalizePath, Modal } from 'obsidian';
import { parseLedger, TransactionCache } from './core/parser';
import { DEFAULT_SETTINGS, LedgerSettings } from './core/settings';
import { LedgerSettingTab } from './ui/settings-tab';
import { FormModal, LedgerFormData } from './ui/FormModal';
import { formatTgrosingerEntry } from './core/format';
import { renderDashboard, DashboardModal } from './ui/dashboard';
import { DateTime } from 'luxon';

export default class LedgerModernPlugin extends Plugin {
  settings: LedgerSettings;
  private recurringTimeouts: Map<string, number> = new Map();
  private ledgerFile: TFile | null = null;

  async onload() {
    console.log('[Ledger] Loading plugin');
    await this.loadSettings();

    try {
      await this.migrateLedgerFile();
    } catch (err) {
      console.error(`[Ledger] Migration error: ${err}`);
      new Notice('Failed to migrate ledger file');
    }

    // Expose plugin API
    (window as any).plugin_ledger = {
      getTransactionData: async (): Promise<TransactionCache> => {
        let file = this.ledgerFile;
        if (!file) {
          file = await this.getLedgerFile();
          if (!file) throw new Error('Ledger file not found');
          this.ledgerFile = file;
        }
        const txt = await this.app.vault.read(file);
        const parsed = parseLedger(txt);
        if (parsed.isOk()) return parsed.value;
        throw parsed.error;
      },
      settings: () => this.settings,
      renderDashboard: (el: HTMLElement, data: TransactionCache) => {
        console.log('[Ledger] Rendering dashboard');
        if (!data.transactions.length) {
          el.createEl('p', { text: 'No transactions found. Add entries to see your dashboard.' });
        }
        renderDashboard(el, data, this);
      },
      saveSettings: async () => await this.saveSettings(),
    };

    // Register post-processor for dashboard
    this.registerMarkdownPostProcessor(
      async (el, ctx: MarkdownPostProcessorContext) => {
        console.log(`[Ledger] Post-processor triggered for: ${ctx.sourcePath}`);
        const css = (ctx.frontmatter as any)?.cssclass?.split(/\s+/) || [];
        if (css.includes('ledger-dashboard') || ctx.sourcePath.toLowerCase() === 'dashboard.md') {
          try {
            const data = await (window as any).plugin_ledger.getTransactionData();
            (window as any).plugin_ledger.renderDashboard(el as HTMLElement, data);
          } catch (err) {
            console.error(`[Ledger] Post-processor error: ${err}`);
            el.createEl('p', { text: 'Failed to load dashboard. Check console for details.' });
          }
        }
      }
    );

    // Register commands
    this.addCommand({
      id: 'open-dashboard-note',
      name: 'Open Financial Dashboard',
      callback: () => this.openDashboard(),
    });

    this.addCommand({
      id: 'force-render-dashboard',
      name: 'Force Render Financial Dashboard',
      callback: async () => {
        const leaf = this.app.workspace.getLeaf();
        const el = leaf.view.containerEl.createEl('div');
        try {
          const data = await (window as any).plugin_ledger.getTransactionData();
          (window as any).plugin_ledger.renderDashboard(el, data);
        } catch (err) {
          console.error(`[Ledger] Force render error: ${err}`);
          el.createEl('p', { text: 'Failed to render dashboard. Check console for details.' });
        }
      },
    });

    this.addCommand({
      id: 'refresh-dashboard',
      name: 'Refresh Financial Dashboard',
      callback: async () => {
        const file = this.app.vault.getAbstractFileByPath('Dashboard.md');
        if (file instanceof TFile) {
          await this.app.workspace.openLinkText('Dashboard', '/', false);
          console.log('[Ledger] Refreshed Dashboard');
        } else {
          new Notice('Dashboard not found');
        }
      },
    });

    this.addCommand({
      id: 'force-create-dashboard',
      name: 'Force Create Financial Dashboard',
      callback: async () => {
        await this.createDashboardFile(true);
        new Notice('Dashboard created/reset');
      },
    });

    this.addCommand({
      id: 'open-ledger-file',
      name: 'Open Ledger File',
      callback: async () => {
        const file = await this.getLedgerFile();
        if (file) {
          this.app.workspace.openLinkText(file.path, '/', false);
        } else {
          new Notice('Ledger file not found');
        }
      },
    });

    this.addCommand({
      id: 'debug-ledger-file',
      name: 'Debug Ledger File',
      callback: async () => {
        const filePath = normalizePath(`${this.settings.ledgerFolder}/${new Date().getFullYear()}.md`);
        console.log(`[Ledger] Debugging file: ${filePath}`);
        const existsOnDisk = await this.app.vault.adapter.exists(filePath);
        console.log(`[Ledger] Exists on disk: ${existsOnDisk}`);
        if (existsOnDisk) {
          const content = await this.app.vault.adapter.read(filePath);
          console.log(`[Ledger] File content: ${content.slice(0, 100)}...`);
          const stats = await this.app.vault.adapter.stat(filePath);
          console.log(`[Ledger] File stats: size=${stats?.size}, mtime=${stats?.mtime ? new Date(stats.mtime).toISOString() : 'unknown'}, mode=${stats?.mode?.toString(8) || 'undefined'}`);
        }
        const file = this.app.vault.getAbstractFileByPath(filePath);
        console.log(`[Ledger] Indexed in vault: ${file instanceof TFile}`);
        const rootFiles = await this.app.vault.adapter.list('');
        console.log(`[Ledger] Vault root files: ${JSON.stringify(rootFiles.files)}`);
        const ledgerFiles = await this.app.vault.adapter.list(normalizePath(this.settings.ledgerFolder));
        console.log(`[Ledger] Ledger folder files: ${JSON.stringify(ledgerFiles.files)}`);
        new Notice('Debug info for ledger file logged to console');
      },
    });

    this.addCommand({
      id: 'debug-vault-index',
      name: 'Debug Vault Index',
      callback: () => {
        console.log('[Ledger] Listing all files in vault index:');
        this.app.vault.getAllLoadedFiles().forEach(file => console.log(file.path));
      },
    });

    this.addCommand({
      id: 'trigger-recurring-transactions',
      name: 'Trigger Recurring Transactions',
      callback: async () => {
        const file = await this.getLedgerFile();
        if (file) {
          await this.scheduleRecurringTransactions();
          new Notice('Triggered recurring transactions');
        } else {
          new Notice('Ledger file not found');
        }
      },
    });

    this.addCommand({
      id: 'add-ledger-entry',
      name: 'Add Ledger Entry',
      callback: () => this.createEntry(),
    });

    // Register URL handler
    this.register(() => {
      this.app.workspace.on('url:open', (url: string) => {
        if (url.startsWith('obsidian://ledger')) {
          this.createEntry();
        }
      });
    });

    // Ribbon icon
    this.addRibbonIcon('plus', 'Add Ledger Entry', () => this.createEntry());

    // Settings tab
    this.addSettingTab(new LedgerSettingTab(this.app, this));

    // Debug log to confirm we reach this point
    console.log('[Ledger] About to call initializeLedgerPostLoad');

    // Trigger post-load initialization
    this.initializeLedgerPostLoad();

    console.log('[Ledger] Plugin loaded');
  }

  onunload() {
    console.log('[Ledger] Plugin unloaded');
    this.recurringTimeouts.forEach(timeout => clearTimeout(timeout));
    this.recurringTimeouts.clear();
    this.ledgerFile = null;
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (!this.settings.fileExtension) {
      this.settings.fileExtension = 'md';
      await this.saveSettings();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
    console.log('[Ledger] Settings saved');
    if (this.settings.autoRunRecurring) {
      const file = await this.getLedgerFile();
      if (file) {
        this.ledgerFile = file;
        await this.scheduleRecurringTransactions();
      }
    }
  }

  private async migrateLedgerFile() {
    const oldPath = normalizePath(`${this.settings.ledgerFolder}/${new Date().getFullYear()}.ledger`);
    const newPath = normalizePath(`${this.settings.ledgerFolder}/${new Date().getFullYear()}.md`);
    if (await this.app.vault.adapter.exists(oldPath) && !(await this.app.vault.adapter.exists(newPath))) {
      console.log(`[Ledger] Migrating ${oldPath} to ${newPath}`);
      const content = await this.app.vault.adapter.read(oldPath);
      await this.app.vault.adapter.write(newPath, content);
      await this.app.vault.adapter.remove(oldPath);
      console.log('[Ledger] Migration complete');
    }
  }

  private isMobile(): boolean {
    return /iPhone|iPad|Android/.test(navigator.userAgent);
  }

  private async ensureNestedFolders(folderPath: string, retries: number = 3): Promise<boolean> {
    const parts = folderPath.split('/');
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const normalized = normalizePath(current);
      console.log(`[Ledger] Checking folder: ${normalized}`);
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const exists = await this.app.vault.adapter.exists(normalized);
          if (!exists) {
            await this.app.vault.createFolder(normalized);
            console.log(`[Ledger] Created folder: ${normalized}`);
          } else {
            console.log(`[Ledger] Folder exists: ${normalized}`);
          }
          break;
        } catch (err) {
          console.error(`[Ledger] createFolder attempt ${attempt}/${retries} error: ${err}`);
          if (attempt === retries) {
            new Notice('Failed to create folder after retries');
            return false;
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    return true;
  }

  private async getLedgerFile(maxRetries: number = 6): Promise<TFile | null> {
    const raw = (this.settings?.ledgerFolder || DEFAULT_SETTINGS.ledgerFolder).trim().replace(/^\/+/, '').replace(/\/+$/, '');
    const folderPath = normalizePath(raw);
    const filePath = normalizePath(`${folderPath}/${new Date().getFullYear()}.${this.settings.fileExtension || 'md'}`);

    console.log(`[Ledger] Getting ledger file: raw=${raw}, folder=${folderPath}, file=${filePath}`);

    const foldersCreated = await this.ensureNestedFolders(folderPath);
    if (!foldersCreated) {
      console.error('[Ledger] Failed to ensure folders');
      return null;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        console.log(`[Ledger] File found in index: ${filePath}`);
        return file;
      }

      const existsOnDisk = await this.app.vault.adapter.exists(filePath);
      if (existsOnDisk) {
        console.warn(`[Ledger] File exists on disk but not indexed (attempt ${attempt}/${maxRetries})`);
        this.app.vault.trigger('refresh');
        await new Promise(resolve => setTimeout(resolve, 7000)); // 7-second delay for indexing
        const refreshedFile = this.app.vault.getAbstractFileByPath(filePath);
        if (refreshedFile instanceof TFile) {
          console.log(`[Ledger] File indexed after refresh: ${filePath}`);
          return refreshedFile;
        }
        console.warn(`[Ledger] Still not indexed after refresh (attempt ${attempt})`);
      } else {
        try {
          console.log(`[Ledger] File does not exist, creating: ${filePath}`);
          const newFile = await this.app.vault.create(filePath, `; Ledger ${new Date().getFullYear()}\n`);
          this.app.vault.trigger('refresh');
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2-second delay after creation
          return newFile;
        } catch (err) {
          console.error(`[Ledger] create() error: ${err}`);
        }
      }
    }

    console.error('[Ledger] Failed to load or create ledger file after retries');
    new Notice('Failed to load or create ledger file. Check console for details.');
    return null;
  }

  private async createEntry() {
    const file = await this.getLedgerFile();
    if (!file) return;
    this.ledgerFile = file;

    const modal = new FormModal(this.app, this);
    const data = await modal.open();
    if (!data) return;

    const entry = formatTgrosingerEntry(data);
    try {
      await this.app.vault.append(file, entry);
      new Notice('Entry added');
      console.log(`[Ledger] Added entry:\n${entry}`);
      if (data.recurring && data.frequency) {
        await this.processRecurring(data);
      }
    } catch (e) {
      console.error(`[Ledger] append error: ${e}`);
      new Notice('Failed to append entry');
    }
  }

  private async createDashboardFile(force: boolean = false) {
    const filePath = 'Dashboard.md';
    let file = this.app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile && force) {
      await this.app.vault.delete(file);
      file = null;
    }
    if (!file) {
      const header = `---
cssclass: ledger-dashboard
ledger: dashboard
---
# Financial Dashboard
`;
      file = await this.app.vault.create(filePath, header);
      console.log('[Ledger] Created Dashboard');
    } else {
      const content = await this.app.vault.read(file);
      if (!content.includes('ledger: dashboard')) {
        const updatedContent = `---
cssclass: ledger-dashboard
ledger: dashboard
---
${content.replace(/^---[\s\S]*?---\n?/, '')}`;
        await this.app.vault.modify(file, updatedContent);
        console.log('[Ledger] Updated Dashboard frontmatter');
      }
    }
    return file;
  }

  private async openDashboard() {
    if (this.isMobile()) {
      try {
        const data = await (window as any).plugin_ledger.getTransactionData();
        new DashboardModal(this.app, data, this).open();
      } catch (err) {
        console.error(`[Ledger] Mobile dashboard error: ${err}`);
        new Notice('Failed to load mobile dashboard');
      }
    } else {
      let file = await this.createDashboardFile();
      if (file instanceof TFile) {
        await this.app.workspace.openLinkText('Dashboard', '/', false);
        console.log('[Ledger] Opened Dashboard');
      }
    }
  }

  private async processRecurring(data: LedgerFormData) {
    if (!data.recurring || !data.frequency) return;

    const file = await this.getLedgerFile();
    if (!file) return;
    this.ledgerFile = file;

    const currentDate = DateTime.fromISO(data.date);
    let nextDate: DateTime;
    switch (data.frequency) {
      case 'daily':
        nextDate = currentDate.plus({ days: 1 });
        break;
      case 'weekly':
        nextDate = currentDate.plus({ weeks: 1 });
        break;
      case 'monthly':
        nextDate = currentDate.plus({ months: 1 });
        break;
      default:
        return;
    }

    const nextEntry = { ...data, date: nextDate.toISODate() };
    const entry = formatTgrosingerEntry(nextEntry);
    await this.app.vault.append(file, entry);
    console.log(`[Ledger] Added recurring entry:\n${entry}`);
    new Notice('Scheduled recurring entry');

    if (this.settings.autoRunRecurring) {
      const timeoutId = window.setTimeout(
        () => this.processRecurring(nextEntry),
        nextDate.diff(currentDate).as('milliseconds')
      );
      this.recurringTimeouts.set(`${data.date}-${data.payee}`, timeoutId);
    }
  }

  private async scheduleRecurringTransactions() {
    const file = await this.getLedgerFile();
    if (!file) {
      console.warn('[Ledger] Skipping recurring transactions: no ledger file');
      return;
    }
    this.ledgerFile = file;

    const txt = await this.app.vault.read(file);
    const parsed = parseLedger(txt);
    if (!parsed.isOk()) {
      console.error(`[Ledger] Parse error: ${parsed.error}`);
      return;
    }

    const recurringTxs = parsed.value.transactions.filter(tx =>
      tx.expenseLines.some(line => line.comment?.includes('recurring'))
    );

    if (recurringTxs.length > 0) {
      console.log(`[Ledger] Scheduled ${recurringTxs.length} recurring transactions`);
      recurringTxs.forEach(tx => {
        const data: LedgerFormData = {
          date: tx.date.toISODate(),
          payee: tx.payee || '',
          fromAccount: tx.expenseLines[0]?.account || this.settings.defaultAccount,
          toAccount: tx.expenseLines[1]?.account || this.settings.defaultAccount,
          amount: Math.abs(tx.expenseLines[0]?.amount || 0),
          currency: tx.expenseLines[0]?.currency || 'USD',
          tags: [],
          cleared: tx.expenseLines[0]?.reconcile === '*',
          recurring: true,
          frequency: tx.expenseLines[0]?.comment?.includes('daily') ? 'daily' :
                     tx.expenseLines[0]?.comment?.includes('weekly') ? 'weekly' : 'monthly',
        };
        this.processRecurring(data);
      });
    } else {
      console.log('[Ledger] No recurring transactions found');
    }
  }

  // Method to initialize ledger file post-load
  private initializeLedgerPostLoad() {
    console.log('[Ledger] Initializing ledger file post-load');
    this.app.vault.trigger('refresh'); // Manual trigger to ensure indexing
    setTimeout(() => {
      console.log('[Ledger] Starting delayed ledger initialization');
      this.getLedgerFile().then(file => {
        if (file) {
          this.ledgerFile = file;
          console.log('[Ledger] Ledger file initialized successfully');
          if (this.settings.autoRunRecurring) {
            console.log('[Ledger] Scheduling recurring transactions');
            this.scheduleRecurringTransactions().catch(err => {
              console.error(`[Ledger] Recurring transactions error: ${err}`);
            });
          }
        } else {
          console.warn('[Ledger] Skipped recurring transactions: no ledger file');
          setTimeout(() => {
            console.log('[Ledger] Retrying ledger file initialization');
            this.getLedgerFile().then(retryFile => {
              if (retryFile) {
                this.ledgerFile = retryFile;
                console.log('[Ledger] Ledger file initialized on retry');
                if (this.settings.autoRunRecurring) {
                  console.log('[Ledger] Retrying recurring transactions');
                  this.scheduleRecurringTransactions().catch(err => {
                    console.error(`[Ledger] Retry recurring transactions error: ${err}`);
                  });
                }
              } else {
                console.error('[Ledger] Failed to initialize ledger file on retry');
              }
            }).catch(err => {
              console.error(`[Ledger] Retry error: ${err}`);
            });
          }, 10000);
        }
      }).catch(err => {
        console.error(`[Ledger] Post-load initialization error: ${err}`);
        new Notice('Ledger plugin failed to initialize');
      });
    }, 3000); // 3-second delay for your test
  }
}
