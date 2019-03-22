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

const BlockMapBuilder = require('BlockMapBuilder');
const CharacterMetadata = require('CharacterMetadata');
const ContentBlock = require('ContentBlock');
const ContentState = require('ContentState');
const EditorState = require('EditorState');
const SampleDraftInlineStyle = require('SampleDraftInlineStyle');
const SelectionState = require('SelectionState');

const {BOLD, ITALIC} = SampleDraftInlineStyle;
const ENTITY_KEY = '1';

const BLOCKS = [
  new ContentBlock({
    key: 'a',
    type: 'unstyled',
    text: 'Alpha',
    characterList: Array(5).fill(CharacterMetadata.EMPTY),
  }),
  new ContentBlock({
    key: 'b',
    type: 'unordered-list-item',
    text: 'Bravo',
    characterList: Array(5).fill(
      CharacterMetadata.create({style: new Set(BOLD), entity: ENTITY_KEY}),
    ),
  }),
  new ContentBlock({
    key: 'c',
    type: 'code-block',
    text: 'Test',
    characterList: Array(4).fill(CharacterMetadata.EMPTY),
  }),
  new ContentBlock({
    key: 'd',
    type: 'code-block',
    text: '',
    characterList: [],
  }),
  new ContentBlock({
    key: 'e',
    type: 'code-block',
    text: '',
    characterList: [],
  }),
  new ContentBlock({
    key: 'f',
    type: 'blockquote',
    text: 'Charlie',
    characterList: Array(7).fill(
      CharacterMetadata.create({style: new Set(ITALIC), entity: null}),
    ),
  }),
];

const selectionState = new SelectionState({
  anchorKey: 'a',
  anchorOffset: 0,
  focusKey: 'a',
  focusOffset: 0,
  isBackward: false,
  hasFocus: true,
});

const blockMap = BlockMapBuilder.createFromArray(BLOCKS);
const contentState = new ContentState({
  blockMap,
  entityMap: new Map(),
  selectionBefore: selectionState,
  selectionAfter: selectionState,
}).createEntity('IMAGE', 'IMMUTABLE', null);

let editorState = EditorState.createWithContent(contentState);
editorState = EditorState.forceSelection(editorState, selectionState);

const getSampleStateForTesting = () => {
  return {editorState, contentState, selectionState};
};

module.exports = getSampleStateForTesting;
