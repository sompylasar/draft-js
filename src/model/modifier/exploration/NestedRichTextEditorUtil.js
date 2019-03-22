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
 * This is unstable and not part of the public API and should not be used by
 * production systems. This file may be update/removed without notice.
 */
import type {BlockMap} from 'BlockMap';
import type {DraftBlockType} from 'DraftBlockType';
import type {DraftEditorCommand} from 'DraftEditorCommand';
import type {DataObjectForLink, RichTextUtils} from 'RichTextUtils';
import type URI from 'URI';

const ContentBlockNode = require('ContentBlockNode');
const DraftModifier = require('DraftModifier');
const DraftTreeOperations = require('DraftTreeOperations');
const EditorState = require('EditorState');
const ContentState = require('ContentState');
const SelectionState = require('SelectionState');
const RichTextEditorUtil = require('RichTextEditorUtil');

const adjustBlockDepthForContentState = require('adjustBlockDepthForContentState');
const generateRandomKey = require('generateRandomKey');
const inheritAndUpdate = require('inheritAndUpdate');
const invariant = require('invariant');

// Eventually we could allow to control this list by either allowing user configuration
// and/or a schema in conjunction to DraftBlockRenderMap
const NESTING_DISABLED_TYPES = ['code-block', 'atomic'];

const NestedRichTextEditorUtil: RichTextUtils = {
  handleKeyCommand: (
    editorState: EditorState,
    command: DraftEditorCommand | string,
  ): ?EditorState => {
    switch (command) {
      case 'bold':
        return NestedRichTextEditorUtil.toggleInlineStyle(editorState, 'BOLD');
      case 'italic':
        return NestedRichTextEditorUtil.toggleInlineStyle(
          editorState,
          'ITALIC',
        );
      case 'underline':
        return NestedRichTextEditorUtil.toggleInlineStyle(
          editorState,
          'UNDERLINE',
        );
      case 'code':
        return NestedRichTextEditorUtil.toggleCode(editorState);
      case 'backspace':
      case 'backspace-word':
      case 'backspace-to-start-of-line':
        return NestedRichTextEditorUtil.onBackspace(editorState);
      case 'delete':
      case 'delete-word':
      case 'delete-to-end-of-block':
        return NestedRichTextEditorUtil.onDelete(editorState);
      default:
        // they may have custom editor commands; ignore those
        return null;
    }
  },

  onDelete: (editorState: EditorState): ?EditorState => {
    const selection = editorState.getSelection();
    if (!selection.isCollapsed()) {
      return null;
    }

    const content = editorState.getCurrentContent();
    const startKey = selection.getStartKey();
    const block = content.getBlockForKey(startKey);
    const length = block.getLength();

    // The cursor is somewhere within the text. Behave normally.
    if (selection.getStartOffset() < length) {
      return null;
    }

    const blockAfter = content.getBlockAfter(startKey);

    if (!blockAfter || blockAfter.getType() !== 'atomic') {
      return null;
    }

    const atomicBlockTarget = SelectionState.set(selection, {
      focusKey: blockAfter.getKey(),
      focusOffset: blockAfter.getLength(),
    });

    const withoutAtomicBlock = DraftModifier.removeRange(
      content,
      atomicBlockTarget,
      'forward',
    );

    if (withoutAtomicBlock !== content) {
      return EditorState.push(editorState, withoutAtomicBlock, 'remove-range');
    }

    return null;
  },

  /**
   * Ensures that if on the beginning of unstyled block and first child of
   * a nested parent we add its text to the neareast previous leaf node
   */
  onBackspace: (editorState: EditorState): ?EditorState => {
    const selection = editorState.getSelection();
    const content = editorState.getCurrentContent();
    const currentBlock = content.getBlockForKey(selection.getStartKey());
    const previousBlockKey = currentBlock.getPrevSiblingKey();

    if (
      !selection.isCollapsed() ||
      selection.getAnchorOffset() ||
      selection.getFocusOffset() ||
      (currentBlock.getType() === 'unstyled' &&
        (previousBlockKey &&
          content.getBlockForKey(previousBlockKey).getType() !== 'atomic'))
    ) {
      return null;
    }

    const startKey = selection.getStartKey();
    const blockBefore = content.getBlockBefore(startKey);

    // we want to delete that block completely
    if (blockBefore && blockBefore.getType() === 'atomic') {
      const withoutAtomicBlock = ContentState.set(
        DraftModifier.removeRange(
          content,
          SelectionState.set(selection, {
            focusKey: blockBefore.getKey(),
            focusOffset: blockBefore.getText().length,
            anchorKey: startKey,
            anchorOffset: content.getBlockForKey(startKey).getText().length,
            isBackward: false,
          }),
          'forward',
        ),
        {
          selectionAfter: selection,
        },
      );

      if (withoutAtomicBlock !== content) {
        return EditorState.push(
          editorState,
          withoutAtomicBlock,
          'remove-range',
        );
      }
    }

    // if we have a next sibbling we should not allow the normal backspace
    // behaviour of moving this text into its parent
    // if (currentBlock.getPrevSiblingKey()) {
    //  return editorState;
    // }

    // If that doesn't succeed, try to remove the current block style.
    const withoutBlockStyle = NestedRichTextEditorUtil.tryToRemoveBlockStyle(
      editorState,
    );

    if (withoutBlockStyle) {
      return EditorState.push(
        editorState,
        withoutBlockStyle,
        withoutBlockStyle
          .getBlockMap()
          .get(currentBlock.getKey())
          .getType() === 'unstyled'
          ? 'change-block-type'
          : 'adjust-depth',
      );
    }

    return null;
  },

  // Todo (T32099101)
  // onSplitNestedBlock() {},

  // Todo (T32099101)
  // onSplitParent() {},

  /**
   * Ensures that we can create nested blocks by changing the block type of
   * a ranged selection
   */
  toggleBlockType: (
    editorState: EditorState,
    blockType: DraftBlockType,
  ): EditorState => {
    const selection = editorState.getSelection();
    const content = editorState.getCurrentContent();
    const currentBlock = content.getBlockForKey(selection.getStartKey());
    const haveChildren = currentBlock.getChildKeys().length > 0;
    const isSelectionCollapsed = selection.isCollapsed();
    const isMultiBlockSelection =
      selection.getAnchorKey() !== selection.getFocusKey();
    const isUnsupportedNestingBlockType = NESTING_DISABLED_TYPES.includes(
      blockType,
    );
    const isCurrentBlockOfUnsupportedNestingBlockType = NESTING_DISABLED_TYPES.includes(
      currentBlock.getType(),
    );

    // we don't allow this operations to avoid corrupting the document data model
    // to make sure that non nested blockTypes wont inherit children
    if (
      (isMultiBlockSelection || haveChildren) &&
      isUnsupportedNestingBlockType
    ) {
      return editorState;
    }

    // we can treat this operations the same way as we would for flat data structures
    if (
      isCurrentBlockOfUnsupportedNestingBlockType ||
      isSelectionCollapsed ||
      isUnsupportedNestingBlockType ||
      isMultiBlockSelection ||
      currentBlock.getType() === blockType ||
      currentBlock.getChildKeys().length > 0
    ) {
      return RichTextEditorUtil.toggleBlockType(editorState, blockType);
    }

    // TODO
    // if we have full range selection on the block:
    //   extract text and insert a block after it with the text as its content
    // else
    //   split the block into before range and after unstyled blocks
    //
    return editorState;
  },

  currentBlockContainsLink: (editorState: EditorState): boolean => {
    const selection = editorState.getSelection();
    const contentState = editorState.getCurrentContent();
    const entityMap = contentState.getEntityMap();
    return contentState
      .getBlockForKey(selection.getAnchorKey())
      .getCharacterList()
      .slice(selection.getStartOffset(), selection.getEndOffset())
      .some(v => {
        const entity = v.getEntity();
        return !!entity && entityMap.__get(entity).getType() === 'LINK';
      });
  },

  getCurrentBlockType: (editorState: EditorState): DraftBlockType => {
    const selection = editorState.getSelection();
    return editorState
      .getCurrentContent()
      .getBlockForKey(selection.getStartKey())
      .getType();
  },

  getDataObjectForLinkURL: (uri: URI): DataObjectForLink => {
    return {url: uri.toString()};
  },

  insertSoftNewline: (editorState: EditorState): EditorState => {
    const contentState = DraftModifier.insertText(
      editorState.getCurrentContent(),
      editorState.getSelection(),
      '\n',
      editorState.getCurrentInlineStyle(),
      null,
    );

    const newEditorState = EditorState.push(
      editorState,
      contentState,
      'insert-characters',
    );

    return EditorState.forceSelection(
      newEditorState,
      contentState.getSelectionAfter(),
    );
  },

  onTab: (
    event: SyntheticKeyboardEvent<>,
    editorState: EditorState,
    maxDepth: number,
  ): EditorState => {
    const selection = editorState.getSelection();
    const key = selection.getAnchorKey();
    if (key !== selection.getFocusKey()) {
      return editorState;
    }

    let content = editorState.getCurrentContent();
    const block = content.getBlockForKey(key);
    const type = block.getType();
    if (type !== 'unordered-list-item' && type !== 'ordered-list-item') {
      return editorState;
    }

    event.preventDefault();

    const depth = block.getDepth();
    if (!event.shiftKey && depth === maxDepth) {
      return editorState;
    }

    // implement nested tree behaviour for onTab
    let blockMap = editorState.getCurrentContent().getBlockMap();
    const prevSiblingKey = block.getPrevSiblingKey();
    const nextSiblingKey = block.getNextSiblingKey();
    if (!event.shiftKey) {
      // if there is no previous sibling, we do nothing
      if (prevSiblingKey == null) {
        return editorState;
      }
      // if previous sibling is a non-leaf move node as child of previous sibling
      const prevSibling = blockMap.get(prevSiblingKey);
      const nextSibling =
        nextSiblingKey != null ? blockMap.get(nextSiblingKey) : null;
      const prevSiblingNonLeaf =
        prevSibling != null && prevSibling.getChildKeys().count() > 0;
      const nextSiblingNonLeaf =
        nextSibling != null && nextSibling.getChildKeys().count() > 0;
      if (prevSiblingNonLeaf) {
        blockMap = DraftTreeOperations.updateAsSiblingsChild(
          blockMap,
          key,
          'previous',
        );
        // if next sibling is also non-leaf, merge the previous & next siblings
        if (nextSiblingNonLeaf) {
          blockMap = DraftTreeOperations.mergeBlocks(blockMap, prevSiblingKey);
        }
        // else, if only next sibling is non-leaf move node as child of next sibling
      } else if (nextSiblingNonLeaf) {
        blockMap = DraftTreeOperations.updateAsSiblingsChild(
          blockMap,
          key,
          'next',
        );
        // if none of the siblings are non-leaf, we need to create a new parent
      } else {
        blockMap = DraftTreeOperations.createNewParent(blockMap, key);
      }
      // on un-tab
    } else {
      // if the block isn't nested, do nothing
      if (block.getParentKey() == null) {
        return editorState;
      }
      blockMap = onUntab(blockMap, block);
    }
    content = ContentState.set(editorState.getCurrentContent(), {
      blockMap: blockMap,
    });

    const withAdjustment = adjustBlockDepthForContentState(
      content,
      selection,
      event.shiftKey ? -1 : 1,
      maxDepth,
    );

    return EditorState.push(editorState, withAdjustment, 'adjust-depth');
  },

  toggleCode: (editorState: EditorState): EditorState => {
    const selection = editorState.getSelection();
    const anchorKey = selection.getAnchorKey();
    const focusKey = selection.getFocusKey();

    if (selection.isCollapsed() || anchorKey !== focusKey) {
      return RichTextEditorUtil.toggleBlockType(editorState, 'code-block');
    }

    return RichTextEditorUtil.toggleInlineStyle(editorState, 'CODE');
  },

  /**
   * Toggle the specified inline style for the selection. If the
   * user's selection is collapsed, apply or remove the style for the
   * internal state. If it is not collapsed, apply the change directly
   * to the document state.
   */
  toggleInlineStyle: (
    editorState: EditorState,
    inlineStyle: string,
  ): EditorState => {
    const selection = editorState.getSelection();
    const currentStyle = editorState.getCurrentInlineStyle();

    // If the selection is collapsed, toggle the specified style on or off and
    // set the result as the new inline style override. This will then be
    // used as the inline style for the next character to be inserted.
    if (selection.isCollapsed()) {
      const nextStyle = new Set(currentStyle);
      if (currentStyle.has(inlineStyle)) {
        nextStyle.delete(inlineStyle);
      } else {
        nextStyle.add(inlineStyle);
      }
      return EditorState.setInlineStyleOverride(editorState, nextStyle);
    }

    // If characters are selected, immediately apply or remove the
    // inline style on the document state itself.
    const content = editorState.getCurrentContent();
    let newContent;

    // If the style is already present for the selection range, remove it.
    // Otherwise, apply it.
    if (currentStyle.has(inlineStyle)) {
      newContent = DraftModifier.removeInlineStyle(
        content,
        selection,
        inlineStyle,
      );
    } else {
      newContent = DraftModifier.applyInlineStyle(
        content,
        selection,
        inlineStyle,
      );
    }

    return EditorState.push(editorState, newContent, 'change-inline-style');
  },

  toggleLink: (
    editorState: EditorState,
    targetSelection: SelectionState,
    entityKey: ?string,
  ): EditorState => {
    const withoutLink = DraftModifier.applyEntity(
      editorState.getCurrentContent(),
      targetSelection,
      entityKey,
    );

    return EditorState.push(editorState, withoutLink, 'apply-entity');
  },

  /**
   * When a collapsed cursor is at the start of a styled block, changes block
   * type to 'unstyled'. Returns null if selection does not meet that criteria.
   */
  tryToRemoveBlockStyle: (editorState: EditorState): ?ContentState => {
    const selection = editorState.getSelection();
    const offset = selection.getAnchorOffset();
    if (selection.isCollapsed() && offset === 0) {
      const key = selection.getAnchorKey();
      const content = editorState.getCurrentContent();
      const block = content.getBlockForKey(key);

      const type = block.getType();
      const blockBefore = content.getBlockBefore(key);
      if (
        type === 'code-block' &&
        blockBefore &&
        blockBefore.getType() === 'code-block' &&
        blockBefore.getLength() !== 0
      ) {
        return null;
      }

      const depth = block.getDepth();
      if (type !== 'unstyled') {
        if (
          (type === 'unordered-list-item' || type === 'ordered-list-item') &&
          depth > 0
        ) {
          const newBlockMap = new Map(onUntab(content.getBlockMap(), block));
          newBlockMap.set(
            key,
            inheritAndUpdate(newBlockMap.get(key), {depth: depth - 1}),
          );
          return ContentState.set(content, {blockMap: newBlockMap});
        }
        return DraftModifier.setBlockType(content, selection, 'unstyled');
      }
    }
    return null;
  },
};

