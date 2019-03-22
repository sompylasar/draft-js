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

import type ContentState from 'ContentState';
import type SelectionState from 'SelectionState';

const CharacterMetadata = require('CharacterMetadata');
const modifyBlockForContentState = require('modifyBlockForContentState');
const inheritAndUpdate = require('inheritAndUpdate');

const ContentStateInlineStyle = {
  add: function(
    contentState: ContentState,
    selectionState: SelectionState,
    inlineStyle: string,
  ): ContentState {
    return modifyInlineStyle(contentState, selectionState, inlineStyle, true);
  },

  remove: function(
    contentState: ContentState,
    selectionState: SelectionState,
    inlineStyle: string,
  ): ContentState {
    return modifyInlineStyle(contentState, selectionState, inlineStyle, false);
  },
};

function modifyInlineStyle(
  contentState: ContentState,
  selectionState: SelectionState,
  inlineStyle: string,
  addOrRemove: boolean,
): ContentState {
  const startKey = selectionState.getStartKey();
  const startOffset = selectionState.getStartOffset();
  const endKey = selectionState.getEndKey();
  const endOffset = selectionState.getEndOffset();

  return modifyBlockForContentState(
    contentState,
    selectionState,
    (block, blockKey) => {
      let sliceStart;
      let sliceEnd;

      if (startKey === endKey) {
        sliceStart = startOffset;
        sliceEnd = endOffset;
      } else {
        sliceStart = blockKey === startKey ? startOffset : 0;
        sliceEnd = blockKey === endKey ? endOffset : block.getLength();
      }

      let chars = [...block.getCharacterList()];
      let current;
      while (sliceStart < sliceEnd) {
        current = chars[sliceStart];
        chars[sliceStart] = addOrRemove
          ? CharacterMetadata.applyStyle(current, inlineStyle)
          : CharacterMetadata.removeStyle(current, inlineStyle);
        sliceStart++;
      }

      return inheritAndUpdate(block, {characterList: chars});
    },
  );
}

module.exports = ContentStateInlineStyle;
