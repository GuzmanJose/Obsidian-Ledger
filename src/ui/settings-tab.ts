import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import LedgerModernPlugin from '../main';

export class LedgerSettingTab extends PluginSettingTab {
  constructor(app: App, plugin: LedgerModernPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    const plugin = this.plugin as LedgerModernPlugin;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Ledger Plugin Settings' });

    // 1) Ledger Folder
    new Setting(containerEl)
      .setName('Ledger Folder')
      .setDesc('Relative path to your ledger folder (e.g., Finances/Ledger)')
      .addText(text =>
        text
          .setPlaceholder('Finances/Ledger')
          .setValue(plugin.settings.ledgerFolder)
          .onChange(async value => {
            const trimmed = value.trim();
            if (!trimmed) {
              new Notice('Ledger folder cannot be empty');
              return;
            }
            plugin.settings.ledgerFolder = trimmed;
            await plugin.saveSettings();
          })
      );

    // 2) Default Account
    new Setting(containerEl)
      .setName('Default Account')
      .setDesc('Used in the input form for the credit account (e.g., Assets:Checking)')
      .addText(text =>
        text
          .setPlaceholder('Assets:Checking')
          .setValue(plugin.settings.defaultAccount)
          .onChange(async value => {
            const trimmed = value.trim();
            if (!trimmed) {
              new Notice('Default account cannot be empty');
              return;
            }
            plugin.settings.defaultAccount = trimmed;
            await plugin.saveSettings();
          })
      );

    // 3) Auto-Run Recurring
    new Setting(containerEl)
      .setName('Auto-Run Recurring on Startup')
      .setDesc('Automatically add monthly entries when plugin loads')
      .addToggle(toggle =>
        toggle
          .setValue(plugin.settings.autoRunRecurring)
          .onChange(async value => {
            plugin.settings.autoRunRecurring = value;
            await plugin.saveSettings();
          })
      );

    // 4) Account Options (one per line)
    new Setting(containerEl)
      .setName('Account Options')
      .setDesc('One full account path per line (e.g., Assets:Cash)')
      .addTextArea(text =>
        text
          .setPlaceholder('Assets:Cash\nAssets:Bank:Checking\n…')
          .setValue(plugin.settings.accountOptions.join('\n'))
          .onChange(async value => {
            plugin.settings.accountOptions = value
              .split('\n')
              .map(l => l.trim())
              .filter(Boolean);
            await plugin.saveSettings();
          })
      );

    // 5) Account Aliases (alias=fullPath per line)
    new Setting(containerEl)
      .setName('Account Aliases')
      .setDesc('One alias=account mapping per line (e.g., 💵 Cash=Assets:Cash)')
      .addTextArea(text =>
        text
          .setPlaceholder('💵 Cash=Assets:Cash\n🏦 Checking=Assets:Bank:Checking\n…')
          .setValue(
            Object.entries(plugin.settings.accountAliases)
              .map(([alias, acct]) => `${alias}=${acct}`)
              .join('\n')
          )
          .onChange(async value => {
            const map: Record<string, string> = {};
            value.split('\n').forEach(line => {
              const [alias, acct] = line.split('=').map(s => s.trim());
              if (alias && acct) map[alias] = acct;
            });
            plugin.settings.accountAliases = map;
            await plugin.saveSettings();
          })
      );
  }
}