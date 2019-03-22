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

import type {BlockNodeRecord} from 'BlockNodeRecord';
import type SelectionState from 'SelectionState';

const ContentState = require('ContentState');

function modifyBlockForContentState(
  contentState: ContentState,
  selectionState: SelectionState,
  operation: (block: BlockNodeRecord) => BlockNodeRecord,
): ContentState {
  const startKey = selectionState.getStartKey();
  const endKey = selectionState.getEndKey();
  const blockMap = contentState.getBlockMap();

  const blockMapUpdatedEntries = [];
  let loopState = 0;
  for (const blockMapEntry of blockMap) {
    if (loopState === 0 && blockMapEntry[0] === startKey) {
      // skipUntil done
      ++loopState;
    } else if (loopState === 1 && blockMapEntry[0] === endKey) {
      // takeUntil done
      ++loopState;
      // concat the endKey block
      blockMapUpdatedEntries.push([
        blockMapEntry[0],
        operation(blockMapEntry[1]),
      ]);
    } else if (loopState === 1) {
      // takeUntil after skipUntil
      blockMapUpdatedEntries.push([
        blockMapEntry[0],
        operation(blockMapEntry[1]),
      ]);
    }
  }

  return ContentState.set(contentState, {
    blockMap: new Map([...blockMap.entries(), ...blockMapUpdatedEntries]),
    selectionBefore: selectionState,
    selectionAfter: selectionState,
  });
}

module.exports = modifyBlockForContentState;
