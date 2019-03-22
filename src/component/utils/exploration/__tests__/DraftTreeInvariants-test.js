/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails oncall+draft_js
 * @flow strict-local
 * @format
 */

'use strict';

jest.disableAutomock();

// missing parent -> child connection

const ContentBlockNode = require('ContentBlockNode');
const DraftTreeInvariants = require('DraftTreeInvariants');

test('single block', () =>
  expect(
    DraftTreeInvariants.isValidTree(
      new Map([
        [
          'A',
          new ContentBlockNode({
            key: 'A',
            parent: null,
            text: 'Charlie',
            children: [],
            prevSibling: null,
            nextSibling: null,
          }),
        ],
      ]),
    ),
  ).toBe(true));

// valid trees with children and siblings
test('simple valid tree', () =>
  expect(
    DraftTreeInvariants.isValidTree(
      new Map([
        [
          'A',
          new ContentBlockNode({
            key: 'A',
            parent: null,
            text: 'alpha',
            children: [],
            prevSibling: null,
            nextSibling: 'B',
          }),
        ],
        [
          'B',
          new ContentBlockNode({
            key: 'B',
            parent: null,
            text: '',
            children: ['C', 'D'],
            prevSibling: 'A',
            nextSibling: 'E',
          }),
        ],
        [
          'C',
          new ContentBlockNode({
            key: 'C',
            parent: 'B',
            text: 'charlie',
            children: [],
            prevSibling: null,
            nextSibling: 'D',
          }),
        ],
        [
          'D',
          new ContentBlockNode({
            key: 'D',
            parent: 'B',
            text: 'delta',
            children: [],
            prevSibling: 'C',
            nextSibling: null,
          }),
        ],
        [
          'E',
          new ContentBlockNode({
            key: 'E',
            parent: null,
            text: 'epsilon',
            children: [],
            prevSibling: 'B',
            nextSibling: null,
          }),
        ],
      ]),
    ),
  ).toBe(true));

test('complex valid tree', () =>
  expect(
    DraftTreeInvariants.isValidTree(
      new Map([
        [
          'A',
          new ContentBlockNode({
            key: 'A',
            parent: null,
            text: '',
            children: ['B', 'D', 'Z'],
            prevSibling: 'X',
            nextSibling: 'C',
          }),
        ],
        [
          'B',
          new ContentBlockNode({
            key: 'B',
            parent: 'A',
            text: 'beta',
            children: [],
            prevSibling: null,
            nextSibling: 'D',
          }),
        ],
        [
          'C',
          new ContentBlockNode({
            key: 'C',
            parent: null,
            text: 'charlie',
            children: [],
            prevSibling: 'A',
            nextSibling: null,
          }),
        ],
        [
          'D',
          new ContentBlockNode({
            key: 'D',
            parent: 'A',
            text: '',
            children: ['E', 'G', 'F'],
            prevSibling: 'B',
            nextSibling: 'Z',
          }),
        ],
        [
          'E',
          new ContentBlockNode({
            key: 'E',
            parent: 'D',
            text: 'epsilon',
            children: [],
            prevSibling: null,
            nextSibling: 'F',
          }),
        ],
        [
          'F',
          new ContentBlockNode({
            key: 'F',
            parent: 'D',
            text: 'fish',
            children: [],
            prevSibling: 'E',
            nextSibling: 'G',
          }),
        ],
        [
          'G',
          new ContentBlockNode({
            key: 'G',
            parent: 'D',
            text: 'gamma',
            children: [],
            prevSibling: 'F',
            nextSibling: null,
          }),
        ],
        [
          'X',
          new ContentBlockNode({
            key: 'X',
            parent: null,
            text: '',
            children: ['Y'],
            prevSibling: null,
            nextSibling: 'A',
          }),
        ],
        [
          'Y',
          new ContentBlockNode({
            key: 'Y',
            parent: 'X',
            text: 'yeti',
            children: [],
            prevSibling: null,
            nextSibling: null,
          }),
        ],
        [
          'Z',
          new ContentBlockNode({
            key: 'Z',
            parent: 'A',
            text: 'zeta',
            children: [],
            prevSibling: 'D',
            nextSibling: null,
          }),
        ],
      ]),
    ),
  ).toBe(true));

