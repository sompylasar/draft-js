/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @flow
 * @emails oncall+draft_js
 *
 * This file is a fork of ContentBlock adding support for nesting references by
 * providing links to children, parent, prevSibling, and nextSibling.
 *
 * This is unstable and not part of the public API and should not be used by
 * production systems. This file may be update/removed without notice.
 */

'use strict';

import type {BlockNode, BlockNodeConfig, BlockNodeKey} from 'BlockNode';
import type {DraftBlockType} from 'DraftBlockType';
import type {DraftInlineStyle} from 'DraftInlineStyle';

const {EMPTY_STYLE} = require('DraftInlineStyle');
const CharacterMetadata = require('CharacterMetadata');

const findRangesImmutable = require('findRangesImmutable');
const inheritAndUpdate = require('inheritAndUpdate');

type ContentBlockNodeConfig = BlockNodeConfig & {
  // `$Shape` without the spread does not error on missing properties. https://github.com/facebook/flow/issues/5702
  ...$Shape<{
    children: $ReadOnlyArray<BlockNodeKey>,
    parent: ?BlockNodeKey,
    prevSibling: ?BlockNodeKey,
    nextSibling: ?BlockNodeKey,
  }>,
};

const haveEqualStyle = (
  charA: CharacterMetadata,
  charB: CharacterMetadata,
): boolean => charA.getStyle() === charB.getStyle();

const haveEqualEntity = (
  charA: CharacterMetadata,
  charB: CharacterMetadata,
): boolean => charA.getEntity() === charB.getEntity();

const decorateCharacterList = (
  config?: ContentBlockNodeConfig,
): ?ContentBlockNodeConfig => {
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

class ContentBlockNode implements BlockNode {
  characterList: $ReadOnlyArray<CharacterMetadata> = [];
  data: $ReadOnlyMap<any, any> = ((new Map(): any): $ReadOnlyMap<any, any>);
  depth: number = 0;
  key: BlockNodeKey = '';
  text: string = '';
  type: DraftBlockType = 'unstyled';
  children: $ReadOnlyArray<BlockNodeKey> = [];
  parent: ?BlockNodeKey = null;
  prevSibling: ?BlockNodeKey = null;
  nextSibling: ?BlockNodeKey = null;

  constructor(config?: ContentBlockNodeConfig) {
    Object.assign(this, config ? decorateCharacterList(config) : undefined);
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

  getChildKeys(): $ReadOnlyArray<BlockNodeKey> {
    return this.children;
  }

  getParentKey(): ?BlockNodeKey {
    return this.parent;
  }

  getPrevSiblingKey(): ?BlockNodeKey {
    return this.prevSibling;
  }

  getNextSiblingKey(): ?BlockNodeKey {
    return this.nextSibling;
  }

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

  static set(
    block: ContentBlockNode,
    put: ContentBlockNodeConfig,
  ): ContentBlockNode {
    return inheritAndUpdate(block, put);
  }
}

module.exports = ContentBlockNode;
