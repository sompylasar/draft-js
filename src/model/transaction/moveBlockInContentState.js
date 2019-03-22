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
import type {DraftInsertionType} from 'DraftInsertionType';

const ContentBlockNode = require('ContentBlockNode');
const ContentState = require('ContentState');
const SelectionState = require('SelectionState');

const getNextDelimiterBlockKey = require('getNextDelimiterBlockKey');
const inheritAndUpdate = require('inheritAndUpdate');
const invariant = require('invariant');

const transformBlock = (
  key: ?string,
  blockMap: BlockMap,
  func: (block: ContentBlockNode) => ContentBlockNode,
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
  originalBlockToBeMoved: BlockNodeRecord,
  originalTargetBlock: BlockNodeRecord,
  insertionMode: DraftInsertionType,
  isExperimentalTreeBlock: boolean,
): BlockMap => {
  if (!isExperimentalTreeBlock) {
    return blockMap;
  }

  // possible values of 'insertionMode' are: 'after', 'before'
  const isInsertedAfterTarget = insertionMode === 'after';

  const originalBlockKey = originalBlockToBeMoved.getKey();
  const originalTargetKey = originalTargetBlock.getKey();
  const originalParentKey = originalBlockToBeMoved.getParentKey();
  const originalNextSiblingKey = originalBlockToBeMoved.getNextSiblingKey();
  const originalPrevSiblingKey = originalBlockToBeMoved.getPrevSiblingKey();
  const newParentKey = originalTargetBlock.getParentKey();
  const newNextSiblingKey = isInsertedAfterTarget
    ? originalTargetBlock.getNextSiblingKey()
    : originalTargetKey;
  const newPrevSiblingKey = isInsertedAfterTarget
    ? originalTargetKey
    : originalTargetBlock.getPrevSiblingKey();

  const newBlockMap = new Map(blockMap);

  // update old parent
  transformBlock(originalParentKey, newBlockMap, block => {
    const parentChildrenList = block.getChildKeys();
    const originalBlockKeyIndex = parentChildrenList.indexOf(originalBlockKey);
    return inheritAndUpdate(block, {
      children: parentChildrenList.filter(
        (_, index) => index !== originalBlockKeyIndex,
      ),
    });
  });

  // update old prev
  transformBlock(originalPrevSiblingKey, newBlockMap, block =>
    inheritAndUpdate(block, {
      nextSibling: originalNextSiblingKey,
    }),
  );

  // update old next
  transformBlock(originalNextSiblingKey, newBlockMap, block =>
    inheritAndUpdate(block, {
      prevSibling: originalPrevSiblingKey,
    }),
  );

  // update new next
  transformBlock(newNextSiblingKey, newBlockMap, block =>
    inheritAndUpdate(block, {
      prevSibling: originalBlockKey,
    }),
  );

  // update new prev
  transformBlock(newPrevSiblingKey, newBlockMap, block =>
    inheritAndUpdate(block, {
      nextSibling: originalBlockKey,
    }),
  );

  // update new parent
  transformBlock(newParentKey, newBlockMap, block => {
    const newParentChildrenList = block.getChildKeys();
    const targetBlockIndex = newParentChildrenList.indexOf(originalTargetKey);

    const insertionIndex = isInsertedAfterTarget
      ? targetBlockIndex + 1
      : targetBlockIndex !== 0
        ? targetBlockIndex - 1
        : 0;

    const newChildrenArray = Array.from(newParentChildrenList);
    newChildrenArray.splice(insertionIndex, 0, originalBlockKey);

    return inheritAndUpdate(block, {
      children: newChildrenArray,
    });
  });

  // update block
  transformBlock(originalBlockKey, newBlockMap, block =>
    inheritAndUpdate(block, {
      nextSibling: newNextSiblingKey,
      prevSibling: newPrevSiblingKey,
      parent: newParentKey,
    }),
  );

  return newBlockMap;
};

