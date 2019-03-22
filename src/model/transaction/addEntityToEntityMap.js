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

import type DraftEntityInstance from 'DraftEntityInstance';
import type {EntityMap} from 'EntityMap';

let key = 0;

function addEntityToEntityMap(
  entityMap: EntityMap,
  instance: DraftEntityInstance,
): EntityMap {
  const newEntityMap = Object.create(entityMap);
  newEntityMap.set(`${++key}`, instance);
  return newEntityMap;
}

module.exports = addEntityToEntityMap;
