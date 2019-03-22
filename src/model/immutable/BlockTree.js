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
import type CharacterMetadata from 'CharacterMetadata';
import type ContentState from 'ContentState';
import type {DraftDecoratorType} from 'DraftDecoratorType';

const emptyFunction = require('emptyFunction');
const findRangesImmutable = require('findRangesImmutable');

const returnTrue = (emptyFunction.thatReturnsTrue: (
  ...args: Array<any>
) => true);

export type LeafRange = {
  start: number,
  end: number,
};

export type DecoratorRange = {
  start: number,
  end: number,
  decoratorKey: ?string,
  leaves: $ReadOnlyArray<LeafRange>,
};

const BlockTree = {
  /**
   * Generate a block tree for a given ContentBlock/decorator pair.
   */
  generate: function(
    contentState: ContentState,
    block: BlockNodeRecord,
    decorator: ?DraftDecoratorType,
  ): Array<DecoratorRange> {
    const textLength = block.getLength();
    if (!textLength) {
      return [
        {
          start: 0,
          end: 0,
          decoratorKey: null,
          leaves: [{start: 0, end: 0}],
        },
      ];
    }

    const leafSets = [];
    const decorations = decorator
      ? decorator.getDecorations(block, contentState)
      : Array(textLength).fill(null);

    const chars = block.getCharacterList();

    findRangesImmutable(decorations, areEqual, returnTrue, (start, end) => {
      leafSets.push({
        start,
        end,
        decoratorKey: decorations[start],
        leaves: generateLeaves(chars.slice(start, end), start),
      });
    });

    return leafSets;
  },
};

/**
 * Generate LeafRange records for a given character list.
 */
function generateLeaves(
  characters: $ReadOnlyArray<CharacterMetadata>,
  offset: number,
): $ReadOnlyArray<LeafRange> {
  const leaves = [];
  const inlineStyles = characters.map(c => c.getStyle());
  findRangesImmutable(inlineStyles, areEqual, returnTrue, (start, end) => {
    leaves.push({
      start: start + offset,
      end: end + offset,
    });
  });
  return leaves;
}

function areEqual(a: any, b: any): boolean {
  return a === b;
}

module.exports = BlockTree;
