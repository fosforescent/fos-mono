import { FosExpression } from "@fosforescent/shared/dag-implementation/expression";
import { FosStore } from "@fosforescent/shared/dag-implementation/store";
import { FosPath } from "@fosforescent/shared/types";
import { FileGraphLoader } from "./fileGraphLoader.js";

type StoreRunResult<T> = Promise<T>;

export class FileBackedStore {
  static async create(rootDir: string): Promise<FileBackedStore> {
    const loader = await FileGraphLoader.create(rootDir);
    return new FileBackedStore(loader);
  }

  constructor(private readonly loader: FileGraphLoader) {}

  get contextPath(): string {
    return this.loader.contextFilePath;
  }

  get hasPersistentState(): boolean {
    return this.loader.hasExistingContext;
  }

  withStore<T>(
    options: { mutates?: boolean },
    fn: (store: FosStore) => StoreRunResult<T>
  ): StoreRunResult<T> {
    return this.runWithStore(options, fn);
  }

  async getExpressionForRoute(
    route: FosPath
  ): Promise<{ expr: FosExpression; store: FosStore }> {
    const snapshot = await this.loader.loadSnapshot();
    const store = snapshot.data
      ? new FosStore({ fosCtxData: snapshot.data })
      : new FosStore();
    const expr = new FosExpression(store, route);
    return { expr, store };
  }

  private async runWithStore<T>(
    options: { mutates?: boolean },
    fn: (store: FosStore) => StoreRunResult<T>
  ): StoreRunResult<T> {
    const snapshot = await this.loader.loadSnapshot();
    let hash = snapshot.hash;
    const store = snapshot.data
      ? new FosStore({ fosCtxData: snapshot.data })
      : new FosStore();

    if (!snapshot.data) {
      const initialData = store.exportContext(store.fosRoute);
      hash = await this.loader.saveSnapshot(initialData, snapshot.hash);
    }

    const result = await fn(store);
    if (options.mutates) {
      const newData = store.exportContext(store.fosRoute);
      await this.loader.saveSnapshot(newData, hash);
    }
    return result;
  }
}
