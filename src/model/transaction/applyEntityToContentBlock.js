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

import type {BlockNodeRecord} from 'BlockNodeRecord';

const CharacterMetadata = require('CharacterMetadata');
const inheritAndUpdate = require('inheritAndUpdate');

function applyEntityToContentBlock(
  contentBlock: BlockNodeRecord,
  start: number,
  end: number,
  entityKey: ?string,
): BlockNodeRecord {
  let characterList = Array.from(contentBlock.getCharacterList());
  while (start < end) {
    characterList[start] = CharacterMetadata.applyEntity(
      characterList[start],
      entityKey,
    );
    start++;
  }
  return inheritAndUpdate(contentBlock, {
    characterList: characterList,
  });
}

module.exports = applyEntityToContentBlock;
