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
import type {DraftInsertionType} from 'DraftInsertionType';

const BlockMapBuilder = require('BlockMapBuilder');
const CharacterMetadata = require('CharacterMetadata');
const ContentBlock = require('ContentBlock');
const ContentBlockNode = require('ContentBlockNode');
const DraftModifier = require('DraftModifier');
const EditorState = require('EditorState');
const SelectionState = require('SelectionState');

const generateRandomKey = require('generateRandomKey');
const gkx = require('gkx');
const moveBlockInContentState = require('moveBlockInContentState');
const inheritAndUpdate = require('inheritAndUpdate');

const experimentalTreeDataSupport = gkx('draft_tree_data_support');
const ContentBlockRecord = experimentalTreeDataSupport
  ? ContentBlockNode
  : ContentBlock;

const AtomicBlockUtils = {
  insertAtomicBlock: function(
    editorState: EditorState,
    entityKey: ?string,
    character: string,
  ): EditorState {
    const contentState = editorState.getCurrentContent();
    const selectionState = editorState.getSelection();

    const afterRemoval = DraftModifier.removeRange(
      contentState,
      selectionState,
      'backward',
    );

    const targetSelection = afterRemoval.getSelectionAfter();
    const afterSplit = DraftModifier.splitBlock(afterRemoval, targetSelection);
    const insertionTarget = afterSplit.getSelectionAfter();

    const asAtomicBlock = DraftModifier.setBlockType(
      afterSplit,
      insertionTarget,
      'atomic',
    );

    const charData = CharacterMetadata.create({entity: entityKey});

    let atomicBlockConfig = {
      key: generateRandomKey(),
      type: 'atomic',
      text: character,
      characterList: Array(character.length).fill(charData),
    };

    let atomicDividerBlockConfig = {
      key: generateRandomKey(),
      type: 'unstyled',
    };

    if (experimentalTreeDataSupport) {
      atomicBlockConfig = {
        ...atomicBlockConfig,
        nextSibling: atomicDividerBlockConfig.key,
      };
      atomicDividerBlockConfig = {
        ...atomicDividerBlockConfig,
        prevSibling: atomicBlockConfig.key,
      };
    }

    const fragmentArray = [
      new ContentBlockRecord(atomicBlockConfig),
      new ContentBlockRecord(atomicDividerBlockConfig),
    ];

    const fragment = BlockMapBuilder.createFromArray(fragmentArray);

    const withAtomicBlock = DraftModifier.replaceWithFragment(
      asAtomicBlock,
      insertionTarget,
      fragment,
    );

    const newContent = inheritAndUpdate(withAtomicBlock, {
      selectionBefore: selectionState,
      selectionAfter: SelectionState.set(withAtomicBlock.getSelectionAfter(), {
        hasFocus: true,
      }),
    });

    return EditorState.push(editorState, newContent, 'insert-fragment');
  },

  moveAtomicBlock: function(
    editorState: EditorState,
    atomicBlock: BlockNodeRecord,
    targetRange: SelectionState,
    insertionMode?: DraftInsertionType,
  ): EditorState {
    const contentState = editorState.getCurrentContent();
    const selectionState = editorState.getSelection();

    let withMovedAtomicBlock;

    if (insertionMode === 'before' || insertionMode === 'after') {
      const targetBlock = contentState.getBlockForKey(
        insertionMode === 'before'
          ? targetRange.getStartKey()
          : targetRange.getEndKey(),
      );

      withMovedAtomicBlock = moveBlockInContentState(
        contentState,
        atomicBlock,
        targetBlock,
        insertionMode,
      );
    } else {
      const afterRemoval = DraftModifier.removeRange(
        contentState,
        targetRange,
        'backward',
      );

      const selectionAfterRemoval = afterRemoval.getSelectionAfter();
      const targetBlock = afterRemoval.getBlockForKey(
        selectionAfterRemoval.getFocusKey(),
      );

      if (selectionAfterRemoval.getStartOffset() === 0) {
        withMovedAtomicBlock = moveBlockInContentState(
          afterRemoval,
          atomicBlock,
          targetBlock,
          'before',
        );
      } else if (
        selectionAfterRemoval.getEndOffset() === targetBlock.getLength()
      ) {
        withMovedAtomicBlock = moveBlockInContentState(
          afterRemoval,
          atomicBlock,
          targetBlock,
          'after',
        );
      } else {
        const afterSplit = DraftModifier.splitBlock(
          afterRemoval,
          selectionAfterRemoval,
        );

        const selectionAfterSplit = afterSplit.getSelectionAfter();
        const targetBlock = afterSplit.getBlockForKey(
          selectionAfterSplit.getFocusKey(),
        );

        withMovedAtomicBlock = moveBlockInContentState(
          afterSplit,
          atomicBlock,
          targetBlock,
          'before',
        );
      }
    }

    const newContent = inheritAndUpdate(withMovedAtomicBlock, {
      selectionBefore: selectionState,
      selectionAfter: SelectionState.set(
        withMovedAtomicBlock.getSelectionAfter(),
        {hasFocus: true},
      ),
    });

    return EditorState.push(editorState, newContent, 'move-block');
  },
};

module.exports = AtomicBlockUtils;
