// src/ui/renderInputForm.ts
import { Notice } from 'obsidian';

type ExpenseType = 'Normal' | 'Business';

interface RenderInputFormOptions {
  container: HTMLElement;
  defaultAccount: string;
  onSubmit: (entry: string) => void;
  onCancel?: () => void;
}

export function renderInputForm({
  container,
  defaultAccount,
  onSubmit,
  onCancel,
}: RenderInputFormOptions) {
  container.empty();

  // 1) Form
  const form = document.createElement('form');
  form.classList.add('ledger-input-form');
  container.append(form);

  // 2) Date & Payee
  const dateWrap = labeledInput('Date', { type: 'date', value: new Date().toISOString().slice(0, 10) });
  const payeeWrap = labeledInput('Payee', { placeholder: 'e.g. Grocery Store' });
  form.append(dateWrap.wrap, payeeWrap.wrap);

  // 3) Add‐Line Buttons
  const btnRow = document.createElement('div');
  btnRow.classList.add('ledger-add-buttons');

  const addNormalBtn = document.createElement('button');
  addNormalBtn.type = 'button';
  addNormalBtn.textContent = '➕ Add Normal';
  addNormalBtn.onclick = () => addExpenseRow('Normal');

  const addBusinessBtn = document.createElement('button');
  addBusinessBtn.type = 'button';
  addBusinessBtn.textContent = '➕ Add Business';
  addBusinessBtn.onclick = () => addExpenseRow('Business');

  btnRow.append(addNormalBtn, addBusinessBtn);
  form.append(btnRow);

  // 4) Rows container
  const rowsContainer = document.createElement('div');
  form.append(rowsContainer);

  const expenseRows: {
    type: ExpenseType;
    acc: HTMLInputElement;
    amt: HTMLInputElement;
    cmt: HTMLInputElement;
  }[] = [];

  function addExpenseRow(type: ExpenseType) {
    const rowWrapper = document.createElement('div');
    rowWrapper.classList.add('ledger-row-wrapper');

    // A) Top fields
    const fieldsRow = document.createElement('div');
    fieldsRow.classList.add('ledger-fields-row');

    const typeFld = document.createElement('input');
    typeFld.type = 'text';
    typeFld.value = type;
    typeFld.disabled = true;
    typeFld.style.width = '5rem';

    const acc = document.createElement('input');
    acc.type = 'text';
    acc.placeholder = type === 'Normal'
      ? 'Expenses:Personal:Category'
      : 'Expenses:Business:Category';
    acc.required = true;
    acc.style.flex = '2';

    const amt = document.createElement('input');
    amt.type = 'number';
    amt.step = '0.01';
    amt.placeholder = 'Amount';
    amt.required = true;
    amt.style.flex = '1';

    fieldsRow.append(typeFld, acc, amt);
    rowWrapper.append(fieldsRow);

    // B) Comment
    const cmt = document.createElement('input');
    cmt.type = 'text';
    cmt.placeholder = 'Comment (opt.)';
    cmt.classList.add('ledger-comment-input');
    rowWrapper.append(cmt);

    // C) Remove button
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.classList.add('ledger-remove-btn');
    removeBtn.textContent = '🗑️';
    removeBtn.onclick = () => {
      rowsContainer.removeChild(rowWrapper);
      const idx = expenseRows.findIndex(r => r.acc === acc);
      if (idx > -1) expenseRows.splice(idx, 1);
    };
    rowWrapper.append(removeBtn);

    rowsContainer.append(rowWrapper);
    expenseRows.push({ type, acc, amt, cmt });
  }

  // seed one normal row
  addExpenseRow('Normal');

  // 5) Submit / Cancel
  const ctlRow = document.createElement('div');
  ctlRow.classList.add('ledger-control-row');

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = e => { e.preventDefault(); onCancel?.(); };

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Submit';

  ctlRow.append(cancelBtn, submitBtn);
  form.append(ctlRow);

  form.onsubmit = e => {
    e.preventDefault();
    const date = (dateWrap.field as HTMLInputElement).value;
    const payee = (payeeWrap.field as HTMLInputElement).value.trim();
    if (!date || !payee) {
      new Notice('Date and Payee are required');
      return;
    }

    let entry = `${date} ${payee}\n`;
    for (const { acc, amt, cmt } of expenseRows) {
      const category = acc.value.trim();
      const amount = parseFloat(amt.value);
      if (!category || isNaN(amount)) continue;
      entry += `    ${category}    $${amount.toFixed(2)}`;
      const comment = cmt.value.trim();
      if (comment) entry += `    ; ${comment}`;
      entry += '\n';
    }
    entry += `    ${defaultAccount}\n\n`;
    onSubmit(entry);

    form.reset();
    rowsContainer.empty();
    expenseRows.length = 0;
    addExpenseRow('Normal');
  };

  // ──────── helper ────────
  function labeledInput(labelText: string, attrs: Partial<HTMLInputElement>) {
    const wrap = document.createElement('div');
    wrap.classList.add('ledger-field-wrap');
    const label = document.createElement('label');
    label.textContent = labelText;
    const field = document.createElement('input');
    Object.assign(field, attrs);
    wrap.append(label, field);
    return { wrap, field };
  }
}