test('missing child -> parent pointer', () =>
  expect(
    DraftTreeInvariants.isValidTree(
      new Map([
        [
          'A',
          new ContentBlockNode({
            key: 'A',
            parent: null,
            text: 'alpha',
            children: [],
            prevSibling: null,
            nextSibling: 'B',
          }),
        ],
        [
          'B',
          new ContentBlockNode({
            key: 'B',
            parent: null,
            text: '',
            children: ['C', 'D'],
            prevSibling: 'A',
            nextSibling: 'E',
          }),
        ],
        [
          'C',
          new ContentBlockNode({
            key: 'C',
            parent: 'B',
            text: 'charlie',
            children: [],
            prevSibling: null,
            nextSibling: 'D',
          }),
        ],
        [
          'D',
          new ContentBlockNode({
            key: 'D',
            parent: null, // should be B
            text: 'delta',
            children: [],
            prevSibling: 'C',
            nextSibling: null,
          }),
        ],
        [
          'E',
          new ContentBlockNode({
            key: 'E',
            parent: null,
            text: 'epsilon',
            children: [],
            prevSibling: 'B',
            nextSibling: null,
          }),
        ],
      ]),
    ),
  ).toBe(false));

test('missing parent -> child pointer', () =>
  expect(
    DraftTreeInvariants.isValidTree(
      new Map([
        [
          'A',
          new ContentBlockNode({
            key: 'A',
            parent: null,
            text: 'alpha',
            children: [],
            prevSibling: null,
            nextSibling: 'B',
          }),
        ],
        [
          'B',
          new ContentBlockNode({
            key: 'B',
            parent: null,
            text: '',
            children: ['C'], // should be [C, D]
            prevSibling: 'A',
            nextSibling: 'E',
          }),
        ],
        [
          'C',
          new ContentBlockNode({
            key: 'C',
            parent: 'B',
            text: 'charlie',
            children: [],
            prevSibling: null,
            nextSibling: 'D',
          }),
        ],
        [
          'D',
          new ContentBlockNode({
            key: 'D',
            parent: 'B',
            text: 'delta',
            children: [],
            prevSibling: 'C',
            nextSibling: null,
          }),
        ],
        [
          'E',
          new ContentBlockNode({
            key: 'E',
            parent: null,
            text: 'epsilon',
            children: [],
            prevSibling: 'B',
            nextSibling: null,
          }),
        ],
      ]),
    ),
  ).toBe(false));

// missing prevSibling
test('missing prev pointer', () =>
  expect(
    DraftTreeInvariants.isValidTree(
      new Map([
        [
          'A',
          new ContentBlockNode({
            key: 'A',
            parent: null,
            text: 'alpha',
            children: [],
            prevSibling: null,
            nextSibling: 'B',
          }),
        ],
        [
          'B',
          new ContentBlockNode({
            key: 'B',
            parent: null,
            text: '',
            children: ['C', 'D'],
            prevSibling: 'A',
            nextSibling: 'E',
          }),
        ],
        [
          'C',
          new ContentBlockNode({
            key: 'C',
            parent: 'B',
            text: 'charlie',
            children: [],
            prevSibling: null,
            nextSibling: 'D',
          }),
        ],
        [
          'D',
          new ContentBlockNode({
            key: 'D',
            parent: 'B',
            text: 'delta',
            children: [],
            prevSibling: null, // should be D
            nextSibling: null,
          }),
        ],
        [
          'E',
          new ContentBlockNode({
            key: 'E',
            parent: null,
            text: 'epsilon',
            children: [],
            prevSibling: 'B',
            nextSibling: null,
          }),
        ],
      ]),
    ),
  ).toBe(false));

// missing nextSibling
test('missing nextSibling pointer', () =>
  expect(
    DraftTreeInvariants.isValidTree(
      new Map([
        [
          'A',
          new ContentBlockNode({
            key: 'A',
            parent: null,
            text: 'alpha',
            children: [],
            prevSibling: null,
            nextSibling: 'B',
          }),
        ],
        [
          'B',
          new ContentBlockNode({
            key: 'B',
            parent: null,
            text: '',
            children: ['C', 'D'],
            prevSibling: 'A',
            nextSibling: null, // should be E
          }),
        ],
        [
          'C',
          new ContentBlockNode({
            key: 'C',
            parent: 'B',
            text: 'charlie',
            children: [],
            prevSibling: null,
            nextSibling: 'D',
          }),
        ],
        [
          'D',
          new ContentBlockNode({
            key: 'D',
            parent: 'B',
            text: 'delta',
            children: [],
            prevSibling: 'C',
            nextSibling: null,
          }),
        ],
        [
          'E',
          new ContentBlockNode({
            key: 'E',
            parent: null,
            text: 'epsilon',
            children: [],
            prevSibling: 'B',
            nextSibling: null,
          }),
        ],
      ]),
    ),
  ).toBe(false));

