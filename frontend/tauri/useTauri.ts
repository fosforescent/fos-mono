import { useState, useEffect, useCallback } from 'react';
import {
  DirectoryContents,
  FosDirectoryInfo,
  AppInitInfo,
  getDirectoryContents,
  setDirectory,
  navigateUp,
  readFosConfig,
  listFosFiles,
  openAuthUrl,
  isTauri,
  getAppInitInfo,
  readFosStore,
  writeFosStore,
  initFosDirectory,
  getTargetDirectory,
} from './api';

export function useTauri() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [directoryContents, setDirectoryContents] = useState<DirectoryContents | null>(null);
  const [fosInfo, setFosInfo] = useState<FosDirectoryInfo | null>(null);
  const [fosConfig, setFosConfig] = useState<string | null>(null);
  const [fosFiles, setFosFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // New state for init info and store
  const [initInfo, setInitInfo] = useState<AppInitInfo | null>(null);
  const [storeContent, setStoreContent] = useState<string | null>(null);

  useEffect(() => {
    setIsDesktop(isTauri());
  }, []);

  useEffect(() => {
    if (isDesktop) {
      loadInitialState();
    }
  }, [isDesktop]);

  const loadInitialState = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get app init info which includes target directory, fos directory, and store content
      const info = await getAppInitInfo();
      setInitInfo(info);
      setStoreContent(info.store_content);

      const contents = await getDirectoryContents();
      setDirectoryContents(contents);
      setFosInfo(contents.fos_info);

      if (contents.fos_info.exists) {
        const [config, files] = await Promise.all([
          readFosConfig(),
          listFosFiles(),
        ]);
        setFosConfig(config);
        setFosFiles(files);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const changeDirectory = useCallback(async (path: string) => {
    if (!isDesktop) return;
    setLoading(true);
    setError(null);
    try {
      const contents = await setDirectory(path);
      setDirectoryContents(contents);
      setFosInfo(contents.fos_info);

      if (contents.fos_info.exists) {
        const [config, files] = await Promise.all([
          readFosConfig(),
          listFosFiles(),
        ]);
        setFosConfig(config);
        setFosFiles(files);
      } else {
        setFosConfig(null);
        setFosFiles([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [isDesktop]);

  const goUp = useCallback(async () => {
    if (!isDesktop) return;
    setLoading(true);
    setError(null);
    try {
      const contents = await navigateUp();
      setDirectoryContents(contents);
      setFosInfo(contents.fos_info);

      if (contents.fos_info.exists) {
        const [config, files] = await Promise.all([
          readFosConfig(),
          listFosFiles(),
        ]);
        setFosConfig(config);
        setFosFiles(files);
      } else {
        setFosConfig(null);
        setFosFiles([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [isDesktop]);

  const openBrowserAuth = useCallback(async (authUrl: string) => {
    if (!isDesktop) {
      window.open(authUrl, '_blank');
      return;
    }
    try {
      await openAuthUrl(authUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [isDesktop]);

  const refresh = useCallback(async () => {
    if (!isDesktop) return;
    await loadInitialState();
  }, [isDesktop]);

  // Initialize .fos directory in current location
  const initializeFosDirectory = useCallback(async (path?: string) => {
    if (!isDesktop) return null;
    setLoading(true);
    setError(null);
    try {
      const targetPath = path ?? (directoryContents?.current_path ? `${directoryContents.current_path}/.fos` : null);
      if (!targetPath) {
        throw new Error('No target path for .fos directory');
      }
      const info = await initFosDirectory(targetPath);
      setFosInfo(info);
      await loadInitialState();
      return info;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, [isDesktop, directoryContents]);

  // Save FosStore content
  const saveStore = useCallback(async (content: string) => {
    if (!isDesktop) return;
    setLoading(true);
    setError(null);
    try {
      await writeFosStore(content);
      setStoreContent(content);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [isDesktop]);

  // Reload store content from disk
  const reloadStore = useCallback(async () => {
    if (!isDesktop) return null;
    setLoading(true);
    setError(null);
    try {
      const content = await readFosStore();
      setStoreContent(content);
      return content;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, [isDesktop]);

  return {
    // State
    isDesktop,
    directoryContents,
    fosInfo,
    fosConfig,
    fosFiles,
    loading,
    error,
    initInfo,
    storeContent,
    // Navigation actions
    changeDirectory,
    goUp,
    refresh,
    // Auth
    openBrowserAuth,
    // .fos directory actions
    initializeFosDirectory,
    // Store actions
    saveStore,
    reloadStore,
  };
}
