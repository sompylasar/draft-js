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
import type {DraftBlockRenderMap} from 'DraftBlockRenderMap';
import type {DraftBlockType} from 'DraftBlockType';
import type {EntityMap} from 'EntityMap';

const ContentBlockNode = require('ContentBlockNode');

const convertFromHTMLToContentBlocksClassic = require('convertFromHTMLToContentBlocks');
const convertFromHTMLToContentBlocksNew = require('convertFromHTMLToContentBlocks2');
const generateRandomKey = require('generateRandomKey');
const getSafeBodyFromHTML = require('getSafeBodyFromHTML');
const gkx = require('gkx');
const sanitizeDraftText = require('sanitizeDraftText');
const inheritAndUpdate = require('inheritAndUpdate');

const experimentalTreeDataSupport = gkx('draft_tree_data_support');

const refactoredHTMLImporter = gkx('draft_refactored_html_importer');
const convertFromHTMLToContentBlocks = refactoredHTMLImporter
  ? convertFromHTMLToContentBlocksNew
  : convertFromHTMLToContentBlocksClassic;

const DraftPasteProcessor = {
  processHTML(
    html: string,
    blockRenderMap?: DraftBlockRenderMap,
  ): ?{contentBlocks: ?Array<BlockNodeRecord>, entityMap: EntityMap} {
    return convertFromHTMLToContentBlocks(
      html,
      getSafeBodyFromHTML,
      blockRenderMap,
    );
  },

  processText(
    textBlocks: Array<string>,
    character: CharacterMetadata,
    type: DraftBlockType,
  ): Array<BlockNodeRecord> {
    return textBlocks.reduce((acc, textLine, index) => {
      textLine = sanitizeDraftText(textLine);
      const key = generateRandomKey();

      let blockNodeConfig = {
        key,
        type,
        text: textLine,
        characterList: Array(textLine.length).fill(character),
      };

      // next block updates previous block
      if (experimentalTreeDataSupport && index !== 0) {
        const prevSiblingIndex = index - 1;
        // update previous block
        acc[prevSiblingIndex] = inheritAndUpdate(acc[prevSiblingIndex], {
          nextSibling: key,
        });
        const previousBlock = acc[prevSiblingIndex];
        blockNodeConfig = {
          ...blockNodeConfig,
          prevSibling: previousBlock.getKey(),
        };
      }

      acc.push(new ContentBlockNode(blockNodeConfig));

      return acc;
    }, []);
  },
};

module.exports = DraftPasteProcessor;