const onUntab = (blockMap: BlockMap, block: ContentBlockNode): BlockMap => {
  const key = block.getKey();
  const parentKey = block.getParentKey();
  const nextSiblingKey = block.getNextSiblingKey();
  if (parentKey == null) {
    return blockMap;
  }
  const parent = blockMap.get(parentKey);
  const existingChildren = parent.getChildKeys();
  const blockIndex = existingChildren.indexOf(key);
  if (blockIndex === 0 || blockIndex === existingChildren.length - 1) {
    blockMap = DraftTreeOperations.moveChildUp(blockMap, key);
  } else {
    // split the block into [0, blockIndex] in parent & the rest in a new block
    const prevChildren = existingChildren.slice(0, blockIndex + 1);
    const nextChildren = existingChildren.slice(blockIndex + 1);
    const blockMapEntries = [];
    blockMapEntries.push([
      parentKey,
      inheritAndUpdate(parent, {children: prevChildren}),
    ]);
    const newBlock = new ContentBlockNode({
      key: generateRandomKey(),
      text: '',
      depth: parent.getDepth(),
      type: parent.getType(),
      children: nextChildren,
      parent: parent.getParentKey(),
    });
    // add new block just before its the original next sibling in the block map
    // TODO(T33894878): Remove the map reordering code & fix converter after launch
    invariant(nextSiblingKey != null, 'block must have a next sibling here');
    let loopState = 0;
    for (const blockMapEntry of blockMap) {
      if (loopState === 0 && blockMapEntry[1].getKey() === nextSiblingKey) {
        ++loopState;
        blockMapEntries.push([newBlock.getKey(), newBlock]);
      } else if (
        loopState === 1 &&
        blockMapEntry[1].getKey() === nextSiblingKey
      ) {
        ++loopState;
        break;
      } else if (loopState === 0 || loopState === 1) {
        blockMapEntries.push(blockMapEntry);
      }
    }

    // set the nextChildren's parent to the new block
    Array.from(blockMap.entries()).forEach(blockMapEntry => {
      const block = blockMapEntry[1];
      blockMapEntries.push([
        blockMapEntry[0],
        nextChildren.includes(block.getKey())
          ? inheritAndUpdate(block, {parent: newBlock.getKey()})
          : block,
      ]);
    });

    // update the next/previous pointers for the children at the split
    blockMapEntries.push([key, inheritAndUpdate(block, {nextSibling: null})]);
    blockMapEntries.push([
      nextSiblingKey,
      inheritAndUpdate(blockMap.get(nextSiblingKey), {prevSibling: null}),
    ]);

    blockMap = new Map(blockMapEntries);

    const parentNextSiblingKey = parent.getNextSiblingKey();
    if (parentNextSiblingKey != null) {
      blockMap = DraftTreeOperations.updateSibling(
        blockMap,
        newBlock.getKey(),
        parentNextSiblingKey,
      );
    }
    blockMap = DraftTreeOperations.updateSibling(
      blockMap,
      parentKey,
      newBlock.getKey(),
    );
    blockMap = DraftTreeOperations.moveChildUp(blockMap, key);
  }

  // on untab, we also want to unnest any sibling blocks that become two levels deep
  // ensure that block's old parent does not have a non-leaf as its first child.
  let childWasUntabbed = false;
  if (parentKey != null) {
    let parent = blockMap.get(parentKey);
    while (parent != null) {
      const children = parent.getChildKeys();
      const firstChildKey = children.first();
      invariant(firstChildKey != null, 'parent must have at least one child');
      const firstChild = blockMap.get(firstChildKey);
      if (firstChild.getChildKeys().count() === 0) {
        break;
      } else {
        blockMap = DraftTreeOperations.moveChildUp(blockMap, firstChildKey);
        parent = blockMap.get(parentKey);
        childWasUntabbed = true;
      }
    }
  }

  // now, we may be in a state with two non-leaf blocks of the same type
  // next to each other
  if (childWasUntabbed && parentKey != null) {
    const parent = blockMap.get(parentKey);
    const prevSiblingKey =
      parent != null // parent may have been deleted
        ? parent.getPrevSiblingKey()
        : null;
    if (prevSiblingKey != null && parent.getChildKeys().count() > 0) {
      const prevSibling = blockMap.get(prevSiblingKey);
      if (prevSibling != null && prevSibling.getChildKeys().count() > 0) {
        blockMap = DraftTreeOperations.mergeBlocks(blockMap, prevSiblingKey);
      }
    }
  }
  return blockMap;
};

module.exports = NestedRichTextEditorUtil;
