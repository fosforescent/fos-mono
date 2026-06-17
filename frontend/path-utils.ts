/**
 * Path Utilities
 *
 * Simple utilities for working with FosPath arrays.
 */

import { FosPath } from '@fosforescent/shared/types';

export const pathEqual = (a: FosPath, b: FosPath): boolean => {
  if (a.length !== b.length) return false;
  return a.every((elem, i) => elem[0] === b[i]?.[0] && elem[1] === b[i]?.[1]);
};

export const isAncestor = (ancestor: FosPath, descendant: FosPath): boolean => {
  if (ancestor.length >= descendant.length) return false;
  return ancestor.every((elem, i) => elem[0] === descendant[i]?.[0] && elem[1] === descendant[i]?.[1]);
};

export const pathToKey = (path: FosPath): string =>
  path.map(([a, b]) => `${a}:${b}`).join('/');
