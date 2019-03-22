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
import type CharacterMetadata from 'CharacterMetadata';

const ContentBlockNode = require('ContentBlockNode');
const ContentState = require('ContentState');
const SelectionState = require('SelectionState');

const getNextDelimiterBlockKey = require('getNextDelimiterBlockKey');
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

/**
 * Ancestors needs to be preserved when there are non selected
 * children to make sure we do not leave any orphans behind
 */
const getAncestorsKeys = (
  blockKey: ?string,
  blockMap: BlockMap,
): Array<string> => {
  const parents = [];

  if (!blockKey) {
    return parents;
  }

  let blockNode = blockMap.get(blockKey);
  while (
    blockNode &&
    blockNode instanceof ContentBlockNode &&
    blockNode.getParentKey()
  ) {
    const parentKey = blockNode.getParentKey();
    if (parentKey) {
      parents.push(parentKey);
    }
    blockNode = parentKey ? blockMap.get(parentKey) : null;
  }

  return parents;
};

/**
 * Get all next delimiter keys until we hit a root delimiter and return
 * an array of key references
 */
const getNextDelimitersBlockKeys = (
  block: BlockNodeRecord,
  blockMap: BlockMap,
): Array<string> => {
  const nextDelimiters = [];

  if (!block) {
    return nextDelimiters;
  }

  let nextDelimiter = getNextDelimiterBlockKey(block, blockMap);
  while (nextDelimiter) {
    const block = blockMap.get(nextDelimiter);
    if (!block) {
      break;
    }

    nextDelimiters.push(nextDelimiter);

    // we do not need to keep checking all root node siblings, just the first occurance
    nextDelimiter =
      !(block instanceof ContentBlockNode) || block.getParentKey()
        ? getNextDelimiterBlockKey(block, blockMap)
        : null;
  }

  return nextDelimiters;
};

const getNextValidSibling = (
  block: ?ContentBlockNode,
  blockMap: BlockMap,
  originalBlockMap: BlockMap,
): ?string => {
  if (!block) {
    return null;
  }

  // note that we need to make sure we refer to the original block since this
  // function is called within a withMutations
  const originalBlock = originalBlockMap.get(block.getKey());
  if (!originalBlock || !(originalBlock instanceof ContentBlockNode)) {
    return null;
  }

  let nextValidSiblingKey = originalBlock.getNextSiblingKey();

  while (nextValidSiblingKey && !blockMap.get(nextValidSiblingKey)) {
    const nextBlock = originalBlockMap.get(nextValidSiblingKey);
    if (!nextBlock || !(nextBlock instanceof ContentBlockNode)) {
      break;
    }
    nextValidSiblingKey = nextBlock.getNextSiblingKey() || null;
  }

  return nextValidSiblingKey;
};

const getPrevValidSibling = (
  block: ?ContentBlockNode,
  blockMap: BlockMap,
  originalBlockMap: BlockMap,
): ?string => {
  if (!block) {
    return null;
  }

  // note that we need to make sure we refer to the original block since this
  // function is called within a withMutations
  const originalBlock = originalBlockMap.get(block.getKey());
  if (!originalBlock || !(originalBlock instanceof ContentBlockNode)) {
    return null;
  }
  let prevValidSiblingKey = originalBlock.getPrevSiblingKey();

  while (prevValidSiblingKey && !blockMap.get(prevValidSiblingKey)) {
    const prevBlock = originalBlockMap.get(prevValidSiblingKey);
    if (!prevBlock || !(prevBlock instanceof ContentBlockNode)) {
      break;
    }
    prevValidSiblingKey = prevBlock.getPrevSiblingKey() || null;
  }

  return prevValidSiblingKey;
};

