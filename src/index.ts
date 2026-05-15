import { readConfig, setUser } from "./config";
import { createUser, getUserByName, resetUsers } from "./lib/db/queries/users";

export type CommandHandler = (cmdName: string, ...args: string[]) => Promise<void>;
export type CommandsRegistry = Record<string, CommandHandler>;

async function handlerLogin(cmdName: string, ...args: string[]): Promise<void> {
  if (args.length === 0) {
    throw new Error("The login command requires a username.");
  }

  const userName = args[0];
  const user = await getUserByName(userName);
  if (!user) {
    throw new Error(`User '${userName}' does not exist.`);
  }

  const config = readConfig();
  setUser(config, userName);
  console.log(`Current user set to ${userName}`);
}

async function handlerRegister(cmdName: string, ...args: string[]): Promise<void> {
  if (args.length === 0) {
    throw new Error("The register command requires a username.");
  }

  const userName = args[0];
  const existingUser = await getUserByName(userName);
  if (existingUser) {
    throw new Error(`User '${userName}' already exists.`);
  }

  const createdUser = await createUser(userName);
  const config = readConfig();
  setUser(config, userName);

  console.log(`User created: ${userName}`);
  console.log(createdUser);
}

async function handlerReset(cmdName: string, ...args: string[]): Promise<void> {
  await resetUsers();
  console.log("Database reset complete.");
}

function registerCommand(registry: CommandsRegistry, cmdName: string, handler: CommandHandler): void {
  registry[cmdName] = handler;
}

async function runCommand(registry: CommandsRegistry, cmdName: string, ...args: string[]): Promise<void> {
  const handler = registry[cmdName];
  if (!handler) {
    throw new Error(`Unknown command: ${cmdName}`);
  }

  await handler(cmdName, ...args);
}

async function main() {
  const registry: CommandsRegistry = {};
  registerCommand(registry, "login", handlerLogin);
  registerCommand(registry, "register", handlerRegister);
  registerCommand(registry, "reset", handlerReset);

  const inputArgs = process.argv.slice(2);
  if (inputArgs.length === 0) {
    console.error("Error: not enough arguments provided.");
    process.exit(1);
  }

  const [cmdName, ...cmdArgs] = inputArgs;
  try {
    await runCommand(registry, cmdName, ...cmdArgs);
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

main();
