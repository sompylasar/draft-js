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

const ContentState = require('ContentState');
const SelectionState = require('SelectionState');
const BlockMapBuilder = require('BlockMapBuilder');
const ContentBlockNode = require('ContentBlockNode');

const insertIntoList = require('insertIntoList');
const invariant = require('invariant');
const randomizeBlockMapKeys = require('randomizeBlockMapKeys');
const inheritAndUpdate = require('inheritAndUpdate');

const updateExistingBlock = (
  contentState: ContentState,
  selectionState: SelectionState,
  blockMap: BlockMap,
  fragmentBlock: BlockNodeRecord,
  targetKey: string,
  targetOffset: number,
): ContentState => {
  const targetBlock = blockMap.get(targetKey);
  const text = targetBlock.getText();
  const chars = targetBlock.getCharacterList();
  const finalKey = targetKey;
  const finalOffset = targetOffset + fragmentBlock.getText().length;

  const newBlock = inheritAndUpdate(targetBlock, {
    text:
      text.slice(0, targetOffset) +
      fragmentBlock.getText() +
      text.slice(targetOffset),
    characterList: insertIntoList(
      chars,
      fragmentBlock.getCharacterList(),
      targetOffset,
    ),
    data: fragmentBlock.getData(),
  });

  const newBlockMap = new Map(blockMap);
  newBlockMap.set(targetKey, newBlock);

  return ContentState.set(contentState, {
    blockMap: newBlockMap,
    selectionBefore: selectionState,
    selectionAfter: SelectionState.set(selectionState, {
      anchorKey: finalKey,
      anchorOffset: finalOffset,
      focusKey: finalKey,
      focusOffset: finalOffset,
      isBackward: false,
    }),
  });
};

/**
 * Appends text/characterList from the fragment first block to
 * target block.
 */
const updateHead = (
  block: BlockNodeRecord,
  targetOffset: number,
  fragment: BlockMap,
): BlockNodeRecord => {
  const text = block.getText();
  const chars = block.getCharacterList();

  // Modify head portion of block.
  const headText = text.slice(0, targetOffset);
  const headCharacters = chars.slice(0, targetOffset);
  const appendToHead = fragment.values().next().value;

  return inheritAndUpdate(block, {
    text: headText + appendToHead.getText(),
    characterList: headCharacters.concat(appendToHead.getCharacterList()),
    type: headText ? block.getType() : appendToHead.getType(),
    data: appendToHead.getData(),
  });
};

/**
 * Appends offset text/characterList from the target block to the last
 * fragment block.
 */
const updateTail = (
  block: BlockNodeRecord,
  targetOffset: number,
  fragment: BlockMap,
): BlockNodeRecord => {
  // Modify tail portion of block.
  const text = block.getText();
  const chars = block.getCharacterList();

  // Modify head portion of block.
  const blockSize = text.length;
  const tailText = text.slice(targetOffset, blockSize);
  const tailCharacters = chars.slice(targetOffset, blockSize);
  const fragmentBlocks = Array.from(fragment.values());
  const prependToTail = fragmentBlocks[fragmentBlocks.length - 1];

  return inheritAndUpdate(prependToTail, {
    text: prependToTail.getText() + tailText,
    characterList: prependToTail.getCharacterList().concat(tailCharacters),
    data: prependToTail.getData(),
  });
};

const getRootBlocks = (
  block: ContentBlockNode,
  blockMap: BlockMap,
): Array<string> => {
  const headKey = block.getKey();
  let rootBlock = block;
  const rootBlocks = [];

  // sometimes the fragment head block will not be part of the blockMap itself this can happen when
  // the fragment head is used to update the target block, however when this does not happen we need
  // to make sure that we include it on the rootBlocks since the first block of a fragment is always a
  // fragment root block
  if (blockMap.get(headKey)) {
    rootBlocks.push(headKey);
  }

  while (rootBlock && rootBlock.getNextSiblingKey()) {
    const lastSiblingKey = rootBlock.getNextSiblingKey();

    if (!lastSiblingKey) {
      break;
    }

    rootBlocks.push(lastSiblingKey);
    rootBlock = blockMap.get(lastSiblingKey);
  }

  return rootBlocks;
};

