import { readConfig, setUser } from "./config";
import { createUser, getUserByName, getUsers, resetUsers } from "./lib/db/queries/users";
import {
  createFeed,
  createFeedFollow,
  deleteFeedFollowByUserAndFeedUrl,
  getFeedByUrl,
  getFeedFollowsForUser,
  getFeedsWithUsers,
  getNextFeedToFetch,
  markFeedFetched,
} from "./lib/db/queries/feeds";
import { createPost, getPostByUrl, getPostsForUser } from "./lib/db/queries/posts";
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

async function handlerBrowse(cmdName: string, user: User, ...args: string[]): Promise<void> {
  const limit = args.length > 0 ? Number(args[0]) : 2;
  if (Number.isNaN(limit) || limit <= 0) {
    throw new Error("Browse limit must be a positive number.");
  }

  const posts = await getPostsForUser(user.id, limit);
  posts.forEach((post) => {
    console.log(`* [${post.feedName}] ${post.title}`);
    console.log(`  ${post.url}`);
    if (post.description) {
      console.log(`  ${post.description}`);
    }
    console.log(`  published_at: ${post.publishedAt}`);
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

function parseDuration(durationStr: string): number {
  const regex = /^(\d+)(ms|s|m|h)$/;
  const match = durationStr.match(regex);
  if (!match) {
    throw new Error("Invalid duration string. Use formats like 1s, 1m, 1h, or 100ms.");
  }

  const value = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case "ms":
      return value;
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    default:
      throw new Error("Unsupported duration unit.");
  }
}

function parsePublishedAt(publishedAt: string): Date {
  const parsed = new Date(publishedAt);
  if (Number.isNaN(parsed.valueOf())) {
    console.warn(`Warning: could not parse publishedAt '${publishedAt}', using current time.`);
    return new Date();
  }
  return parsed;
}

async function scrapeFeeds(): Promise<void> {
  const nextFeed = await getNextFeedToFetch();
  if (!nextFeed) {
    console.log("No feeds available to fetch.");
    return;
  }

  console.log(`Fetching feed: ${nextFeed.name} (${nextFeed.url})`);
  await markFeedFetched(nextFeed.id);

  const feedData = await fetchFeed(nextFeed.url);
  for (const item of feedData.channel.item) {
    const existingPost = await getPostByUrl(item.link);
    if (existingPost) {
      continue;
    }

    const publishedAt = parsePublishedAt(item.pubDate);
    const createdPost = await createPost(
      item.title,
      item.link,
      item.description,
      publishedAt,
      nextFeed.id,
    );
    console.log(`Saved post: ${createdPost.title}`);
  }
}

async function handlerAgg(cmdName: string, ...args: string[]): Promise<void> {
  if (args.length === 0) {
    throw new Error("The agg command requires a time_between_reqs argument.");
  }

  const durationStr = args[0];
  const intervalMs = parseDuration(durationStr);
  console.log(`Collecting feeds every ${durationStr}`);

  const handleError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error scraping feeds: ${message}`);
  };

  await scrapeFeeds();

  const interval = setInterval(() => {
    scrapeFeeds().catch(handleError);
  }, intervalMs);

  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      console.log("Shutting down feed aggregator...");
      clearInterval(interval);
      resolve();
    });
  });
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
  registerCommand(registry, "browse", middlewareLoggedIn(handlerBrowse));
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
