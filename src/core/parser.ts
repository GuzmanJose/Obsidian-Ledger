import { Result, ok, err } from 'neverthrow';
import { TransactionCache, EnhancedTransaction, EnhancedExpenseLine, FileBlock } from './types';
import { DateTime } from 'luxon';

function splitIntoBlocks(file: string): FileBlock[] {
  const lines = file.split(/\r?\n/);
  const blocks: FileBlock[] = [];
  let currentBlock: string[] = [];
  let startLine = 0;
  lines.forEach((line, idx) => {
    if (/^\d{4}-\d{2}-\d{2}\s+/.test(line)) {
      if (currentBlock.length) blocks.push({ block: currentBlock.join('\n'), firstLine: startLine, lastLine: idx - 1 });
      currentBlock = [line];
      startLine = idx;
    } else {
      currentBlock.push(line);
    }
  });
  if (currentBlock.length) blocks.push({ block: currentBlock.join('\n'), firstLine: startLine, lastLine: lines.length - 1 });
  return blocks;
}

export function parseLedger(file: string): Result<TransactionCache, Error> {
  try {
    const blocks = splitIntoBlocks(file);
    const txs: EnhancedTransaction[] = [];

    for (const { block, firstLine } of blocks) {
      const lines = block.split(/\r?\n/);
      const headerMatch = lines[0].match(/^(\d{4}-\d{2}-\d{2})\s+([*!]?)\s+"([^"]+)"(?:\s+"([^"]+)")?(?:\s+(.+))?$/);
      if (!headerMatch) continue;

      const [, dateStr, status, payee, narration, tags] = headerMatch;
      const date = DateTime.fromFormat(dateStr, 'yyyy-MM-dd');
      if (!date.isValid) continue;

      const expenseLines: EnhancedExpenseLine[] = [];
      const comments: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith(';')) {
          comments.push(line.slice(1).trim());
          continue;
        }
        const expenseMatch = line.match(/^([\w:]+)\s+([-]?\d+\.\d{2})\s+(\w+)(?:\s+;\s*(.*))?$/);
        if (expenseMatch) {
          const [, account, amountStr, currency, comment] = expenseMatch;
          const amount = parseFloat(amountStr);
          const category = account.startsWith('Expenses:') ? account.split(':').slice(1).join(':') : '';
          expenseLines.push({
            account,
            amount,
            currency,
            category,
            reconcile: status as '' | '*' | '!',
            comment: comment || '',
            dealiasedAccount: account,
          });
        }
      }

      if (expenseLines.length < 2) continue;

      txs.push({
        date,
        payee,
        expenseLines,
        comments,
        blockRange: { start: firstLine, end: firstLine + lines.length - 1 },
        line: firstLine,
        tag: tags?.split(/\s+/).filter(t => t)[0],
      });
    }

    const accounts = Array.from(new Set(txs.flatMap(t => t.expenseLines.map(l => l.account))));
    const cache: TransactionCache = {
      transactions: txs,
      parsingErrors: [],
      accounts,
      expenseAccounts: accounts.filter(a => a.startsWith('Expenses')),
      assetAccounts: accounts.filter(a => a.startsWith('Assets')),
      incomeAccounts: accounts.filter(a => a.startsWith('Income')),
      liabilityAccounts: accounts.filter(a => a.startsWith('Liabilities')),
    };
    return ok(cache);
  } catch (e) {
    return err(e as Error);
  }
}