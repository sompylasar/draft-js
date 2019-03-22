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

const inheritAndUpdate = require('inheritAndUpdate');

export type SelectionStateConfig = {
  // `$Shape` without the spread does not error on missing properties. https://github.com/facebook/flow/issues/5702
  ...$Shape<{
    anchorKey: string,
    anchorOffset: number,
    focusKey: string,
    focusOffset: number,
    isBackward: boolean,
    hasFocus: boolean,
  }>,
};

class SelectionState {
  anchorKey: string = '';
  anchorOffset: number = 0;
  focusKey: string = '';
  focusOffset: number = 0;
  isBackward: boolean = false;
  hasFocus: boolean = false;

  constructor(config?: SelectionStateConfig) {
    Object.assign(this, config);
  }

  serialize(): string {
    return (
      'Anchor: ' +
      this.getAnchorKey() +
      ':' +
      this.getAnchorOffset() +
      ', ' +
      'Focus: ' +
      this.getFocusKey() +
      ':' +
      this.getFocusOffset() +
      ', ' +
      'Is Backward: ' +
      String(this.getIsBackward()) +
      ', ' +
      'Has Focus: ' +
      String(this.getHasFocus())
    );
  }

  toJS() {
    return {
      anchorKey: this.anchorKey,
      anchorOffset: this.anchorOffset,
      focusKey: this.focusKey,
      focusOffset: this.focusOffset,
      isBackward: this.isBackward,
      hasFocus: this.hasFocus,
    };
  }

  getAnchorKey(): string {
    return this.anchorKey;
  }

  getAnchorOffset(): number {
    return this.anchorOffset;
  }

  getFocusKey(): string {
    return this.focusKey;
  }

  getFocusOffset(): number {
    return this.focusOffset;
  }

  getIsBackward(): boolean {
    return this.isBackward;
  }

  getHasFocus(): boolean {
    return this.hasFocus;
  }

  /**
   * Return whether the specified range overlaps with an edge of the
   * SelectionState.
   */
  hasEdgeWithin(blockKey: string, start: number, end: number): boolean {
    const anchorKey = this.getAnchorKey();
    const focusKey = this.getFocusKey();

    if (anchorKey === focusKey && anchorKey === blockKey) {
      const selectionStart = this.getStartOffset();
      const selectionEnd = this.getEndOffset();
      return (
        (start <= selectionStart && selectionStart <= end) || // selectionStart is between start and end, or
        (start <= selectionEnd && selectionEnd <= end) // selectionEnd is between start and end
      );
    }

    if (blockKey !== anchorKey && blockKey !== focusKey) {
      return false;
    }

    const offsetToCheck =
      blockKey === anchorKey ? this.getAnchorOffset() : this.getFocusOffset();

    return start <= offsetToCheck && end >= offsetToCheck;
  }

  isCollapsed(): boolean {
    return (
      this.getAnchorKey() === this.getFocusKey() &&
      this.getAnchorOffset() === this.getFocusOffset()
    );
  }

  getStartKey(): string {
    return this.getIsBackward() ? this.getFocusKey() : this.getAnchorKey();
  }

  getStartOffset(): number {
    return this.getIsBackward()
      ? this.getFocusOffset()
      : this.getAnchorOffset();
  }

  getEndKey(): string {
    return this.getIsBackward() ? this.getAnchorKey() : this.getFocusKey();
  }

  getEndOffset(): number {
    return this.getIsBackward()
      ? this.getAnchorOffset()
      : this.getFocusOffset();
  }

  merge(put: $Shape<SelectionStateConfig>): SelectionState {
    return inheritAndUpdate(this, put);
  }

  static createEmpty(key?: string): SelectionState {
    return new SelectionState({
      anchorKey: key || '',
      anchorOffset: 0,
      focusKey: key || '',
      focusOffset: 0,
      isBackward: false,
      hasFocus: false,
    });
  }

  static set(
    selectionState: SelectionState,
    put: $Shape<SelectionStateConfig>,
  ): SelectionState {
    return inheritAndUpdate(selectionState, put);
  }
}

module.exports = SelectionState;
