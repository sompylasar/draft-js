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

import type ContentState from 'ContentState';
import type SelectionState from 'SelectionState';

const modifyBlockForContentState = require('modifyBlockForContentState');
const inheritAndUpdate = require('inheritAndUpdate');

function adjustBlockDepthForContentState(
  contentState: ContentState,
  selectionState: SelectionState,
  adjustment: number,
  maxDepth: number,
): ContentState {
  return modifyBlockForContentState(contentState, selectionState, block => {
    let depth = block.getDepth() + adjustment;
    depth = Math.max(0, Math.min(depth, maxDepth));
    return inheritAndUpdate(block, {depth: depth});
  });
}

module.exports = adjustBlockDepthForContentState;
