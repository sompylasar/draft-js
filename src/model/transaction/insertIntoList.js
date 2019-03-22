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

/**
 * Maintain persistence for target list when appending and prepending.
 */
function insertIntoList<T>(
  targetList: $ReadOnlyArray<T>,
  toInsert: $ReadOnlyArray<T>,
  offset: number,
): $ReadOnlyArray<T> {
  let returnList: Array<T>;
  if (offset === targetList.length) {
    returnList = [...targetList];
    toInsert.forEach(c => {
      returnList.push(c);
    });
  } else if (offset === 0) {
    returnList = [...targetList];
    [...toInsert].reverse().forEach(c => {
      returnList.unshift(c);
    });
  } else {
    const head = targetList.slice(0, offset);
    const tail = targetList.slice(offset);
    returnList = head.concat(toInsert, tail);
  }
  return returnList;
}

module.exports = insertIntoList;