// two-node cycle C <-> D
test('missing child -> parent connection', () =>
  expect(
    DraftTreeInvariants.isValidTree(
      new Map([
        [
          'A',
          new ContentBlockNode({
            key: 'A',
            parent: null,
            text: 'alpha',
            children: [],
            prevSibling: null,
            nextSibling: 'B',
          }),
        ],
        [
          'B',
          new ContentBlockNode({
            key: 'B',
            parent: null,
            text: '',
            children: ['C', 'D'],
            prevSibling: 'A',
            nextSibling: 'E',
          }),
        ],
        [
          'C',
          new ContentBlockNode({
            key: 'C',
            parent: 'B',
            text: 'charlie',
            children: [],
            prevSibling: 'D', // should be null
            nextSibling: 'D',
          }),
        ],
        [
          'D',
          new ContentBlockNode({
            key: 'D',
            parent: 'B',
            text: 'delta',
            children: [],
            prevSibling: 'C',
            nextSibling: 'C', // should be null
          }),
        ],
        [
          'E',
          new ContentBlockNode({
            key: 'E',
            parent: null,
            text: 'epsilon',
            children: [],
            prevSibling: 'B',
            nextSibling: null,
          }),
        ],
      ]),
    ),
  ).toBe(false));

// leaf has children
test('missing child -> parent connection', () =>
  expect(
    DraftTreeInvariants.isValidTree(
      new Map([
        [
          'A',
          new ContentBlockNode({
            key: 'A',
            parent: null,
            text: 'alpha',
            children: [],
            prevSibling: null,
            nextSibling: 'B',
          }),
        ],
        [
          'B',
          new ContentBlockNode({
            key: 'B',
            parent: null,
            text: '',
            children: ['C', 'D'],
            prevSibling: 'A',
            nextSibling: 'E',
          }),
        ],
        [
          'C',
          new ContentBlockNode({
            key: 'C',
            parent: 'B',
            text: 'charlie', // should be ''
            children: ['F'],
            prevSibling: null,
            nextSibling: 'D',
          }),
        ],
        [
          'D',
          new ContentBlockNode({
            key: 'D',
            parent: 'B',
            text: 'delta',
            children: [],
            prevSibling: 'C',
            nextSibling: null,
          }),
        ],
        [
          'E',
          new ContentBlockNode({
            key: 'E',
            parent: null,
            text: 'epsilon',
            children: [],
            prevSibling: 'B',
            nextSibling: null,
          }),
        ],
        [
          'F',
          new ContentBlockNode({
            key: 'F',
            parent: 'C',
            text: 'fish',
            children: [],
            prevSibling: null,
            nextSibling: null,
          }),
        ],
      ]),
    ),
  ).toBe(false));

// unconnected tree (two clusters not connected by parent-child pointers)
test('unconnected tree', () =>
  expect(
    DraftTreeInvariants.isValidTree(
      new Map([
        [
          'A',
          new ContentBlockNode({
            key: 'A',
            parent: null,
            text: '',
            children: ['B', 'Z'], // should be [B, D, Z]
            prevSibling: 'X',
            nextSibling: 'C',
          }),
        ],
        [
          'B',
          new ContentBlockNode({
            key: 'B',
            parent: 'A',
            text: 'beta',
            children: [],
            prevSibling: null,
            nextSibling: 'Z',
          }),
        ],
        [
          'C',
          new ContentBlockNode({
            key: 'C',
            parent: null,
            text: 'charlie',
            children: [],
            prevSibling: 'A',
            nextSibling: null,
          }),
        ],
        [
          'D',
          new ContentBlockNode({
            key: 'D',
            parent: null,
            text: '',
            children: ['E', 'G', 'F'],
            prevSibling: null,
            nextSibling: null,
          }),
        ],
        [
          'E',
          new ContentBlockNode({
            key: 'E',
            parent: 'D',
            text: 'epsilon',
            children: [],
            prevSibling: null,
            nextSibling: 'F',
          }),
        ],
        [
          'F',
          new ContentBlockNode({
            key: 'F',
            parent: 'D',
            text: 'fish',
            children: [],
            prevSibling: 'E',
            nextSibling: 'G',
          }),
        ],
        [
          'G',
          new ContentBlockNode({
            key: 'G',
            parent: 'D',
            text: 'gamma',
            children: [],
            prevSibling: 'F',
            nextSibling: null,
          }),
        ],
        [
          'X',
          new ContentBlockNode({
            key: 'X',
            parent: null,
            text: '',
            children: ['Y'],
            prevSibling: null,
            nextSibling: 'A',
          }),
        ],
        [
          'Y',
          new ContentBlockNode({
            key: 'Y',
            parent: 'X',
            text: 'yeti',
            children: [],
            prevSibling: null,
            nextSibling: null,
          }),
        ],
        [
          'Z',
          new ContentBlockNode({
            key: 'Z',
            parent: 'A',
            text: 'zeta',
            children: [],
            prevSibling: 'B',
            nextSibling: null,
          }),
        ],
      ]),
    ),
  ).toBe(false));
