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

import type {DraftInlineStyle} from 'DraftInlineStyle';

const {EMPTY_STYLE} = require('DraftInlineStyle');
const inheritAndUpdate = require('inheritAndUpdate');

type CharacterMetadataConfig = {
  // `$Shape` without the spread does not error on missing properties. https://github.com/facebook/flow/issues/5702
  ...$Shape<{
    style: DraftInlineStyle,
    entity: ?string,
  }>,
};

const defaultConfig: CharacterMetadataConfig = {
  style: EMPTY_STYLE,
  entity: (null: ?string),
};

function hashDraftInlineStyle(styleSet?: DraftInlineStyle): string {
  if (!styleSet) {
    return '';
  }
  return Array.from(styleSet).join('\n');
}

function hashCharacterMetadataConfig(config: CharacterMetadataConfig): string {
  return hashDraftInlineStyle(config.style) + (config.entity || '');
}

class CharacterMetadata {
  style: DraftInlineStyle;
  entity: ?string;

  constructor(config?: CharacterMetadataConfig) {
    Object.assign(this, defaultConfig, config);
  }

  getStyle(): DraftInlineStyle {
    return this.style;
  }

  getEntity(): ?string {
    return this.entity;
  }

  hasStyle(style: string): boolean {
    return this.getStyle().has(style);
  }

  static EMPTY = new CharacterMetadata();

  static applyStyle(
    record: CharacterMetadata,
    style: string,
  ): CharacterMetadata {
    const newStyle = new Set(record.getStyle());
    newStyle.add(style);
    return CharacterMetadata.set(record, {style: newStyle});
  }

  static removeStyle(
    record: CharacterMetadata,
    style: string,
  ): CharacterMetadata {
    const newStyle = new Set(record.getStyle());
    newStyle.delete(style);
    return CharacterMetadata.set(record, {style: newStyle});
  }

  static applyEntity(
    record: CharacterMetadata,
    entityKey: ?string,
  ): CharacterMetadata {
    return CharacterMetadata.set(
      record,
      record.getEntity() === entityKey ? {} : {entity: entityKey},
    );
  }

  /**
   * Use this function instead of the `CharacterMetadata` constructor.
   * Since most content generally uses only a very small number of
   * style/entity permutations, we can reuse these objects as often as
   * possible.
   */
  static create(config?: CharacterMetadataConfig): CharacterMetadata {
    if (!config) {
      return CharacterMetadata.EMPTY;
    }

    // Fill in unspecified properties, if necessary.
    const mergedConfig: CharacterMetadataConfig = Object.assign(
      {},
      defaultConfig,
      config,
    );

    const poolKey = hashCharacterMetadataConfig(mergedConfig);
    const existing: ?CharacterMetadata = pool.get(poolKey);
    if (existing) {
      return existing;
    }

    const newCharacter = new CharacterMetadata(mergedConfig);
    pool.set(poolKey, newCharacter);
    return newCharacter;
  }

  static set(
    characterMetadata: CharacterMetadata,
    put?: CharacterMetadataConfig,
  ): CharacterMetadata {
    return inheritAndUpdate(characterMetadata, put);
  }
}

const pool: Map<string, CharacterMetadata> = new Map([
  [hashCharacterMetadataConfig(defaultConfig), CharacterMetadata.EMPTY],
]);

module.exports = CharacterMetadata;
