/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @legacyServerCallableInstance
 * @format
 * @flow
 * @emails oncall+draft_js
 */

'use strict';

import type {DraftEntityType} from 'DraftEntityType';
import type {DraftEntityMutability} from 'DraftEntityMutability';

const inheritAndUpdate = require('inheritAndUpdate');

type DraftEntityInstanceConfig = {
  // `$Shape` without the spread does not error on missing properties. https://github.com/facebook/flow/issues/5702
  ...$Shape<{
    type: DraftEntityType,
    mutability: DraftEntityMutability,
    data: Object,
  }>,
};

/**
 * An instance of a document entity, consisting of a `type` and relevant
 * `data`, metadata about the entity.
 *
 * For instance, a "link" entity might provide a URI, and a "mention"
 * entity might provide the mentioned user's ID. These pieces of data
 * may be used when rendering the entity as part of a ContentBlock DOM
 * representation. For a link, the data would be used as an href for
 * the rendered anchor. For a mention, the ID could be used to retrieve
 * a hovercard.
 */
class DraftEntityInstance {
  type: DraftEntityType = 'TOKEN';
  mutability: DraftEntityMutability = 'IMMUTABLE';
  data: Object = {};

  constructor(config?: DraftEntityInstanceConfig) {
    Object.assign(this, config);
  }

  getType(): DraftEntityType {
    return this.type;
  }

  getMutability(): DraftEntityMutability {
    return this.mutability;
  }

  getData(): Object {
    return this.data;
  }

  static set(
    instance: DraftEntityInstance,
    put: DraftEntityInstanceConfig,
  ): DraftEntityInstance {
    return inheritAndUpdate(instance, put);
  }
}

module.exports = DraftEntityInstance;
