import type { LedgerFormData } from '../ui/FormModal';

export function formatTgrosingerEntry(data: LedgerFormData): string {
  const status = data.cleared ? '*' : '!';
  const tagString = data.tags.length ? ' ' + data.tags.join(' ') : '';
  const narration = data.narration ? ` "${data.narration}"` : '';
  let entry = `${data.date} ${status} "${data.payee}"${narration}${tagString}\n`;
  const amt = data.amount.toFixed(2);
  entry += `    ${data.fromAccount}   -${amt} ${data.currency}\n`;
  entry += `    ${data.toAccount}   ${amt} ${data.currency}\n\n`;
  return entry;
}