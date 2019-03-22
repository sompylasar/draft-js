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

import type {DraftBlockType} from 'DraftBlockType';
import type {EntityRange} from 'EntityRange';
import type {InlineStyleRange} from 'InlineStyleRange';

/**
 * A plain object representation of a ContentBlock, with all style and entity
 * attribution repackaged as range objects.
 */
export type RawDraftContentBlock = {
  key: ?string,
  type: DraftBlockType,
  text: string,
  depth: ?number,
  inlineStyleRanges: ?$ReadOnlyArray<InlineStyleRange>,
  entityRanges: ?$ReadOnlyArray<EntityRange>,
  data?: Object,
  children?: $ReadOnlyArray<RawDraftContentBlock>,
};
