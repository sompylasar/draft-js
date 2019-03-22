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

import type ContentState from 'ContentState';
import type {BidiDirection} from 'UnicodeBidiDirection';

const UnicodeBidiService = require('UnicodeBidiService');

const nullthrows = require('nullthrows');

let bidiService;

const EditorBidiService = {
  getDirectionMap: function(
    content: ContentState,
    prevBidiMap: ?$ReadOnlyMap<string, BidiDirection>,
  ): $ReadOnlyMap<string, BidiDirection> {
    if (!bidiService) {
      bidiService = new UnicodeBidiService();
    } else {
      bidiService.reset();
    }

    const blockMap = content.getBlockMap();
    const bidiMap = new Map();
    let bidiChanged = false;
    for (const [key, block] of blockMap) {
      const direction = nullthrows(bidiService).getDirection(block.getText());
      bidiMap.set(key, direction);
      bidiChanged =
        bidiChanged ||
        (prevBidiMap != null && prevBidiMap.get(key) !== direction);
    }

    if (prevBidiMap != null && !bidiChanged) {
      return prevBidiMap;
    }

    return ((bidiMap: any): $ReadOnlyMap<string, BidiDirection>);
  },
};

module.exports = EditorBidiService;
