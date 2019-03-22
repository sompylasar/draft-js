/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @flow
 * @emails oncall+draft_js
 */

'use strict';

import type {BlockMap} from 'BlockMap';
import type {BlockNodeRecord} from 'BlockNodeRecord';

const ContentBlockNode = require('ContentBlockNode');
const ContentState = require('ContentState');
const SelectionState = require('SelectionState');

const generateRandomKey = require('generateRandomKey');
const invariant = require('invariant');
const modifyBlockForContentState = require('modifyBlockForContentState');
const inheritAndUpdate = require('inheritAndUpdate');

const transformBlock = (
  key: ?string,
  blockMap: Map<string, BlockNodeRecord>,
  func: (block: BlockNodeRecord) => BlockNodeRecord,
): void => {
  if (!key) {
    return;
  }

  const block = blockMap.get(key);

  if (!block) {
    return;
  }

  blockMap.set(key, func(block));
};

const updateBlockMapLinks = (
  blockMap: BlockMap,
  originalBlock: ContentBlockNode,
  belowBlock: ContentBlockNode,
): BlockMap => {
  const newBlockMap = new Map(blockMap.entries());

  const originalBlockKey = originalBlock.getKey();
  const belowBlockKey = belowBlock.getKey();

  // update block parent
  transformBlock(originalBlock.getParentKey(), newBlockMap, block => {
    if (!(block instanceof ContentBlockNode)) {
      return block;
    }

    const parentChildrenList = block.getChildKeys();
    const insertionIndex = parentChildrenList.indexOf(originalBlockKey) + 1;

    const newChildrenArray = Array.from(parentChildrenList);
    newChildrenArray.splice(insertionIndex, 0, belowBlockKey);

    return inheritAndUpdate(block, {
      children: newChildrenArray,
    });
  });

  // update original next block
  transformBlock(originalBlock.getNextSiblingKey(), newBlockMap, block => {
    if (!(block instanceof ContentBlockNode)) {
      return block;
    }
    return inheritAndUpdate(block, {
      prevSibling: belowBlockKey,
    });
  });

  // update original block
  transformBlock(originalBlockKey, newBlockMap, block => {
    if (!(block instanceof ContentBlockNode)) {
      return block;
    }
    return inheritAndUpdate(block, {
      nextSibling: belowBlockKey,
    });
  });

  // update below block
  transformBlock(belowBlockKey, newBlockMap, block => {
    if (!(block instanceof ContentBlockNode)) {
      return block;
    }
    return inheritAndUpdate(block, {
      prevSibling: originalBlockKey,
    });
  });

  return ((newBlockMap: any): BlockMap);
};

const splitBlockInContentState = (
  contentState: ContentState,
  selectionState: SelectionState,
): ContentState => {
  invariant(selectionState.isCollapsed(), 'Selection range must be collapsed.');

  const key = selectionState.getAnchorKey();
  const blockMap = contentState.getBlockMap();
  const blockToSplit = blockMap.get(key);
  if (!blockToSplit) {
    invariant(false, 'Selection anchorKey must point to an existing block.');
  }

  const text = blockToSplit.getText();

  if (!text) {
    const blockType = blockToSplit.getType();
    if (
      blockType === 'unordered-list-item' ||
      blockType === 'ordered-list-item'
    ) {
      return modifyBlockForContentState(contentState, selectionState, block =>
        inheritAndUpdate(block, {type: 'unstyled', depth: 0}),
      );
    }
  }

  const offset = selectionState.getAnchorOffset();
  const chars = blockToSplit.getCharacterList();
  const keyBelow = generateRandomKey();
  const isExperimentalTreeBlock = blockToSplit instanceof ContentBlockNode;

  const blockAbove = inheritAndUpdate(blockToSplit, {
    text: text.slice(0, offset),
    characterList: chars.slice(0, offset),
  });
  const blockBelow = inheritAndUpdate(blockAbove, {
    key: keyBelow,
    text: text.slice(offset),
    characterList: chars.slice(offset),
    data: new Map(),
  });

  const blockMapEntriesBefore = [];
  const blockMapEntriesAfter = [];
  let blockMapEntriesToPushTo = blockMapEntriesBefore;
  for (const blockMapEntry of blockMap.entries()) {
    if (blockMapEntry[1] === blockToSplit) {
      blockMapEntriesToPushTo = blockMapEntriesAfter;
      // do not push the blockToSplit
    } else {
      blockMapEntriesToPushTo.push(blockMapEntry);
    }
  }
  let newBlocks = new Map([
    ...blockMapEntriesBefore,
    [key, blockAbove],
    [keyBelow, blockBelow],
    ...blockMapEntriesAfter,
  ]);

  if (isExperimentalTreeBlock) {
    invariant(
      blockToSplit.getChildKeys().length <= 0,
      'ContentBlockNode must not have children',
    );

    newBlocks = updateBlockMapLinks(newBlocks, blockAbove, blockBelow);
  }

  return ContentState.set(contentState, {
    blockMap: newBlocks,
    selectionBefore: selectionState,
    selectionAfter: SelectionState.set(selectionState, {
      anchorKey: keyBelow,
      anchorOffset: 0,
      focusKey: keyBelow,
      focusOffset: 0,
      isBackward: false,
    }),
  });
};

module.exports = splitBlockInContentState;
