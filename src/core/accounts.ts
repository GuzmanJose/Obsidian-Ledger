// src/core/accounts.ts
export const accountOptions: string[] = [
  'Assets:Cash',
  'Assets:Bank:Checking',
  'Assets:Bank:Savings',
  'Liabilities:CreditCard',
  'Liabilities:Loans',
  'Expenses:Food:Groceries',
  'Expenses:Housing:Rent',
  'Expenses:Utilities:Internet',
  'Expenses:Entertainment:Subscriptions',
  'Income:Job',
  'Income:Freelance',
  'Equity:OpeningBalances',
];

export const accountAliases: Record<string, string> = {
  '💵 Cash': 'Assets:Cash',
  '🏦 Checking': 'Assets:Bank:Checking',
  '🏠 Rent': 'Expenses:Housing:Rent',
  '🛒 Groceries': 'Expenses:Food:Groceries',
  '💳 Credit Card': 'Liabilities:CreditCard',
  '💼 Salary': 'Income:Job',
};

