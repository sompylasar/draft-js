/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @flow strict-local
 * @emails oncall+draft_js
 */

'use strict';

import type SelectionState from 'SelectionState';

const ContentState = require('ContentState');
const applyEntityToContentBlock = require('applyEntityToContentBlock');

function applyEntityToContentState(
  contentState: ContentState,
  selectionState: SelectionState,
  entityKey: ?string,
): ContentState {
  const blockMap = contentState.getBlockMap();
  const startKey = selectionState.getStartKey();
  const startOffset = selectionState.getStartOffset();
  const endKey = selectionState.getEndKey();
  const endOffset = selectionState.getEndOffset();

  const newBlockEntries = [];
  let loopState = 0;
  for (const [key, block] of blockMap) {
    if (loopState === 0 && key === startKey) {
      ++loopState;
    }
    if (loopState === 1) {
      const sliceStart = key === startKey ? startOffset : 0;
      const sliceEnd = key === endKey ? endOffset : block.getLength();
      newBlockEntries.push(
        applyEntityToContentBlock(block, sliceStart, sliceEnd, entityKey),
      );
      if (key === endKey) {
        break;
      }
    }
  }

  return ContentState.set(contentState, {
    blockMap: new Map([...blockMap.entries(), ...newBlockEntries]),
    selectionBefore: selectionState,
    selectionAfter: selectionState,
  });
}

module.exports = applyEntityToContentState;
