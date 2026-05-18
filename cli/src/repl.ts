import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import kleur from "kleur";
import { FosPath } from "@fosforescent/shared/types";
import { FosExpression } from "@fosforescent/shared/dag-implementation/expression";
import { FosStore } from "@fosforescent/shared/dag-implementation/store";
import { FileBackedStore } from "./fileBackedStore.js";

export class FosCliRepl {
  private currentRoute: FosPath;
  private exitRequested = false;
  private promptPath = "/";

  constructor(private readonly fileStore: FileBackedStore) {
    this.currentRoute = [];
  }

  async start(): Promise<void> {
    await this.ensureStartingState();
    await this.showRootSummary();
    await this.refreshPromptPath();

    const rl = readline.createInterface({
      input: stdin,
      output: stdout,
      terminal: true,
    });

    rl.on("SIGINT", () => {
      this.exitRequested = true;
      rl.close();
    });

    try {
      while (!this.exitRequested) {
        const input = await rl
          .question(this.buildPrompt())
          .catch(() => undefined);
        if (input === undefined) {
          break;
        }
        const trimmed = input.trim();
        if (!trimmed) {
          continue;
        }
        await this.handleCommand(trimmed);
      }
    } finally {
      rl.close();
      stdout.write("\n");
    }
  }

  private async ensureStartingState(): Promise<void> {
    if (!this.fileStore.hasPersistentState) {
      console.warn(
        kleur.yellow(
          "No serialized Fos store found in .fos/. A new store will be created."
        )
      );
    }
  }

  private buildPrompt(): string {
    return kleur.cyan(`fos(${this.promptPath})> `);
  }

  private async handleCommand(input: string): Promise<void> {
    const [cmd, ...rest] = input.split(" ");
    const arg = rest.join(" ").trim();

    switch (cmd) {
      case "ls":
        await this.commandLs();
        break;
      case "cd":
        await this.commandCd(arg);
        break;
      case "pwd":
        await this.commandPwd();
        break;
      case "help":
        this.printHelp();
        break;
      case "exit":
      case "quit":
      case "q":
        this.exitRequested = true;
        break;
      default:
        console.log(kleur.yellow(`Unknown command "${cmd}". Type "help".`));
    }
  }

  private async commandLs(): Promise<void> {
    const { expr } = await this.getExpressionForRoute(this.currentRoute);
    const children = expr.getTargetChildren();
    if (children.length === 0) {
      console.log(kleur.gray("(no child scopes)"));
      return;
    }

    children.forEach((child, index) => {
      const label = this.expressionLabel(child);
      const instruction = this.nodeLabel(child.instructionNode.getData().description?.content, child.instructionNode.getId());
      const targetId = child.targetNode.getId().slice(0, 10);
      const childIndicator = child.hasChildren() ? kleur.green(">") : "-";
      console.log(
        `${kleur.bold(String(index).padStart(2))} ${childIndicator} ${kleur.white(
          label
        )} ${kleur.gray(`[${instruction}]`)} ${kleur.gray(`#${targetId}`)}`
      );
    });
  }

  private async commandCd(arg: string): Promise<void> {
    if (!arg) {
      console.log(kleur.yellow("Usage: cd <..|/|index|match>"));
      return;
    }
    if (arg === "/") {
      this.currentRoute = [];
      return this.refreshPromptPath();
    }
    if (arg === "..") {
      if (this.currentRoute.length > 0) {
        this.currentRoute = this.currentRoute.slice(0, -1);
      }
      return this.refreshPromptPath();
    }

    const { expr, store } = await this.getExpressionForRoute(this.currentRoute);
    const children = expr.getTargetChildren();
    if (children.length === 0) {
      console.log(kleur.yellow("No child scopes to enter."));
      return;
    }

    const match = this.matchChild(children, arg);
    if (!match) {
      console.log(
        kleur.yellow(`Could not find child matching "${arg}". Try running ls.`)
      );
      return;
    }
    this.currentRoute = match.route;
    await this.refreshPromptPath();
  }

  private async commandPwd(): Promise<void> {
    console.log(this.promptPath);
  }

  private printHelp(): void {
    console.log(
      [
        "Available commands:",
        "  ls            List child scopes",
        "  cd <target>   Enter a child scope by index, id prefix, or name",
        "  cd ..         Go up one scope",
        "  cd /          Jump to the root scope",
        "  pwd           Print the current scope route",
        "  help          Show this message",
        "  exit | quit   Leave the CLI",
      ].join("\n")
    );
  }

  private async refreshPromptPath(): Promise<void> {
    if (this.currentRoute.length === 0) {
      this.promptPath = "/";
      return;
    }
    const segments: string[] = [];
    for (let i = 0; i < this.currentRoute.length; i++) {
      const subRoute = this.currentRoute.slice(0, i + 1);
      const { expr } = await this.getExpressionForRoute(subRoute);
      segments.push(this.expressionLabel(expr));
    }
    this.promptPath = "/" + segments.join("/");
  }

  private async showRootSummary(): Promise<void> {
    await this.fileStore.withStore({ mutates: false }, async (store) => {
      const rootExpr = new FosExpression(store, []);
      const description = rootExpr.getDescription() || "(no description)";
      const childCount = rootExpr.getTargetChildren().length;
      console.log(
        kleur.green(
          `Root: ${description} [${rootExpr.targetNode.getId()}], ${childCount} child scopes`
        )
      );
    });
  }

  private async getExpressionForRoute(route: FosPath): Promise<{
    expr: FosExpression;
    store: FosStore;
  }> {
    return this.fileStore.getExpressionForRoute(route);
  }

  private expressionLabel(expr: FosExpression): string {
    const description = expr.getDescription();
    if (description) {
      return description;
    }
    const nodeDescription =
      expr.targetNode.getData().description?.content ?? expr.expressionType();
    return nodeDescription;
  }

  private nodeLabel(description: string | undefined, fallback: string): string {
    if (description) {
      return description;
    }
    return fallback.slice(0, 8);
  }

  private matchChild(
    children: FosExpression[],
    arg: string
  ): FosExpression | null {
    const exact = children.find(
      (child) =>
        child.targetNode.getId() === arg ||
        child.instructionNode.getId() === arg ||
        this.expressionLabel(child) === arg
    );
    if (exact) {
      return exact;
    }

    const asNumber = Number(arg);
    if (!Number.isNaN(asNumber) && Number.isInteger(asNumber)) {
      const byIndex = children[asNumber];
      if (byIndex) {
        return byIndex;
      }
    }

    const normalized = arg.toLowerCase();

    const byIdMatches = children.filter(
      (child) =>
        child.targetNode.getId().startsWith(arg) ||
        child.instructionNode.getId().startsWith(arg)
    );
    if (byIdMatches.length === 1) {
      return byIdMatches[0] ?? null;
    }

    const byDescription = children.filter((child) =>
      this.expressionLabel(child).toLowerCase().includes(normalized)
    );
    if (byDescription.length === 1) {
      return byDescription[0] ?? null;
    }
    return null;
  }
}
