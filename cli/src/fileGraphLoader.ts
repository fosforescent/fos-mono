import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { AppStateLoaded } from "@fosforescent/shared/types";

const CONTEXT_CANDIDATES = [
  "main.yml",
  "main.yaml",
  "context.yml",
  "context.yaml",
  "context.json",
];

type Snapshot = {
  data: AppStateLoaded["data"] | null;
  hash: string | null;
};

export class FileGraphLoader {
  static async create(rootDir: string): Promise<FileGraphLoader> {
    const loader = new FileGraphLoader(rootDir);
    await loader.syncSnapshot();
    return loader;
  }

  readonly rootDir: string;
  private contextPath: string;
  private snapshot: Snapshot = { data: null, hash: null };
  private existingContextFile = false;

  private constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.contextPath = path.join(rootDir, "main.yml");
  }

  get contextFilePath(): string {
    return this.contextPath;
  }

  get hasExistingContext(): boolean {
    return this.existingContextFile && this.snapshot.data !== null;
  }

  async loadSnapshot(): Promise<Snapshot> {
    await this.syncSnapshot();
    return { ...this.snapshot };
  }

  async saveSnapshot(
    data: AppStateLoaded["data"],
    expectedHash: string | null
  ): Promise<string> {
    const currentRaw = await this.readRawFile();
    const currentHash = currentRaw ? this.hashString(currentRaw) : null;

    if (currentHash !== expectedHash) {
      throw new Error(
        "The Fos graph on disk changed before this command completed. Please rerun your action."
      );
    }

    await fs.mkdir(path.dirname(this.contextPath), { recursive: true });
    const serialized = this.serializeData(data);
    await fs.writeFile(this.contextPath, serialized, "utf8");
    const newHash = this.hashString(serialized);
    this.snapshot = { data, hash: newHash };
    this.existingContextFile = true;
    return newHash;
  }

  private async syncSnapshot(): Promise<void> {
    const existingPath = await this.findExistingContext();
    if (existingPath) {
      this.contextPath = existingPath;
      const raw = await this.readRawFile();
      if (!raw) {
        this.snapshot = { data: null, hash: null };
        this.existingContextFile = true;
        return;
      }
      const parsed = this.parseRaw(raw);
      if (this.looksLikeContext(parsed)) {
        this.snapshot = {
          data: parsed as AppStateLoaded["data"],
          hash: this.hashString(raw),
        };
        this.existingContextFile = true;
      } else {
        console.warn(
          `Context file ${existingPath} does not look like a Fos store export. Starting with a new store.`
        );
        this.snapshot = { data: null, hash: this.hashString(raw) };
        this.existingContextFile = true;
      }
      return;
    }

    this.snapshot = { data: null, hash: null };
    this.existingContextFile = false;
  }

  private looksLikeContext(value: unknown): value is AppStateLoaded["data"] {
    if (!value || typeof value !== "object") {
      return false;
    }
    const record = value as Record<string, unknown>;
    return "fosData" in record && "trellisData" in record;
  }

  private parseRaw(raw: string): unknown {
    if (raw.trim().length === 0) {
      return null;
    }
    const ext = path.extname(this.contextPath).toLowerCase();
    if (ext === ".json") {
      return JSON.parse(raw);
    }
    return YAML.parse(raw);
  }

  private serializeData(data: AppStateLoaded["data"]): string {
    const ext = path.extname(this.contextPath).toLowerCase();
    if (ext === ".json") {
      return JSON.stringify(data, null, 2);
    }
    return YAML.stringify(data);
  }

  private async readRawFile(): Promise<string | null> {
    try {
      const raw = await fs.readFile(this.contextPath, "utf8");
      return raw;
    } catch (error: any) {
      if (error && error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  private hashString(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex");
  }

  private async findExistingContext(): Promise<string | null> {
    for (const relative of CONTEXT_CANDIDATES) {
      const candidate = path.join(this.rootDir, relative);
      if (await this.fileExists(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  private async fileExists(candidate: string): Promise<boolean> {
    try {
      await fs.access(candidate);
      return true;
    } catch {
      return false;
    }
  }
}
