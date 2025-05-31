import { DateTime } from 'luxon';

/* ----------------------------------------------------------------------------
 * 🧾 Ledger Core Types — Modernized for Mobile + Plugin SDK
 * ------------------------------------------------------------------------- */

/**
 * A basic posting/line from a ledger transaction.
 * Can be an expense, asset, income, etc.
 */
export interface Expenseline {
  account: string;
  amount?: number;
  comment?: string;
  currency?: string;
  reconcile: '' | '*' | '!';
}

/**
 * A fully parsed and normalized expense line.
 * Used after aliasing, number parsing, and formatting.
 */
export interface EnhancedExpenseLine extends Expenseline {
  amount: number;
  dealiasedAccount: string;
}

/**
 * A single-line comment in the ledger file.
 */
export interface Commentline {
  comment: string;
}

/**
 * A raw alias rule, like:
 * alias Checking = Assets:Bank:Checking
 */
export interface Alias {
  type: 'alias';
  from: string;
  to: string;
}

/**
 * A top-level comment block.
 */
export interface Comment {
  type: 'comment';
  comment: string;
}

/*
 * Raw parsed transaction from the grammar parser.
*/ 
export interface Transaction {
  type: 'tx';
  blockLine: number; // position inside block
  value: {
    check?: number;
    comment?: string;
    date: string; // stored as raw ISO string before conversion
    payee: string;
    expenselines: (Expenseline | Commentline)[];
  };
}

/* ----------------------------------------------------------------------------
 * 🧱 Structured Transaction (after enhancements)
 * ------------------------------------------------------------------------- */

/**
 * A fully enhanced transaction.
 * Used throughout the app for display, charting, summaries.
 */
export interface EnhancedTransaction {
  date: DateTime;
  payee?: string;
  expenseLines: EnhancedExpenseLine[];
  comments: string[];
  blockRange: {
    start: number;
    end: number;
  };
  line: number;
  tag?: string;
  alias?: string;
}

/* ----------------------------------------------------------------------------
 * 📄 File + Block Tracking Types
 * ------------------------------------------------------------------------- */

/**
 * Raw text block with its start and end line numbers in the file.
 */
export interface FileBlock {
  block: string;
  firstLine: number;
  lastLine: number;
}

/**
 * Alias entry with file metadata
 */
export type AliasWithBlock = Alias & { block: FileBlock };

/**
 * Comment entry with file metadata
 */
export type CommentWithBlock = Comment & { block: FileBlock };

/**
 * Transaction entry with file metadata
 */
export type TransactionWithBlock = Transaction & { block: FileBlock };

/* ----------------------------------------------------------------------------
 * 🔁 Parse Unions
 * ------------------------------------------------------------------------- */

export type Element = Transaction | Alias | Comment;
export type ElementWithBlock = TransactionWithBlock | AliasWithBlock | CommentWithBlock;

export interface LedgerFormData {
  date: string;
  payee: string;
  narration?: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  currency: string;
  tags: string[];
  cleared: boolean;
  recurring: boolean;
  frequency?: 'daily' | 'weekly' | 'monthly'; // Added for recurrence
}

