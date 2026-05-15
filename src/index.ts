import { readConfig, setUser } from "./config";
import { createUser, getUserByName, getUsers, resetUsers } from "./lib/db/queries/users";
import {
  createFeed,
  createFeedFollow,
  deleteFeedFollowByUserAndFeedUrl,
  getFeedByUrl,
  getFeedFollowsForUser,
  getFeedsWithUsers,
} from "./lib/db/queries/feeds";
import { fetchFeed } from "./rss";
import { feeds, users } from "./schema";

export type CommandHandler = (cmdName: string, ...args: string[]) => Promise<void>;
export type UserCommandHandler = (
  cmdName: string,
  user: User,
  ...args: string[]
) => Promise<void>;
export type middlewareLoggedIn = (handler: UserCommandHandler) => CommandHandler;
export type CommandsRegistry = Record<string, CommandHandler>;
export type Feed = typeof feeds.$inferSelect;
export type User = typeof users.$inferSelect;

const middlewareLoggedIn: middlewareLoggedIn = (handler) => async (cmdName, ...args) => {
  const currentUserName = readConfig().currentUserName;
  if (!currentUserName) {
    throw new Error("No current user is set in the config.");
  }

  const currentUser = await getUserByName(currentUserName);
  if (!currentUser) {
    throw new Error(`Current user '${currentUserName}' does not exist.`);
  }

  await handler(cmdName, currentUser, ...args);
};

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

async function handlerUsers(cmdName: string, ...args: string[]): Promise<void> {
  const currentUserName = readConfig().currentUserName;
  const users = await getUsers();

  users.forEach((user) => {
    const currentTag = user.name === currentUserName ? " (current)" : "";
    console.log(`* ${user.name}${currentTag}`);
  });
}

function printFeed(feed: Feed, user: User): void {
  console.log("Feed created:");
  console.log(`- id: ${feed.id}`);
  console.log(`- name: ${feed.name}`);
  console.log(`- url: ${feed.url}`);
  console.log(`- user_id: ${feed.userId}`);
  console.log(`- created_at: ${feed.createdAt}`);
  console.log(`- updated_at: ${feed.updatedAt}`);
  console.log(`Added by user: ${user.name}`);
}

async function handlerAddFeed(cmdName: string, user: User, ...args: string[]): Promise<void> {
  if (args.length < 2) {
    throw new Error("The addfeed command requires a name and a url.");
  }

  const [feedName, feedUrl] = args;
  const createdFeed = await createFeed(feedName, feedUrl, user.id);
  const feedFollow = await createFeedFollow(user.id, createdFeed.id);
  printFeed(createdFeed, user);
  console.log(`Feed '${feedFollow.feedName}' is now followed by ${feedFollow.userName}`);
}

async function handlerFollow(cmdName: string, user: User, ...args: string[]): Promise<void> {
  if (args.length === 0) {
    throw new Error("The follow command requires a feed url.");
  }

  const feedUrl = args[0];
  const feed = await getFeedByUrl(feedUrl);
  if (!feed) {
    throw new Error(`Feed with url '${feedUrl}' does not exist.`);
  }

  const feedFollow = await createFeedFollow(user.id, feed.id);
  console.log(`Followed feed '${feedFollow.feedName}' as ${feedFollow.userName}`);
}

async function handlerFollowing(cmdName: string, user: User, ...args: string[]): Promise<void> {
  const follows = await getFeedFollowsForUser(user.id);
  follows.forEach((follow) => {
    console.log(`* ${follow.feedName}`);
  });
}

async function handlerUnfollow(cmdName: string, user: User, ...args: string[]): Promise<void> {
  if (args.length === 0) {
    throw new Error("The unfollow command requires a feed url.");
  }

  const feedUrl = args[0];
  const deleted = await deleteFeedFollowByUserAndFeedUrl(user.id, feedUrl);
  if (!deleted) {
    throw new Error(`No follow record found for url '${feedUrl}' and current user.`);
  }

  console.log(`Unfollowed feed '${feedUrl}' for ${user.name}`);
}

async function handlerFeeds(cmdName: string, ...args: string[]): Promise<void> {
  const feeds = await getFeedsWithUsers();
  feeds.forEach((feed) => {
    const creator = feed.creatorName ?? "unknown";
    console.log(`* ${feed.feedName} - ${feed.feedUrl} (added by ${creator})`);
  });
}

async function handlerAgg(cmdName: string, ...args: string[]): Promise<void> {
  const feed = await fetchFeed("https://www.wagslane.dev/index.xml");
  console.log(JSON.stringify(feed, null, 2));
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
  registerCommand(registry, "users", handlerUsers);
  registerCommand(registry, "feeds", handlerFeeds);
  registerCommand(registry, "addfeed", middlewareLoggedIn(handlerAddFeed));
  registerCommand(registry, "follow", middlewareLoggedIn(handlerFollow));
  registerCommand(registry, "following", middlewareLoggedIn(handlerFollowing));
  registerCommand(registry, "unfollow", middlewareLoggedIn(handlerUnfollow));
  registerCommand(registry, "reset", handlerReset);
  registerCommand(registry, "agg", handlerAgg);

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
