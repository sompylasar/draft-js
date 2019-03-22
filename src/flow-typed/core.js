/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @format
 * @flow strict-local
 * @emails oncall+draft_js
 */

// https://github.com/facebook/flow/blob/v0.87.0/lib/core.js#L531-L540
declare class $ReadOnlyMap<K, V> {
  @@iterator: () => Iterator<[K, V]>;
  entries(): Iterator<[K, V]>;
  forEach(
    callbackfn: (value: V, index: K, map: $ReadOnlyMap<K, V>) => mixed,
    thisArg?: any,
  ): void;
  get(key: K): V | void;
  has(key: K): boolean;
  keys(): Iterator<K>;
  size: number;
  values(): Iterator<V>;
}

// https://github.com/facebook/flow/blob/v0.87.0/lib/core.js#L572-L580
declare class $ReadOnlySet<T> {
  @@iterator: () => Iterator<T>;
  entries(): Iterator<[T, T]>;
  forEach(
    callbackfn: (value: T, index: T, set: $ReadOnlySet<T>) => mixed,
    thisArg?: any,
  ): void;
  has(value: T): boolean;
  keys(): Iterator<T>;
  size: number;
  values(): Iterator<T>;
}
