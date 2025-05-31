import { FileBlock } from './types';

/**
 * Splits a `.ledger` file's content into blocks.
 * Each block is separated by a blank line and contains either:
 *  - a transaction
 *  - a comment
 *  - an alias rule
 *
 * Blocks are returned with their original line numbers to help with navigation/editing.
 */
export const splitIntoBlocks = (fileContents: string): FileBlock[] => {
  const blocks: FileBlock[] = [];
  let currentBlock: FileBlock | null = null;

  fileContents.split('\n').forEach((line, i) => {
    const isBlank = line.trim() === '';

    // 💡 When a blank line is hit, end the current block
    if (isBlank) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      return;
    }

    if (!currentBlock) {
      // 🔧 Start a new block
      currentBlock = {
        block: line,
        firstLine: i,
        lastLine: i,
      };
    } else {
      // 🔗 Append to current block
      currentBlock.block += '\n' + line;
      currentBlock.lastLine = i;
    }
  });

  // 🧹 Push the final block if not followed by a blank line
  if (currentBlock) {
    blocks.push(currentBlock);
  }

  return blocks;
};