const updateBlockMapLinks = (
  blockMap: BlockMap,
  startBlock: ContentBlockNode,
  endBlock: ContentBlockNode,
  originalBlockMap: BlockMap,
): BlockMap => {
  const newBlockMap = new Map(blockMap);

  // update start block if its retained
  transformBlock(startBlock.getKey(), newBlockMap, block => {
    return inheritAndUpdate(block, {
      nextSibling: getNextValidSibling(
        block,
        ((newBlockMap: any): BlockMap),
        originalBlockMap,
      ),
      prevSibling: getPrevValidSibling(block, newBlockMap, originalBlockMap),
    });
  });

  // update endblock if its retained
  transformBlock(endBlock.getKey(), newBlockMap, block => {
    return inheritAndUpdate(block, {
      nextSibling: getNextValidSibling(block, newBlockMap, originalBlockMap),
      prevSibling: getPrevValidSibling(block, newBlockMap, originalBlockMap),
    });
  });

  // update start block parent ancestors
  getAncestorsKeys(startBlock.getKey(), originalBlockMap).forEach(parentKey => {
    transformBlock(parentKey, newBlockMap, block => {
      return inheritAndUpdate(block, {
        children: block.getChildKeys().filter(key => newBlockMap.get(key)),
        nextSibling: getNextValidSibling(block, newBlockMap, originalBlockMap),
        prevSibling: getPrevValidSibling(block, newBlockMap, originalBlockMap),
      });
    });
  });

  // update start block next - can only happen if startBlock == endBlock
  transformBlock(startBlock.getNextSiblingKey(), newBlockMap, block => {
    return inheritAndUpdate(block, {
      prevSibling: startBlock.getPrevSiblingKey(),
    });
  });

  // update start block prev
  transformBlock(startBlock.getPrevSiblingKey(), newBlockMap, block => {
    return inheritAndUpdate(block, {
      nextSibling: getNextValidSibling(block, newBlockMap, originalBlockMap),
    });
  });

  // update end block next
  transformBlock(endBlock.getNextSiblingKey(), newBlockMap, block => {
    return inheritAndUpdate(block, {
      prevSibling: getPrevValidSibling(block, newBlockMap, originalBlockMap),
    });
  });

  // update end block prev
  transformBlock(endBlock.getPrevSiblingKey(), newBlockMap, block => {
    return inheritAndUpdate(block, {
      nextSibling: endBlock.getNextSiblingKey(),
    });
  });

  // update end block parent ancestors
  getAncestorsKeys(endBlock.getKey(), originalBlockMap).forEach(parentKey => {
    transformBlock(parentKey, newBlockMap, block =>
      inheritAndUpdate(block, {
        children: block.getChildKeys().filter(key => newBlockMap.get(key)),
        nextSibling: getNextValidSibling(block, newBlockMap, originalBlockMap),
        prevSibling: getPrevValidSibling(block, newBlockMap, originalBlockMap),
      }),
    );
  });

  // update next delimiters all the way to a root delimiter
  getNextDelimitersBlockKeys(endBlock, originalBlockMap).forEach(
    delimiterKey => {
      transformBlock(delimiterKey, newBlockMap, block => {
        return inheritAndUpdate(block, {
          nextSibling: getNextValidSibling(
            block,
            newBlockMap,
            originalBlockMap,
          ),
          prevSibling: getPrevValidSibling(
            block,
            newBlockMap,
            originalBlockMap,
          ),
        });
      });
    },
  );

  // if parent (startBlock) was deleted
  if (
    blockMap.get(startBlock.getKey()) == null &&
    blockMap.get(endBlock.getKey()) != null &&
    endBlock.getParentKey() === startBlock.getKey() &&
    endBlock.getPrevSiblingKey() == null
  ) {
    const prevSiblingKey = startBlock.getPrevSiblingKey();
    // endBlock becomes next sibling of parent's prevSibling
    transformBlock(endBlock.getKey(), newBlockMap, block => {
      return inheritAndUpdate(block, {
        prevSibling: prevSiblingKey,
      });
    });
    transformBlock(prevSiblingKey, newBlockMap, block => {
      return inheritAndUpdate(block, {
        nextSibling: endBlock.getKey(),
      });
    });

    // Update parent for previous parent's children, and children for that parent
    const prevSibling = prevSiblingKey ? blockMap.get(prevSiblingKey) : null;
    const newParentKey = prevSibling ? prevSibling.getParentKey() : null;
    startBlock.getChildKeys().forEach(childKey => {
      transformBlock(childKey, newBlockMap, block => {
        return inheritAndUpdate(block, {
          parent: newParentKey, // set to null if there is no parent
        });
      });
    });
    if (newParentKey != null) {
      const newParent = blockMap.get(newParentKey);
      transformBlock(newParentKey, newBlockMap, block => {
        return inheritAndUpdate(block, {
          children: newParent.getChildKeys().concat(startBlock.getChildKeys()),
        });
      });
    }

    // last child of deleted parent should point to next sibling
    transformBlock(
      startBlock.getChildKeys().find(key => {
        const block = blockMap.get(key);
        return block
          ? ((block: any): ContentBlockNode).getNextSiblingKey() === null
          : false;
      }),
      newBlockMap,
      block => {
        return inheritAndUpdate(block, {
          nextSibling: startBlock.getNextSiblingKey(),
        });
      },
    );
  }

  return newBlockMap;
};

