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

const ContentState = require('ContentState');
const inheritAndUpdate = require('inheritAndUpdate');

function updateEntityDataInContentState(
  contentState: ContentState,
  key: string,
  data: {[key: string]: any},
  merge: boolean,
): ContentState {
  const instance = contentState.getEntity(key);
  const entityData = instance.getData();
  const entityMap = contentState.getEntityMap();
  const newData = merge ? {...entityData, ...data} : data;

  const newInstance = inheritAndUpdate(instance, {data: newData});
  const newEntityMap = new Map(entityMap);
  newEntityMap.set(key, newInstance);
  return ContentState.set(contentState, {entityMap: newEntityMap});
}

module.exports = updateEntityDataInContentState;
