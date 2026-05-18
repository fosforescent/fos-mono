/**
 * Tauri API wrapper
 *
 * This module provides Tauri functionality that works in both web and desktop contexts.
 * In web context, these functions throw errors if called (but isTauri() returns false).
 * In desktop context, functions invoke Tauri commands.
 */

// Static import so Vite bundles the Tauri API for desktop builds
import { invoke } from '@tauri-apps/api/core';

export interface FosDirectoryInfo {
  path: string;
  exists: boolean;
  is_fallback: boolean;
}

export interface DirectoryEntry {
  name: string;
  is_directory: boolean;
  path: string;
}

export interface DirectoryContents {
  current_path: string;
  entries: DirectoryEntry[];
  fos_info: FosDirectoryInfo;
}

export interface AppInitInfo {
  target_directory: string;
  fos_directory: string | null;
  fos_exists: boolean;
  store_content: string | null;
}

// Utility to check if running in Tauri
export function isTauri(): boolean {
  return typeof window !== 'undefined' &&
    ('__TAURI__' in window || '__TAURI_INTERNALS__' in window);
}

// Helper that ensures we're in Tauri context before invoking
async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error('Not running in Tauri context');
  }
  return invoke<T>(command, args);
}

// Directory navigation
export async function getCurrentDirectory(): Promise<string> {
  return invokeCommand<string>('get_current_directory');
}

export async function setDirectory(path: string): Promise<DirectoryContents> {
  return invokeCommand<DirectoryContents>('set_directory', { path });
}

export async function getDirectoryContents(): Promise<DirectoryContents> {
  return invokeCommand<DirectoryContents>('get_directory_contents');
}

export async function navigateUp(): Promise<DirectoryContents> {
  return invokeCommand<DirectoryContents>('navigate_up');
}

export async function getHomeDirectory(): Promise<string> {
  return invokeCommand<string>('get_home_directory');
}

// .fos directory operations
export async function checkFosDirectory(): Promise<FosDirectoryInfo> {
  return invokeCommand<FosDirectoryInfo>('check_fos_directory');
}

export async function readFosConfig(): Promise<string | null> {
  return invokeCommand<string | null>('read_fos_config');
}

export async function listFosFiles(): Promise<string[]> {
  return invokeCommand<string[]>('list_fos_files');
}

export async function getTargetDirectory(): Promise<string> {
  return invokeCommand<string>('get_target_directory');
}

export async function getFosDirectory(): Promise<string | null> {
  return invokeCommand<string | null>('get_fos_directory');
}

export async function setFosDirectory(path: string): Promise<void> {
  return invokeCommand<void>('set_fos_directory', { path });
}

export async function initFosDirectory(path: string): Promise<FosDirectoryInfo> {
  return invokeCommand<FosDirectoryInfo>('init_fos_directory', { path });
}

// FosStore operations
export async function readFosStore(): Promise<string | null> {
  return invokeCommand<string | null>('read_fos_store');
}

export async function writeFosStore(content: string): Promise<void> {
  return invokeCommand<void>('write_fos_store', { content });
}

export async function getAppInitInfo(): Promise<AppInitInfo> {
  return invokeCommand<AppInitInfo>('get_app_init_info');
}

// Auth
export async function openAuthUrl(url: string): Promise<void> {
  return invokeCommand<void>('open_auth_url', { url });
}
