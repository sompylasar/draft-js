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
import type {DraftDecoratorType} from 'DraftDecoratorType';
import type {DraftInlineStyle} from 'DraftInlineStyle';
import type {EditorChangeType} from 'EditorChangeType';
import type {EntityMap} from 'EntityMap';
import type {DecoratorRange} from 'BlockTree';
import type {BidiDirection} from 'UnicodeBidiDirection';

const BlockTree = require('BlockTree');
const ContentState = require('ContentState');
const EditorBidiService = require('EditorBidiService');
const SelectionState = require('SelectionState');
const {EMPTY_STYLE} = require('DraftInlineStyle');

type EditorStateTreeMap = $ReadOnlyMap<string, $ReadOnlyArray<DecoratorRange>>;
type EditorStateDirectionMap = $ReadOnlyMap<string, BidiDirection>;

type EditorStateData = {
  allowUndo: boolean,
  currentContent: ContentState,
  decorator: ?DraftDecoratorType,
  directionMap: EditorStateDirectionMap,
  forceSelection: boolean,
  inCompositionMode: boolean,
  inlineStyleOverride: ?DraftInlineStyle,
  lastChangeType: ?EditorChangeType,
  nativelyRenderedContent: ?ContentState,
  redoStack: $ReadOnlyArray<ContentState>,
  selection: SelectionState,
  treeMap: EditorStateTreeMap,
  undoStack: $ReadOnlyArray<ContentState>,
};

type EditorStateConfig = {
  // `$Shape` without the spread does not error on missing properties. https://github.com/facebook/flow/issues/5702
  ...$Shape<EditorStateData>,
};

class EditorState {
  _state: EditorStateData;

  static createEmpty(decorator?: ?DraftDecoratorType): EditorState {
    return EditorState.createWithContent(
      ContentState.createFromText(''),
      decorator,
    );
  }

  static createWithContent(
    contentState: ContentState,
    decorator?: ?DraftDecoratorType,
  ): EditorState {
    const firstBlock = contentState.getFirstBlock();
    return EditorState.create({
      currentContent: contentState,
      undoStack: [],
      redoStack: [],
      decorator: decorator || null,
      selection: SelectionState.createEmpty(
        firstBlock ? firstBlock.getKey() : undefined,
      ),
    });
  }

  static create(config: EditorStateConfig): EditorState {
    const {currentContent, decorator} = config;
    const contentState = currentContent || ContentState.createFromText('');
    const newState: EditorStateData = {
      ...config,
      treeMap: generateNewTreeMap(contentState, decorator),
      directionMap: EditorBidiService.getDirectionMap(contentState),
    };
    return new EditorState(newState);
  }

  static set(editorState: EditorState, put: EditorStateConfig): EditorState {
    const newState: EditorStateData = {...editorState._state};

    const existingDecorator = newState.decorator;
    let decorator = existingDecorator;
    if (put.decorator === null) {
      decorator = null;
    } else if (put.decorator) {
      decorator = put.decorator;
    }

    const newContent = put.currentContent || editorState.getCurrentContent();

    if (decorator !== existingDecorator) {
      const treeMap = newState.treeMap;
      let newTreeMap;
      if (decorator && existingDecorator) {
        newTreeMap = regenerateTreeForNewDecorator(
          newContent,
          newContent.getBlockMap(),
          treeMap,
          decorator,
          existingDecorator,
        );
      } else {
        newTreeMap = generateNewTreeMap(newContent, decorator);
      }

      Object.assign(newState, {
        decorator,
        treeMap: newTreeMap,
        nativelyRenderedContent: null,
      });
    } else {
      const existingContent = editorState.getCurrentContent();
      if (newContent !== existingContent) {
        Object.assign(newState, {
          treeMap: regenerateTreeForNewBlocks(
            editorState,
            newContent.getBlockMap(),
            newContent.getEntityMap(),
            decorator,
          ),
        });
      }

      Object.assign(newState, put);
    }

    return new EditorState(newState);
  }

  toJS(): Object {
    // TODO(@sompylasar): Deep clone `this._state` or remove `toJS`?
    return {...this._state};
  }

  getAllowUndo(): boolean {
    return this._state.allowUndo;
  }

  getCurrentContent(): ContentState {
    return this._state.currentContent;
  }

  getUndoStack(): $ReadOnlyArray<ContentState> {
    return this._state.undoStack;
  }

  getRedoStack(): $ReadOnlyArray<ContentState> {
    return this._state.redoStack;
  }

  getSelection(): SelectionState {
    return this._state.selection;
  }

  getDecorator(): ?DraftDecoratorType {
    return this._state.decorator;
  }

  isInCompositionMode(): boolean {
    return this._state.inCompositionMode;
  }

  mustForceSelection(): boolean {
    return this._state.forceSelection;
  }

