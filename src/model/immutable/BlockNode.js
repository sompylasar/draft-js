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

import type CharacterMetadata from 'CharacterMetadata';
import type {DraftBlockType} from 'DraftBlockType';
import type {DraftInlineStyle} from 'DraftInlineStyle';

export type BlockNodeKey = string;

export type BlockNodeConfig = {
  // `$Shape` without the spread does not error on missing properties. https://github.com/facebook/flow/issues/5702
  ...$Shape<{
    characterList: $ReadOnlyArray<CharacterMetadata>,
    data: $ReadOnlyMap<any, any>,
    depth: number,
    key: BlockNodeKey,
    text: string,
    type: DraftBlockType,
  }>,
};

// https://github.com/facebook/draft-js/issues/1492
// prettier-ignore
export interface BlockNode {
  +findEntityRanges: (
    filterFn: (value: CharacterMetadata) => boolean,
    callback: (start: number, end: number) => void,
  ) => void,

  +findStyleRanges: (
    filterFn: (value: CharacterMetadata) => boolean,
    callback: (start: number, end: number) => void,
  ) => void,

  +getCharacterList: () => $ReadOnlyArray<CharacterMetadata>,

  +getData: () => $ReadOnlyMap<any, any>,

  +getDepth: () => number,

  +getEntityAt: (offset: number) => ?string,

  +getInlineStyleAt: (offset: number) => DraftInlineStyle,

  +getKey: () => BlockNodeKey,

  +getLength: () => number,

  +getText: () => string,

  +getType: () => DraftBlockType,
}
