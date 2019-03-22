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

const insertIntoList = require('insertIntoList');
const inheritAndUpdate = require('inheritAndUpdate');
const invariant = require('invariant');

import type CharacterMetadata from 'CharacterMetadata';
import type ContentState from 'ContentState';
import type SelectionState from 'SelectionState';

function insertTextIntoContentState(
  contentState: ContentState,
  selectionState: SelectionState,
  text: string,
  characterMetadata: CharacterMetadata,
): ContentState {
  invariant(
    selectionState.isCollapsed(),
    '`insertText` should only be called with a collapsed range.',
  );

  const len = text.length;
  if (!len) {
    return contentState;
  }

  const blockMap = contentState.getBlockMap();
  const key = selectionState.getStartKey();
  const offset = selectionState.getStartOffset();
  const block = blockMap.get(key);
  const blockText = block.getText();

  const newBlock = inheritAndUpdate(block, {
    text:
      blockText.slice(0, offset) +
      text +
      blockText.slice(offset, block.getLength()),
    characterList: insertIntoList(
      block.getCharacterList(),
      Array(len).fill(characterMetadata),
      offset,
    ),
  });

  const newOffset = offset + len;

  const newBlockMap = new Map(blockMap);
  newBlockMap.set(key, newBlock);

  return ContentState.set(contentState, {
    blockMap: newBlockMap,
    selectionAfter: SelectionState.set(selectionState, {
      anchorOffset: newOffset,
      focusOffset: newOffset,
    }),
  });
}

module.exports = insertTextIntoContentState;
