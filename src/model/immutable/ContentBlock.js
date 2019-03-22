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

import type {BlockNode, BlockNodeConfig, BlockNodeKey} from 'BlockNode';
import type {DraftBlockType} from 'DraftBlockType';
import type {DraftInlineStyle} from 'DraftInlineStyle';

const {EMPTY_STYLE} = require('DraftInlineStyle');
const CharacterMetadata = require('CharacterMetadata');

const findRangesImmutable = require('findRangesImmutable');
const inheritAndUpdate = require('inheritAndUpdate');

type ContentBlockConfig = BlockNodeConfig;

const decorateCharacterList = (
  config?: ContentBlockConfig,
): ?ContentBlockConfig => {
  if (!config) {
    return config;
  }

  const {characterList, text} = config;

  if (text && !characterList) {
    return {
      ...config,
      characterList: Array(text.length).fill(CharacterMetadata.EMPTY),
    };
  }

  return config;
};

class ContentBlock implements BlockNode {
  characterList: $ReadOnlyArray<CharacterMetadata> = [];
  data: $ReadOnlyMap<any, any> = new Map();
  depth: number = 0;
  key: BlockNodeKey = '';
  text: string = '';
  type: DraftBlockType = 'unstyled';

  constructor(config?: ContentBlockConfig) {
    Object.assign(this, decorateCharacterList(config));
  }

  getKey(): BlockNodeKey {
    return this.key;
  }

  getType(): DraftBlockType {
    return this.type;
  }

  getText(): string {
    return this.text;
  }

  getCharacterList(): $ReadOnlyArray<CharacterMetadata> {
    return this.characterList;
  }

  getLength(): number {
    return this.getText().length;
  }

  getDepth(): number {
    return this.depth;
  }

  getData(): $ReadOnlyMap<any, any> {
    return this.data;
  }

  getInlineStyleAt(offset: number): DraftInlineStyle {
    const character = this.getCharacterList()[offset];
    return character ? character.getStyle() : EMPTY_STYLE;
  }

  getEntityAt(offset: number): ?string {
    const character = this.getCharacterList()[offset];
    return character ? character.getEntity() : null;
  }

  /**
   * Execute a callback for every contiguous range of styles within the block.
   */
  findStyleRanges(
    filterFn: (value: CharacterMetadata) => boolean,
    callback: (start: number, end: number) => void,
  ): void {
    findRangesImmutable(
      this.getCharacterList(),
      haveEqualStyle,
      filterFn,
      callback,
    );
  }

  /**
   * Execute a callback for every contiguous range of entities within the block.
   */
  findEntityRanges(
    filterFn: (value: CharacterMetadata) => boolean,
    callback: (start: number, end: number) => void,
  ): void {
    findRangesImmutable(
      this.getCharacterList(),
      haveEqualEntity,
      filterFn,
      callback,
    );
  }

  static set(block: ContentBlock, put: ContentBlockConfig): ContentBlock {
    return inheritAndUpdate(block, put);
  }
}

function haveEqualStyle(
  charA: CharacterMetadata,
  charB: CharacterMetadata,
): boolean {
  return charA.getStyle() === charB.getStyle();
}

function haveEqualEntity(
  charA: CharacterMetadata,
  charB: CharacterMetadata,
): boolean {
  return charA.getEntity() === charB.getEntity();
}

module.exports = ContentBlock;
