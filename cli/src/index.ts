import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import kleur from "kleur";
import { FileBackedStore } from "./fileBackedStore.js";
import { FosCliRepl } from "./repl.js";

type Command = "launch" | "repl" | "init" | "help";

type CliOptions = {
  command: Command;
  targetDir: string;
  fosDir: string;
};

function parseArgs(argv: string[]): CliOptions {
  const args = [...argv];
  let command: Command = "launch"; // Default: launch GUI
  let targetDir = process.cwd();
  let fosDir: string | null = null;

  // Check for explicit command
  if (args.length > 0) {
    const first = args[0];
    if (first === "repl") {
      command = "repl";
      args.shift();
    } else if (first === "init" || first === "--init") {
      command = "init";
      args.shift();
    } else if (first === "help" || first === "--help" || first === "-h") {
      command = "help";
      args.shift();
    } else if (first === "." || first.startsWith("/") || first.startsWith("~") || first.startsWith("./")) {
      // Path argument - resolve it as target directory
      targetDir = path.resolve(process.cwd(), first.replace(/^~/, process.env.HOME || "~"));
      args.shift();
    }
  }

  // Process remaining flags
  while (args.length > 0) {
    const current = args.shift();
    if (!current) break;
    if ((current === "--dir" || current === "-d") && args.length > 0) {
      const supplied = args.shift();
      if (supplied) {
        fosDir = path.resolve(process.cwd(), supplied);
      }
    }
  }

  // Check environment variable
  const envDir = process.env.FOS_DIR
    ? path.resolve(process.cwd(), process.env.FOS_DIR)
    : null;

  // Determine .fos directory using fallback chain
  if (!fosDir) {
    fosDir = envDir ?? findFosDir(targetDir);
  }

  return { command, targetDir, fosDir };
}

/**
 * Find .fos directory using fallback chain:
 * 1. Current/target directory
 * 2. Walk up parent directories
 * 3. Home directory (~/.fos)
 */
function findFosDir(startDir: string): string {
  // Check target directory and parents
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, ".fos");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  // Fallback to ~/.fos
  const homeFos = path.join(process.env.HOME || "~", ".fos");
  if (existsSync(homeFos)) {
    return homeFos;
  }

  // Default to target directory (will be created on init)
  return path.join(startDir, ".fos");
}

function printHelp(): void {
  console.log(`
${kleur.bold("fos")} - Fosforescent workflow CLI

${kleur.bold("USAGE:")}
  fos [path]           Launch GUI in the specified directory (default: .)
  fos repl             Start interactive REPL
  fos init             Initialize .fos directory in current folder
  fos help             Show this help message

${kleur.bold("OPTIONS:")}
  -d, --dir <path>     Specify .fos directory location
  -h, --help           Show help

${kleur.bold("EXAMPLES:")}
  fos .                Launch GUI in current directory
  fos ~/project        Launch GUI in ~/project
  fos repl             Start REPL for navigating the graph
  fos init             Create .fos directory here
`);
}

async function initFosDir(fosDir: string): Promise<void> {
  if (existsSync(fosDir)) {
    console.log(kleur.yellow(`Directory already exists: ${fosDir}`));
    return;
  }

  console.log(kleur.cyan(`Creating .fos directory: ${fosDir}`));
  mkdirSync(fosDir, { recursive: true });

  // Create initial config
  const configPath = path.join(fosDir, "config.json");
  writeFileSync(configPath, JSON.stringify({
    version: "0.1.0",
    created: new Date().toISOString(),
  }, null, 2));

  console.log(kleur.green(`✓ Initialized .fos directory at ${fosDir}`));
  console.log(kleur.gray(`  Run 'fos .' to launch the GUI`));
}

async function launchGui(targetDir: string, fosDir: string): Promise<void> {
  console.log(kleur.cyan(`Launching Fosforescent GUI...`));
  console.log(kleur.gray(`  Target directory: ${targetDir}`));
  console.log(kleur.gray(`  .fos directory: ${fosDir}`));

  // Find the Tauri binary
  const desktopDir = path.resolve(__dirname, "../../desktop");
  const tauriDevScript = path.join(desktopDir, "node_modules/.bin/tauri");

  // Set environment variables for Tauri to pick up
  const env = {
    ...process.env,
    FOS_TARGET_DIR: targetDir,
    FOS_DIR: fosDir,
  };

  // Check if we have a built binary or need to run dev mode
  const releaseBinary = path.join(desktopDir, "src-tauri/target/release/fosforescent-desktop");
  const debugBinary = path.join(desktopDir, "src-tauri/target/debug/fosforescent-desktop");

  let binaryPath: string | null = null;
  if (existsSync(releaseBinary)) {
    binaryPath = releaseBinary;
  } else if (existsSync(debugBinary)) {
    binaryPath = debugBinary;
  }

  if (binaryPath) {
    // Launch the built binary
    console.log(kleur.gray(`  Using binary: ${binaryPath}`));
    const child = spawn(binaryPath, [], {
      env,
      stdio: "inherit",
      detached: true,
    });
    child.unref();
    console.log(kleur.green(`✓ Fosforescent launched`));
  } else if (existsSync(tauriDevScript)) {
    // Run tauri dev
    console.log(kleur.yellow(`No built binary found. Running in development mode...`));
    const child = spawn("npm", ["run", "dev"], {
      cwd: desktopDir,
      env,
      stdio: "inherit",
    });
    child.on("error", (err) => {
      console.error(kleur.red(`Failed to start: ${err.message}`));
      process.exit(1);
    });
  } else {
    console.error(kleur.red(`Desktop app not found. Please build it first:`));
    console.error(kleur.gray(`  cd desktop && npm run build`));
    process.exit(1);
  }
}

async function runRepl(fosDir: string): Promise<void> {
  console.log(kleur.gray(`Using Fos graph directory: ${fosDir}`));

  try {
    const fileStore = await FileBackedStore.create(fosDir);
    const repl = new FosCliRepl(fileStore);
    await repl.start();
  } catch (error) {
    console.error(kleur.red(`fos REPL failed: ${(error as Error).message}`));
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const { command, targetDir, fosDir } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "help":
      printHelp();
      break;
    case "init":
      await initFosDir(fosDir);
      break;
    case "repl":
      await runRepl(fosDir);
      break;
    case "launch":
    default:
      await launchGui(targetDir, fosDir);
      break;
  }
}

await main();