  getNativelyRenderedContent(): ?ContentState {
    return this._state.nativelyRenderedContent;
  }

  getLastChangeType(): ?EditorChangeType {
    return this._state.lastChangeType;
  }

  /**
   * While editing, the user may apply inline style commands with a collapsed
   * cursor, intending to type text that adopts the specified style. In this
   * case, we track the specified style as an "override" that takes precedence
   * over the inline style of the text adjacent to the cursor.
   *
   * If null, there is no override in place.
   */
  getInlineStyleOverride(): ?DraftInlineStyle {
    return this._state.inlineStyleOverride;
  }

  static setInlineStyleOverride(
    editorState: EditorState,
    inlineStyleOverride: DraftInlineStyle,
  ): EditorState {
    return EditorState.set(editorState, {inlineStyleOverride});
  }

  /**
   * Get the appropriate inline style for the editor state. If an
   * override is in place, use it. Otherwise, the current style is
   * based on the location of the selection state.
   */
  getCurrentInlineStyle(): DraftInlineStyle {
    const override = this.getInlineStyleOverride();
    if (override != null) {
      return override;
    }

    const content = this.getCurrentContent();
    const selection = this.getSelection();

    if (selection.isCollapsed()) {
      return getInlineStyleForCollapsedSelection(content, selection);
    }

    return getInlineStyleForNonCollapsedSelection(content, selection);
  }

  getBlockTree(blockKey: string): ?$ReadOnlyArray<DecoratorRange> {
    return this._state.treeMap.get(blockKey);
  }

  isSelectionAtStartOfContent(): boolean {
    const content = this.getCurrentContent();
    const firstBlock = content.getFirstBlock();
    if (!firstBlock) {
      return false;
    }
    return this.getSelection().hasEdgeWithin(firstBlock.getKey(), 0, 0);
  }

  isSelectionAtEndOfContent(): boolean {
    const content = this.getCurrentContent();
    const lastBlock = content.getLastBlock();
    if (!lastBlock) {
      return false;
    }
    const end = lastBlock.getLength();
    return this.getSelection().hasEdgeWithin(lastBlock.getKey(), end, end);
  }

  getDirectionMap(): EditorStateDirectionMap {
    return this._state.directionMap;
  }

  /**
   * Incorporate native DOM selection changes into the EditorState. This
   * method can be used when we simply want to accept whatever the DOM
   * has given us to represent selection, and we do not need to re-render
   * the editor.
   *
   * To forcibly move the DOM selection, see `EditorState.forceSelection`.
   */
  static acceptSelection(
    editorState: EditorState,
    selection: SelectionState,
  ): EditorState {
    return updateSelection(editorState, selection, false);
  }

  /**
   * At times, we need to force the DOM selection to be where we
   * need it to be. This can occur when the anchor or focus nodes
   * are non-text nodes, for instance. In this case, we want to trigger
   * a re-render of the editor, which in turn forces selection into
   * the correct place in the DOM. The `forceSelection` method
   * accomplishes this.
   *
   * This method should be used in cases where you need to explicitly
   * move the DOM selection from one place to another without a change
   * in ContentState.
   */
  static forceSelection(
    editorState: EditorState,
    selection: SelectionState,
  ): EditorState {
    if (!selection.getHasFocus()) {
      selection = SelectionState.set(selection, {hasFocus: true});
    }
    return updateSelection(editorState, selection, true);
  }

  /**
   * Move selection to the end of the editor without forcing focus.
   */
  static moveSelectionToEnd(editorState: EditorState): EditorState {
    const content = editorState.getCurrentContent();
    const lastBlock = content.getLastBlock();
    const lastKey = lastBlock ? lastBlock.getKey() : undefined;
    const length = lastBlock ? lastBlock.getLength() : undefined;

    return EditorState.acceptSelection(
      editorState,
      new SelectionState({
        anchorKey: lastKey,
        anchorOffset: length,
        focusKey: lastKey,
        focusOffset: length,
        isBackward: false,
      }),
    );
  }

  /**
   * Force focus to the end of the editor. This is useful in scenarios
   * where we want to programmatically focus the input and it makes sense
   * to allow the user to continue working seamlessly.
   */
  static moveFocusToEnd(editorState: EditorState): EditorState {
    const afterSelectionMove = EditorState.moveSelectionToEnd(editorState);
    return EditorState.forceSelection(
      afterSelectionMove,
      afterSelectionMove.getSelection(),
    );
  }