const updateBlockMapLinks = (
  blockMap: BlockMap,
  originalBlockMap: BlockMap,
  targetBlock: ContentBlockNode,
  fragmentHeadBlock: ContentBlockNode,
): BlockMap => {
  return blockMap.withMutations(blockMapState => {
    const targetKey = targetBlock.getKey();
    const headKey = fragmentHeadBlock.getKey();
    const targetNextKey = targetBlock.getNextSiblingKey();
    const targetParentKey = targetBlock.getParentKey();
    const fragmentRootBlocks = getRootBlocks(fragmentHeadBlock, blockMap);
    const lastRootFragmentBlockKey =
      fragmentRootBlocks[fragmentRootBlocks.length - 1];

    if (blockMapState.get(headKey)) {
      // update the fragment head when it is part of the blockMap otherwise
      blockMapState.setIn([targetKey, 'nextSibling'], headKey);
      blockMapState.setIn([headKey, 'prevSibling'], targetKey);
    } else {
      // update the target block that had the fragment head contents merged into it
      blockMapState.setIn(
        [targetKey, 'nextSibling'],
        fragmentHeadBlock.getNextSiblingKey(),
      );
      blockMapState.setIn(
        [fragmentHeadBlock.getNextSiblingKey(), 'prevSibling'],
        targetKey,
      );
    }

    // update the last root block fragment
    blockMapState.setIn(
      [lastRootFragmentBlockKey, 'nextSibling'],
      targetNextKey,
    );

    // update the original target next block
    if (targetNextKey) {
      blockMapState.setIn(
        [targetNextKey, 'prevSibling'],
        lastRootFragmentBlockKey,
      );
    }

    // update fragment parent links
    fragmentRootBlocks.forEach(blockKey => {
      blockMapState.setIn([blockKey, 'parent'], targetParentKey);
    });

    // update targetBlock parent child links
    if (targetParentKey) {
      const targetParent = blockMap.get(targetParentKey);
      const originalTargetParentChildKeys = targetParent.getChildKeys();

      const targetBlockIndex = originalTargetParentChildKeys.indexOf(targetKey);
      const insertionIndex = targetBlockIndex + 1;

      const newChildrenKeysArray = Array.from(originalTargetParentChildKeys);

      // insert fragment children
      newChildrenKeysArray.splice(insertionIndex, 0, ...fragmentRootBlocks);

      blockMapState.setIn([targetParentKey, 'children'], newChildrenKeysArray);
    }
  });
};

const insertFragment = (
  contentState: ContentState,
  selectionState: SelectionState,
  blockMap: BlockMap,
  fragment: BlockMap,
  targetKey: string,
  targetOffset: number,
): ContentState => {
  const isTreeBasedBlockMap = blockMap.first() instanceof ContentBlockNode;
  const newBlockArr = [];
  const fragmentSize = fragment.size;
  const target = blockMap.get(targetKey);
  const head = fragment.first();
  const tail = fragment.last();
  const finalOffset = tail.getLength();
  const finalKey = tail.getKey();
  const shouldNotUpdateFromFragmentBlock =
    isTreeBasedBlockMap &&
    (target.getChildKeys().length > 0 || head.getChildKeys().length > 0);

  blockMap.forEach((block, blockKey) => {
    if (blockKey !== targetKey) {
      newBlockArr.push(block);
      return;
    }

    if (shouldNotUpdateFromFragmentBlock) {
      newBlockArr.push(block);
    } else {
      newBlockArr.push(updateHead(block, targetOffset, fragment));
    }

    // Insert fragment blocks after the head and before the tail.
    fragment
      // when we are updating the target block with the head fragment block we skip the first fragment
      // head since its contents have already been merged with the target block otherwise we include
      // the whole fragment
      .slice(shouldNotUpdateFromFragmentBlock ? 0 : 1, fragmentSize - 1)
      .forEach(fragmentBlock => newBlockArr.push(fragmentBlock));

    // update tail
    newBlockArr.push(updateTail(block, targetOffset, fragment));
  });

  let updatedBlockMap = BlockMapBuilder.createFromArray(newBlockArr);

  if (isTreeBasedBlockMap) {
    updatedBlockMap = updateBlockMapLinks(
      updatedBlockMap,
      blockMap,
      target,
      head,
    );
  }

  return ContentState.set(contentState, {
    blockMap: updatedBlockMap,
    selectionBefore: selectionState,
    selectionAfter: SelectionState.set(selectionState, {
      anchorKey: finalKey,
      anchorOffset: finalOffset,
      focusKey: finalKey,
      focusOffset: finalOffset,
      isBackward: false,
    }),
  });
};

const insertFragmentIntoContentState = (
  contentState: ContentState,
  selectionState: SelectionState,
  fragmentBlockMap: BlockMap,
): ContentState => {
  invariant(
    selectionState.isCollapsed(),
    '`insertFragment` should only be called with a collapsed selection state.',
  );

  const blockMap = contentState.getBlockMap();
  const fragment = randomizeBlockMapKeys(fragmentBlockMap);
  const targetKey = selectionState.getStartKey();
  const targetOffset = selectionState.getStartOffset();

  const targetBlock = blockMap.get(targetKey);

  if (targetBlock instanceof ContentBlockNode) {
    invariant(
      targetBlock.getChildKeys().length <= 0,
      '`insertFragment` should not be called when a container node is selected.',
    );
  }

  // When we insert a fragment with a single block we simply update the target block
  // with the contents of the inserted fragment block
  if (fragment.size === 1) {
    return updateExistingBlock(
      contentState,
      selectionState,
      blockMap,
      fragment.first(),
      targetKey,
      targetOffset,
    );
  }

  return insertFragment(
    contentState,
    selectionState,
    blockMap,
    fragment,
    targetKey,
    targetOffset,
  );
};

module.exports = insertFragmentIntoContentState;
