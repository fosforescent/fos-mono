/**
 * FOS URL Scheme
 *
 * Format: fos://[peer-id]/[path]
 *
 * Examples:
 * - fos:///abc123-def456/ghi789-jkl012  (local path)
 * - fos://peer-abc123/abc123-def456/ghi789-jkl012  (peer path)
 * - fos://file/home/user/data.fos  (local file - future)
 *
 * Path segments are edge pairs: instruction-cid/target-cid
 */

import type { FosPath, FosPathElem } from '@fosforescent/shared/types';

export type FosUrlType = 'local' | 'peer' | 'file';

export interface ParsedFosUrl {
  type: FosUrlType;
  peerId?: string;      // For peer URLs
  filePath?: string;    // For file URLs
  path: FosPath;        // The graph path
  raw: string;          // Original URL string
}

/**
 * Parse a fos:// URL into its components
 */
export function parseFosUrl(url: string): ParsedFosUrl | null {
  if (!url.startsWith('fos://')) {
    return null;
  }

  const withoutScheme = url.slice(6); // Remove 'fos://'

  // Local path: fos:///path...
  if (withoutScheme.startsWith('/')) {
    const pathStr = withoutScheme.slice(1); // Remove leading /
    return {
      type: 'local',
      path: parsePathString(pathStr),
      raw: url,
    };
  }

  // Check for file:// prefix
  if (withoutScheme.startsWith('file/')) {
    return {
      type: 'file',
      filePath: withoutScheme.slice(5), // Remove 'file/'
      path: [],
      raw: url,
    };
  }

  // Peer path: fos://peer-id/path...
  const firstSlash = withoutScheme.indexOf('/');
  if (firstSlash === -1) {
    // Just peer ID, no path
    return {
      type: 'peer',
      peerId: withoutScheme,
      path: [],
      raw: url,
    };
  }

  const peerId = withoutScheme.slice(0, firstSlash);
  const pathStr = withoutScheme.slice(firstSlash + 1);

  return {
    type: 'peer',
    peerId,
    path: parsePathString(pathStr),
    raw: url,
  };
}

/**
 * Parse path string into FosPath
 * Path format: instr1-target1/instr2-target2/...
 * Each segment is an edge: [instructionCid, targetCid]
 */
function parsePathString(pathStr: string): FosPath {
  if (!pathStr) return [];

  const segments = pathStr.split('/').filter(s => s);
  const path: FosPath = [];

  for (const segment of segments) {
    const dashIndex = segment.indexOf('-');
    if (dashIndex === -1) {
      // Invalid segment, skip
      continue;
    }
    const instrCid = segment.slice(0, dashIndex);
    const targetCid = segment.slice(dashIndex + 1);
    if (instrCid && targetCid) {
      path.push([instrCid, targetCid]);
    }
  }

  return path;
}

/**
 * Generate a fos:// URL from components
 */
export function generateFosUrl(opts: {
  type: FosUrlType;
  peerId?: string;
  filePath?: string;
  path?: FosPath;
}): string {
  const { type, peerId, filePath, path = [] } = opts;

  const pathStr = path
    .map(([instr, target]) => `${instr}-${target}`)
    .join('/');

  switch (type) {
    case 'local':
      return `fos:///${pathStr}`;
    case 'peer':
      if (!peerId) throw new Error('peerId required for peer URL');
      return pathStr ? `fos://${peerId}/${pathStr}` : `fos://${peerId}`;
    case 'file':
      if (!filePath) throw new Error('filePath required for file URL');
      return `fos://file/${filePath}`;
    default:
      throw new Error(`Unknown URL type: ${type}`);
  }
}

/**
 * Generate a local fos:// URL for the current path
 */
export function generateLocalUrl(path: FosPath): string {
  return generateFosUrl({ type: 'local', path });
}

/**
 * Generate a peer fos:// URL
 */
export function generatePeerUrl(peerId: string, path: FosPath = []): string {
  return generateFosUrl({ type: 'peer', peerId, path });
}

/**
 * Check if a string looks like a fos:// URL
 */
export function isFosUrl(str: string): boolean {
  return str.startsWith('fos://');
}

/**
 * Truncate a peer ID for display
 */
export function truncatePeerId(peerId: string): string {
  if (peerId.length <= 12) return peerId;
  return `${peerId.slice(0, 8)}...`;
}