  /**
   * Push the current ContentState onto the undo stack if it should be
   * considered a boundary state, and set the provided ContentState as the
   * new current content.
   */
  static push(
    editorState: EditorState,
    contentState: ContentState,
    changeType: EditorChangeType,
    forceSelection: boolean = true,
  ): EditorState {
    if (editorState.getCurrentContent() === contentState) {
      return editorState;
    }

    const directionMap = EditorBidiService.getDirectionMap(
      contentState,
      editorState.getDirectionMap(),
    );

    if (!editorState.getAllowUndo()) {
      return EditorState.set(editorState, {
        currentContent: contentState,
        directionMap,
        lastChangeType: changeType,
        selection: contentState.getSelectionAfter(),
        forceSelection,
        inlineStyleOverride: null,
      });
    }

    const selection = editorState.getSelection();
    const currentContent = editorState.getCurrentContent();
    let undoStack = editorState.getUndoStack();
    let newContent = contentState;

    if (
      selection !== currentContent.getSelectionAfter() ||
      mustBecomeBoundary(editorState, changeType)
    ) {
      undoStack = [...undoStack, currentContent];
      newContent = ContentState.set(newContent, {selectionBefore: selection});
    } else if (
      changeType === 'insert-characters' ||
      changeType === 'backspace-character' ||
      changeType === 'delete-character'
    ) {
      // Preserve the previous selection.
      newContent = ContentState.set(newContent, {
        selectionBefore: currentContent.getSelectionBefore(),
      });
    }

    let inlineStyleOverride = editorState.getInlineStyleOverride();

    // Don't discard inline style overrides for the following change types:
    const overrideChangeTypes = [
      'adjust-depth',
      'change-block-type',
      'split-block',
    ];

    if (overrideChangeTypes.indexOf(changeType) === -1) {
      inlineStyleOverride = null;
    }

    const editorStateChanges = {
      currentContent: newContent,
      directionMap,
      undoStack,
      redoStack: [],
      lastChangeType: changeType,
      selection: contentState.getSelectionAfter(),
      forceSelection,
      inlineStyleOverride,
    };

    return EditorState.set(editorState, editorStateChanges);
  }

  /**
   * Make the top ContentState in the undo stack the new current content and
   * push the current content onto the redo stack.
   */
  static undo(editorState: EditorState): EditorState {
    if (!editorState.getAllowUndo()) {
      return editorState;
    }

    const undoStack = editorState.getUndoStack();
    const newCurrentContent = undoStack[0];
    if (!newCurrentContent) {
      return editorState;
    }

    const currentContent = editorState.getCurrentContent();
    const directionMap = EditorBidiService.getDirectionMap(
      newCurrentContent,
      editorState.getDirectionMap(),
    );

    return EditorState.set(editorState, {
      currentContent: newCurrentContent,
      directionMap,
      undoStack: undoStack.slice(1),
      redoStack: [...editorState.getRedoStack(), currentContent],
      forceSelection: true,
      inlineStyleOverride: null,
      lastChangeType: 'undo',
      nativelyRenderedContent: null,
      selection: currentContent.getSelectionBefore(),
    });
  }

  /**
   * Make the top ContentState in the redo stack the new current content and
   * push the current content onto the undo stack.
   */
  static redo(editorState: EditorState): EditorState {
    if (!editorState.getAllowUndo()) {
      return editorState;
    }

    const redoStack = editorState.getRedoStack();
    const newCurrentContent = redoStack[0];
    if (!newCurrentContent) {
      return editorState;
    }

    const currentContent = editorState.getCurrentContent();
    const directionMap = EditorBidiService.getDirectionMap(
      newCurrentContent,
      editorState.getDirectionMap(),
    );

    return EditorState.set(editorState, {
      currentContent: newCurrentContent,
      directionMap,
      undoStack: [...editorState.getUndoStack(), currentContent],
      redoStack: redoStack.slice(1),
      forceSelection: true,
      inlineStyleOverride: null,
      lastChangeType: 'redo',
      nativelyRenderedContent: null,
      selection: newCurrentContent.getSelectionAfter(),
    });
  }

  /**
   * Not for public consumption.
   */
  constructor(state: EditorStateData) {
    this._state = state;
  }
}

/**
 * Set the supplied SelectionState as the new current selection, and set
 * the `force` flag to trigger manual selection placement by the view.
 */
function updateSelection(
  editorState: EditorState,
  selection: SelectionState,
  forceSelection: boolean,
): EditorState {
  return EditorState.set(editorState, {
    selection,
    forceSelection,
    nativelyRenderedContent: null,
    inlineStyleOverride: null,
  });
}

/**
 * Regenerate the entire tree map for a given ContentState and decorator.
 * Returns an OrderedMap that maps all available ContentBlock objects.
 */
function generateNewTreeMap(
  contentState: ContentState,
  decorator?: ?DraftDecoratorType,
): EditorStateTreeMap {
  const newTreeMapEntries = Array.from(
    contentState.getBlockMap().entries(),
  ).map(([key, block]) => [
    key,
    BlockTree.generate(contentState, block, decorator),
  ]);
  return (new Map(newTreeMapEntries): EditorStateTreeMap);
}

