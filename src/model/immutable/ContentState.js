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
import type DraftEntityInstance from 'DraftEntityInstance';
import type {DraftEntityMutability} from 'DraftEntityMutability';
import type {DraftEntityType} from 'DraftEntityType';
import type {EntityMap} from 'EntityMap';

const BlockMapBuilder = require('BlockMapBuilder');
const CharacterMetadata = require('CharacterMetadata');
const ContentBlock = require('ContentBlock');
const ContentBlockNode = require('ContentBlockNode');
const DraftEntity = require('DraftEntity');
const SelectionState = require('SelectionState');

const generateRandomKey = require('generateRandomKey');
const invariant = require('invariant');
const gkx = require('gkx');
const sanitizeDraftText = require('sanitizeDraftText');
const inheritAndUpdate = require('inheritAndUpdate');

type ContentStateConfig = {
  // `$Shape` without the spread does not error on missing properties. https://github.com/facebook/flow/issues/5702
  ...$Shape<{
    blockMap: BlockMap,
    entityMap: EntityMap,
    selectionBefore: SelectionState,
    selectionAfter: SelectionState,
  }>,
};

class ContentState {
  blockMap: BlockMap;
  entityMap: EntityMap;
  selectionBefore: SelectionState;
  selectionAfter: SelectionState;

  constructor(config: ContentStateConfig) {
    this.entityMap = config.entityMap || DraftEntity;
    this.blockMap = config.blockMap || BlockMapBuilder.createFromArray([]);
    if (!config.selectionBefore || !config.selectionAfter) {
      const defaultSelectionState = SelectionState.createEmpty();
      this.selectionBefore = config.selectionBefore || defaultSelectionState;
      this.selectionAfter = config.selectionAfter || defaultSelectionState;
    }
  }

  getEntityMap(): EntityMap {
    // TODO: update this when we fully remove DraftEntity
    return DraftEntity;
  }

  getBlockMap(): BlockMap {
    return this.blockMap;
  }

  getSelectionBefore(): SelectionState {
    return this.selectionBefore;
  }

  getSelectionAfter(): SelectionState {
    return this.selectionAfter;
  }

  getBlockForKey(key: string): BlockNodeRecord {
    const blockForKey = this.getBlockMap().get(key);
    invariant(
      blockForKey,
      'BlockMap is expected to contain block for key: ' + key,
    );
    return blockForKey;
  }

  getKeyBefore(key: string): ?string {
    const keys = Array.from(this.getBlockMap().keys());
    const index = keys.lastIndexOf(key);
    const keyBefore = keys[index + 1];
    return keyBefore;
  }

  getKeyAfter(key: string): ?string {
    const keys = Array.from(this.getBlockMap().keys());
    const index = keys.indexOf(key);
    const keyAfter = keys[index + 1];
    return keyAfter;
  }

  getBlockAfter(key: string): ?BlockNodeRecord {
    const entries = Array.from(this.getBlockMap().entries());
    const index = entries.findIndex(([k]) => k === key);
    const blockAfter = entries[index + 1][1];
    return blockAfter;
  }

  getBlockBefore(key: string): ?BlockNodeRecord {
    const entries = Array.from(this.getBlockMap().entries());
    entries.reverse();
    const index = entries.findIndex(([k]) => k === key);
    const blockBefore = entries[index - 1][1];
    return blockBefore;
  }

  getBlocksAsArray(): Array<BlockNodeRecord> {
    const blocksAsArray = Array.from(this.getBlockMap().values());
    invariant(
      blocksAsArray.length > 0,
      'BlockMap is expected to contain at least one block.',
    );
    return blocksAsArray;
  }

  getFirstBlock(): ?BlockNodeRecord {
    const firstBlock = this.getBlockMap()
      .values()
      .next().value;
    invariant(
      firstBlock,
      'BlockMap is expected to contain at least one block.',
    );
    return firstBlock;
  }

  getLastBlock(): ?BlockNodeRecord {
    const blocksAsArray = Array.from(this.getBlockMap().values());
    const lastBlock = blocksAsArray[blocksAsArray.length - 1];
    invariant(lastBlock, 'BlockMap is expected to contain at least one block.');
    return lastBlock;
  }

  getPlainText(delimiter?: string): string {
    return Array.from(this.getBlockMap().values())
      .map(block => {
        return block ? block.getText() : '';
      })
      .join(delimiter || '\n');
  }

  getLastCreatedEntityKey(): string {
    // TODO: update this when we fully remove DraftEntity
    return DraftEntity.__getLastCreatedEntityKey();
  }

  hasText(): boolean {
    const blockMap = this.getBlockMap();
    const blockMapFirstBlock = blockMap.values().next().value;
    return (
      blockMap.size > 1 ||
      (blockMapFirstBlock ? blockMapFirstBlock.getLength() > 0 : false)
    );
  }

  createEntity(
    type: DraftEntityType,
    mutability: DraftEntityMutability,
    data?: Object,
  ): ContentState {
    // TODO: update this when we fully remove DraftEntity
    DraftEntity.__create(type, mutability, data);
    return this;
  }

  mergeEntityData(key: string, toMerge: {[key: string]: any}): ContentState {
    // TODO: update this when we fully remove DraftEntity
    DraftEntity.__mergeData(key, toMerge);
    return this;
  }

  replaceEntityData(key: string, newData: {[key: string]: any}): ContentState {
    // TODO: update this when we fully remove DraftEntity
    DraftEntity.__replaceData(key, newData);
    return this;
  }

  addEntity(instance: DraftEntityInstance): ContentState {
    // TODO: update this when we fully remove DraftEntity
    DraftEntity.__add(instance);
    return this;
  }

  getEntity(key: string): DraftEntityInstance {
    // TODO: update this when we fully remove DraftEntity
    return DraftEntity.__get(key);
  }

  static createFromBlockArray(
    // TODO: update flow type when we completely deprecate the old entity API
    blocks: Array<BlockNodeRecord> | {contentBlocks: Array<BlockNodeRecord>},
    entityMap: ?EntityMap,
  ): ContentState {
    // TODO: remove this when we completely deprecate the old entity API
    const theBlocks = Array.isArray(blocks) ? blocks : blocks.contentBlocks;
    const blockMap = BlockMapBuilder.createFromArray(theBlocks);
    const blockMapFirstBlock = blockMap.values().next().value;
    const selectionState = blockMapFirstBlock
      ? SelectionState.createEmpty(blockMapFirstBlock.getKey())
      : SelectionState.createEmpty();
    return new ContentState({
      blockMap: blockMap,
      entityMap: entityMap || DraftEntity,
      selectionBefore: selectionState,
      selectionAfter: selectionState,
    });
  }

  static createFromText(
    text: string,
    delimiter: string | RegExp = /\r\n?|\n/g,
  ): ContentState {
    const strings = text.split(delimiter);
    const blocks = strings.map(block => {
      block = sanitizeDraftText(block);
      const ContentBlockNodeRecord = gkx('draft_tree_data_support')
        ? ContentBlockNode
        : ContentBlock;
      return new ContentBlockNodeRecord({
        key: generateRandomKey(),
        text: block,
        type: 'unstyled',
        characterList: Array(block.length).fill(CharacterMetadata.EMPTY),
      });
    });
    return ContentState.createFromBlockArray(blocks);
  }

  static set(
    contentState: ContentState,
    put: ContentStateConfig,
  ): ContentState {
    return inheritAndUpdate(contentState, put);
  }
}

module.exports = ContentState;
