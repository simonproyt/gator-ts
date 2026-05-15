import { readConfig, setUser } from "./config";

export type CommandHandler = (cmdName: string, ...args: string[]) => void;
export type CommandsRegistry = Record<string, CommandHandler>;

function handlerLogin(cmdName: string, ...args: string[]): void {
  if (args.length === 0) {
    throw new Error("The login command requires a username.");
  }

  const userName = args[0];
  const config = readConfig();
  setUser(config, userName);
  console.log(`Current user set to ${userName}`);
}

function registerCommand(registry: CommandsRegistry, cmdName: string, handler: CommandHandler): void {
  registry[cmdName] = handler;
}

function runCommand(registry: CommandsRegistry, cmdName: string, ...args: string[]): void {
  const handler = registry[cmdName];
  if (!handler) {
    throw new Error(`Unknown command: ${cmdName}`);
  }

  handler(cmdName, ...args);
}

function main() {
  const registry: CommandsRegistry = {};
  registerCommand(registry, "login", handlerLogin);

  const inputArgs = process.argv.slice(2);
  if (inputArgs.length === 0) {
    console.error("Error: not enough arguments provided.");
    process.exit(1);
  }

  const [cmdName, ...cmdArgs] = inputArgs;
  try {
    runCommand(registry, cmdName, ...cmdArgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

main();