/**
 * Regenerate tree map objects for all ContentBlocks that have changed
 * between the current editorState and newContent. Returns an OrderedMap
 * with only changed regenerated tree map objects.
 */
function regenerateTreeForNewBlocks(
  editorState: EditorState,
  newBlockMap: BlockMap,
  newEntityMap: EntityMap,
  decorator?: ?DraftDecoratorType,
): EditorStateTreeMap {
  const contentState = ContentState.set(editorState.getCurrentContent(), {
    entityMap: newEntityMap,
  });
  const prevBlockMap = contentState.getBlockMap();
  const prevTreeMap = editorState._state.treeMap;
  const newTreeMapEntries = [
    ...prevTreeMap.entries(),
    ...Array.from(newBlockMap.entries())
      .filter(([key, block]) => block !== prevBlockMap.get(key))
      .map(([key, block]) => [
        key,
        BlockTree.generate(contentState, block, decorator),
      ]),
  ];
  return (new Map(newTreeMapEntries): EditorStateTreeMap);
}

/**
 * Generate tree map objects for a new decorator object, preserving any
 * decorations that are unchanged from the previous decorator.
 *
 * Note that in order for this to perform optimally, decoration Lists for
 * decorators should be preserved when possible to allow for direct immutable
 * List comparison.
 */
function regenerateTreeForNewDecorator(
  contentState: ContentState,
  blockMap: BlockMap,
  previousTreeMap: EditorStateTreeMap,
  decorator: DraftDecoratorType,
  existingDecorator: DraftDecoratorType,
): EditorStateTreeMap {
  const newTreeMapEntries = Array.from(previousTreeMap.entries())
    .filter(([key, block]) => {
      return (
        decorator.getDecorations(block, contentState) !==
        existingDecorator.getDecorations(block, contentState)
      );
    })
    .map(([key, block]) => [
      key,
      BlockTree.generate(contentState, block, decorator),
    ]);
  return (new Map(newTreeMapEntries): EditorStateTreeMap);
}

/**
 * Return whether a change should be considered a boundary state, given
 * the previous change type. Allows us to discard potential boundary states
 * during standard typing or deletion behavior.
 */
function mustBecomeBoundary(
  editorState: EditorState,
  changeType: EditorChangeType,
): boolean {
  const lastChangeType = editorState.getLastChangeType();
  return (
    changeType !== lastChangeType ||
    (changeType !== 'insert-characters' &&
      changeType !== 'backspace-character' &&
      changeType !== 'delete-character')
  );
}

function getInlineStyleForCollapsedSelection(
  content: ContentState,
  selection: SelectionState,
): DraftInlineStyle {
  const startKey = selection.getStartKey();
  const startOffset = selection.getStartOffset();
  const startBlock = content.getBlockForKey(startKey);

  // If the cursor is not at the start of the block, look backward to
  // preserve the style of the preceding character.
  if (startOffset > 0) {
    return startBlock.getInlineStyleAt(startOffset - 1);
  }

  // The caret is at position zero in this block. If the block has any
  // text at all, use the style of the first character.
  if (startBlock.getLength()) {
    return startBlock.getInlineStyleAt(0);
  }

  // Otherwise, look upward in the document to find the closest character.
  return lookUpwardForInlineStyle(content, startKey);
}

function getInlineStyleForNonCollapsedSelection(
  content: ContentState,
  selection: SelectionState,
): DraftInlineStyle {
  const startKey = selection.getStartKey();
  const startOffset = selection.getStartOffset();
  const startBlock = content.getBlockForKey(startKey);

  // If there is a character just inside the selection, use its style.
  if (startOffset < startBlock.getLength()) {
    return startBlock.getInlineStyleAt(startOffset);
  }

  // Check if the selection at the end of a non-empty block. Use the last
  // style in the block.
  if (startOffset > 0) {
    return startBlock.getInlineStyleAt(startOffset - 1);
  }

  // Otherwise, look upward in the document to find the closest character.
  return lookUpwardForInlineStyle(content, startKey);
}

function lookUpwardForInlineStyle(
  content: ContentState,
  fromKey: string,
): DraftInlineStyle {
  const blockMapEntries = Array.from(content.getBlockMap().entries());
  blockMapEntries.reverse();

  let lastNonEmpty;
  let loopState = 0;
  for (const blockMapEntry of blockMapEntries) {
    if (loopState === 0 && blockMapEntry[0] === fromKey) {
      ++loopState;
    } else if (loopState === 1) {
      ++loopState;
      continue;
    } else if (loopState === 2 && blockMapEntry[1].getLength()) {
      lastNonEmpty = blockMapEntry[1];
      break;
    }
  }

  if (lastNonEmpty) {
    return lastNonEmpty.getInlineStyleAt(lastNonEmpty.getLength() - 1);
  }

  return EMPTY_STYLE;
}

module.exports = EditorState;