const removeRangeFromContentState = (
  contentState: ContentState,
  selectionState: SelectionState,
): ContentState => {
  if (selectionState.isCollapsed()) {
    return contentState;
  }

  const blockMap = contentState.getBlockMap();
  const startKey = selectionState.getStartKey();
  const startOffset = selectionState.getStartOffset();
  const endKey = selectionState.getEndKey();
  const endOffset = selectionState.getEndOffset();

  const startBlock = blockMap.get(startKey);
  const endBlock = blockMap.get(endKey);

  // we assume that ContentBlockNode and ContentBlocks are not mixed together
  const isExperimentalTreeBlock = startBlock instanceof ContentBlockNode;

  // used to retain blocks that should not be deleted to avoid orphan children
  let parentAncestors = [];

  if (isExperimentalTreeBlock) {
    const endBlockchildrenKeys = endBlock.getChildKeys();
    const endBlockAncestors = getAncestorsKeys(endKey, blockMap);

    // endBlock has unselected siblings so we can not remove its ancestors parents
    if (endBlock.getNextSiblingKey()) {
      parentAncestors = parentAncestors.concat(endBlockAncestors);
    }

    // endBlock has children so can not remove this block or any of its ancestors
    if (!endBlockchildrenKeys.isEmpty()) {
      parentAncestors = parentAncestors.concat(
        endBlockAncestors.concat([endKey]),
      );
    }

    // we need to retain all ancestors of the next delimiter block
    parentAncestors = parentAncestors.concat(
      getAncestorsKeys(getNextDelimiterBlockKey(endBlock, blockMap), blockMap),
    );
  }

  let characterList;

  if (startBlock === endBlock) {
    characterList = removeFromList(
      startBlock.getCharacterList(),
      startOffset,
      endOffset,
    );
  } else {
    characterList = startBlock
      .getCharacterList()
      .slice(0, startOffset)
      .concat(endBlock.getCharacterList().slice(endOffset));
  }

  const modifiedStart = inheritAndUpdate(startBlock, {
    text:
      startBlock.getText().slice(0, startOffset) +
      endBlock.getText().slice(endOffset),
    characterList,
  });

  // If cursor (collapsed) is at the start of the first child, delete parent
  // instead of child
  const shouldDeleteParent =
    isExperimentalTreeBlock &&
    startOffset === 0 &&
    endOffset === 0 &&
    endBlock.getParentKey() === startKey &&
    endBlock.getPrevSiblingKey() == null;

  let blockMapUpdatedEntries;
  if (shouldDeleteParent) {
    blockMapUpdatedEntries = [[startKey, null]];
  } else {
    blockMapUpdatedEntries = [];
    let loopState = 0;
    for (const blockMapEntry of blockMap) {
      if (loopState === 0 && blockMapEntry[0] === startKey) {
        // skipUntil done
        ++loopState;
      } else if (loopState === 1 && blockMapEntry[0] === endKey) {
        // takeUntil done
        ++loopState;
        // concat the endKey block
        blockMapUpdatedEntries.push([blockMapEntry[0], null]);
      } else if (loopState === 1) {
        // takeUntil after skipUntil, filter
        if (parentAncestors.indexOf(blockMapEntry[0]) === -1) {
          blockMapUpdatedEntries.push(blockMapEntry);
        }
      }
    }
    blockMapUpdatedEntries = blockMapUpdatedEntries.map(
      ([k, _]) => (k === startKey ? modifiedStart : null),
    );
  }
  let updatedBlockMap = new Map(
    [...blockMap.entries(), ...blockMapUpdatedEntries].filter(
      ([_, block]) => !!block,
    ),
  );

  // Only update tree block pointers if the range is across blocks
  if (isExperimentalTreeBlock && startBlock !== endBlock) {
    updatedBlockMap = updateBlockMapLinks(
      updatedBlockMap,
      startBlock,
      endBlock,
      blockMap,
    );
  }

  return ContentState.set(contentState, {
    blockMap: updatedBlockMap,
    selectionBefore: selectionState,
    selectionAfter: SelectionState.set(selectionState, {
      anchorKey: startKey,
      anchorOffset: startOffset,
      focusKey: startKey,
      focusOffset: startOffset,
      isBackward: false,
    }),
  });
};

/**
 * Maintain persistence for target list when removing characters on the
 * head and tail of the character list.
 */
const removeFromList = (
  targetList: List<CharacterMetadata>,
  startOffset: number,
  endOffset: number,
): List<CharacterMetadata> => {
  if (startOffset === 0) {
    while (startOffset < endOffset) {
      targetList = targetList.shift();
      startOffset++;
    }
  } else if (endOffset === targetList.count()) {
    while (endOffset > startOffset) {
      targetList = targetList.pop();
      endOffset--;
    }
  } else {
    const head = targetList.slice(0, startOffset);
    const tail = targetList.slice(endOffset);
    targetList = head.concat(tail).toList();
  }
  return targetList;
};

module.exports = removeRangeFromContentState;