const moveBlockInContentState = (
  contentState: ContentState,
  blockToBeMoved: BlockNodeRecord,
  targetBlock: BlockNodeRecord,
  insertionMode: DraftInsertionType,
): ContentState => {
  invariant(insertionMode !== 'replace', 'Replacing blocks is not supported.');

  const targetKey = targetBlock.getKey();
  const blockKey = blockToBeMoved.getKey();

  invariant(blockKey !== targetKey, 'Block cannot be moved next to itself.');

  const blockMap = contentState.getBlockMap();
  const isExperimentalTreeBlock = blockToBeMoved instanceof ContentBlockNode;

  let blockMapEntriesToBeMoved = [[blockToBeMoved.getKey(), blockToBeMoved]];
  let blockMapWithoutBlocksToBeMoved = new Map(blockMap);
  blockMapWithoutBlocksToBeMoved.delete(blockKey);

  if (isExperimentalTreeBlock) {
    blockMapEntriesToBeMoved = [];

    const nextSiblingKey = blockToBeMoved.getNextSiblingKey();
    const nextDelimiterBlockKey = getNextDelimiterBlockKey(
      blockToBeMoved,
      blockMapWithoutBlocksToBeMoved,
    );

    const blockMapEntries = Array.from(blockMap.entries());
    const startIndex = blockMapEntries.findIndex(
      ([_, block]) => block.getKey() === blockKey,
    );
    let done = false;
    blockMapEntries.forEach(([_, block], index) => {
      if (index < startIndex || done) {
        return;
      }

      const key = block.getKey();
      const isBlockToBeMoved = key === blockKey;
      const hasNextSiblingAndIsNotNextSibling =
        nextSiblingKey && key !== nextSiblingKey;
      const doesNotHaveNextSiblingAndIsNotDelimiter =
        !nextSiblingKey &&
        block.getParentKey() &&
        (!nextDelimiterBlockKey || key !== nextDelimiterBlockKey);

      const shouldProcess = !!(
        isBlockToBeMoved ||
        hasNextSiblingAndIsNotNextSibling ||
        doesNotHaveNextSiblingAndIsNotDelimiter
      );
      if (!shouldProcess) {
        done = true;
        return;
      }

      blockMapEntriesToBeMoved.push([key, block]);
      blockMapWithoutBlocksToBeMoved.delete(key);
    });
  }

  const blockMapEntriesBefore = [];
  const blockMapEntriesAfter = [];
  let blockMapEntriesToPushTo = blockMapEntriesBefore;
  for (const blockMapEntry of blockMapWithoutBlocksToBeMoved.entries()) {
    if (blockMapEntry[1] === targetBlock) {
      blockMapEntriesToPushTo = blockMapEntriesAfter;
      // do not push the targetBlock
    } else {
      blockMapEntriesToPushTo.push(blockMapEntry);
    }
  }

  let newBlocks;
  if (insertionMode === 'before') {
    const blockBefore = contentState.getBlockBefore(targetKey);

    invariant(
      !blockBefore || blockBefore.getKey() !== blockToBeMoved.getKey(),
      'Block cannot be moved next to itself.',
    );

    newBlocks = new Map([
      ...blockMapEntriesBefore,
      ...blockMapEntriesToBeMoved,
      [targetKey, targetBlock],
      ...blockMapEntriesAfter,
    ]);
  } else if (insertionMode === 'after') {
    const blockAfter = contentState.getBlockAfter(targetKey);

    invariant(
      !blockAfter || blockAfter.getKey() !== blockKey,
      'Block cannot be moved next to itself.',
    );

    newBlocks = new Map([
      ...blockMapEntriesBefore,
      [targetKey, targetBlock],
      ...blockMapEntriesToBeMoved,
      ...blockMapEntriesAfter,
    ]);
  } else {
    newBlocks = new Map();
  }

  return ContentState.set(contentState, {
    blockMap: updateBlockMapLinks(
      newBlocks,
      blockToBeMoved,
      targetBlock,
      insertionMode,
      isExperimentalTreeBlock,
    ),
    selectionBefore: contentState.getSelectionAfter(),
    selectionAfter: SelectionState.set(contentState.getSelectionAfter(), {
      anchorKey: blockKey,
      focusKey: blockKey,
    }),
  });
};

module.exports = moveBlockInContentState;
