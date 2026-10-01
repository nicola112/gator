import {
  setUser,
  readConfig,
} from "./config.js";

import {
  fetchFeed,
} from "./rss.js";

import {
  createUser,
  getUserByName,
  deleteAllUsers,
  listUsers,
} from "./lib/db/queries/users.js";

import {
  createFeed,
  getFeedByURL,
  getFeeds,
  getNextFeedToFetch,
  markFeedFetched,
} from "./lib/db/queries/feeds.js";

import {
  createFeedFollow,
  getFeedFollowsForUser,
  deleteFeedFollow,
} from "./lib/db/queries/feedFollows.js";

import {
  createPost,
  getPostsForUser,
} from "./lib/db/queries/posts.js";

import type {
  Feed,
  User,
} from "./lib/db/schema.js";


// ========================================
// TYPES
// ========================================

type CommandHandler = (
  cmdName: string,
  ...args: string[]
) => Promise<void>;

type UserCommandHandler = (
  cmdName: string,
  user: User,
  ...args: string[]
) => Promise<void>;

type CommandsRegistry = {
  [key: string]: CommandHandler;
};


// ========================================
// MIDDLEWARE
// ========================================

function middlewareLoggedIn(
  handler: UserCommandHandler
): CommandHandler {
  return async (
    cmdName: string,
    ...args: string[]
  ): Promise<void> => {
    const config = readConfig();

    if (!config.currentUserName) {
      throw new Error(
        "No user is currently logged in"
      );
    }

    const user = await getUserByName(
      config.currentUserName
    );

    if (!user) {
      throw new Error(
        `User ${config.currentUserName} not found`
      );
    }

    await handler(
      cmdName,
      user,
      ...args
    );
  };
}


// ========================================
// REGISTER / RUN COMMANDS
// ========================================

function registerCommand(
  registry: CommandsRegistry,
  cmdName: string,
  handler: CommandHandler
): void {
  registry[cmdName] = handler;
}

async function runCommand(
  registry: CommandsRegistry,
  cmdName: string,
  ...args: string[]
): Promise<void> {
  const handler = registry[cmdName];

  if (!handler) {
    throw new Error(
      `unknown command: ${cmdName}`
    );
  }

  await handler(
    cmdName,
    ...args
  );
}


// ========================================
// LOGIN
// ========================================

async function handlerLogin(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  if (args.length === 0) {
    throw new Error(
      "username is required"
    );
  }

  const username = args[0];

  const user =
    await getUserByName(username);

  if (!user) {
    throw new Error(
      `user ${username} does not exist`
    );
  }

  setUser(username);

  console.log(
    `User set to ${username}`
  );
}


// ========================================
// REGISTER
// ========================================

async function handlerRegister(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  if (args.length === 0) {
    throw new Error(
      "username is required"
    );
  }

  const username = args[0];

  const existingUser =
    await getUserByName(username);

  if (existingUser) {
    throw new Error(
      `user ${username} already exists`
    );
  }

  const user =
    await createUser(username);

  setUser(username);

  console.log(
    `User ${username} created`
  );

  console.log(user);
}


// ========================================
// RESET
// ========================================

async function handlerReset(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  await deleteAllUsers();

  console.log(
    "Database reset successful"
  );
}


// ========================================
// USERS
// ========================================

async function handlerUsers(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  const allUsers =
    await listUsers();

  const config =
    readConfig();

  for (const user of allUsers) {
    if (
      user.name ===
      config.currentUserName
    ) {
      console.log(
        `* ${user.name} (current)`
      );
    } else {
      console.log(
        `* ${user.name}`
      );
    }
  }
}


// ========================================
// PRINT FEED
// ========================================

function printFeed(
  feed: Feed,
  user: User
): void {
  console.log(
    `Feed ID: ${feed.id}`
  );

  console.log(
    `Created At: ${feed.createdAt}`
  );

  console.log(
    `Updated At: ${feed.updatedAt}`
  );

  console.log(
    `Name: ${feed.name}`
  );

  console.log(
    `URL: ${feed.url}`
  );

  console.log(
    `User: ${user.name}`
  );
}


// ========================================
// ADD FEED
// ========================================

async function handlerAddFeed(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length < 2) {
    throw new Error(
      "feed name and URL are required"
    );
  }

  const name = args[0];
  const url = args[1];

  const feed =
    await createFeed(
      name,
      url,
      user.id
    );

  const follow =
    await createFeedFollow(
      user.id,
      feed.id
    );

  printFeed(
    feed,
    user
  );

  console.log(
    `${follow.userName} is now following ${follow.feedName}`
  );
}


// ========================================
// FEEDS
// ========================================

async function handlerFeeds(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  const allFeeds =
    await getFeeds();

  for (const feed of allFeeds) {
    console.log(
      `Name: ${feed.name}`
    );

    console.log(
      `URL: ${feed.url}`
    );

    console.log(
      `Created by: ${feed.userName}`
    );

    console.log();
  }
}


// ========================================
// FOLLOW
// ========================================

async function handlerFollow(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length < 1) {
    throw new Error(
      "feed URL is required"
    );
  }

  const url = args[0];

  const feed =
    await getFeedByURL(url);

  if (!feed) {
    throw new Error(
      "feed not found"
    );
  }

  const follow =
    await createFeedFollow(
      user.id,
      feed.id
    );

  console.log(
    `${follow.userName} is now following ${follow.feedName}`
  );
}


// ========================================
// UNFOLLOW
// ========================================

async function handlerUnfollow(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length < 1) {
    throw new Error(
      "feed URL is required"
    );
  }

  const url = args[0];

  const feed =
    await getFeedByURL(url);

  if (!feed) {
    throw new Error(
      "feed not found"
    );
  }

  const deleted =
    await deleteFeedFollow(
      user.id,
      feed.id
    );

  if (!deleted) {
    throw new Error(
      `you are not following ${feed.name}`
    );
  }

  console.log(
    `${user.name} unfollowed ${feed.name}`
  );
}


// ========================================
// FOLLOWING
// ========================================

async function handlerFollowing(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  const follows =
    await getFeedFollowsForUser(
      user.id
    );

  for (const follow of follows) {
    console.log(
      follow.feedName
    );
  }
}


// ========================================
// DURATION
// ========================================

function parseDuration(
  durationStr: string
): number {
  const regex =
    /^(\d+)(ms|s|m|h)$/;

  const match =
    durationStr.match(regex);

  if (!match) {
    throw new Error(
      "invalid duration: use ms, s, m, or h"
    );
  }

  const value =
    Number(match[1]);

  const unit =
    match[2];

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
      throw new Error(
        "invalid duration"
      );
  }
}


function formatDuration(
  milliseconds: number
): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }

  const totalSeconds =
    Math.floor(
      milliseconds / 1000
    );

  const hours =
    Math.floor(
      totalSeconds / 3600
    );

  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60
    );

  const seconds =
    totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h${minutes}m${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m${seconds}s`;
  }

  return `${seconds}s`;
}


// ========================================
// SCRAPE FEEDS
// ========================================

async function scrapeFeeds():
Promise<void> {
  const feed =
    await getNextFeedToFetch();

  if (!feed) {
    console.log(
      "No feeds to fetch"
    );

    return;
  }

  console.log(
    `Fetching ${feed.name} from ${feed.url}`
  );

  const rssFeed =
    await fetchFeed(feed.url);

  await markFeedFetched(
    feed.id
  );

  for (
    const item
    of rssFeed.channel.item
  ) {
    let publishedAt:
      Date | null = null;

    const parsedDate =
      new Date(item.pubDate);

    if (
      !Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      publishedAt =
        parsedDate;
    }

    await createPost(
      item.title,
      item.link,
      item.description,
      publishedAt,
      feed.id
    );
  }
}


// ========================================
// AGG
// ========================================

async function handlerAgg(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  if (args.length < 1) {
    throw new Error(
      "time between requests is required"
    );
  }

  const durationStr =
    args[0];

  const timeBetweenRequests =
    parseDuration(
      durationStr
    );

  console.log(
    `Collecting feeds every ${formatDuration(timeBetweenRequests)}`
  );

  const handleError = (
    err: unknown
  ) => {
    console.error(err);
  };

  // Run once immediately
  scrapeFeeds().catch(
    handleError
  );

  // Then repeat
  const interval =
    setInterval(() => {
      scrapeFeeds().catch(
        handleError
      );
    }, timeBetweenRequests);

  // Stay alive until Ctrl+C
  await new Promise<void>(
    (resolve) => {
      process.on(
        "SIGINT",
        () => {
          console.log(
            "Shutting down feed aggregator..."
          );

          clearInterval(
            interval
          );

          resolve();
        }
      );
    }
  );
}


// ========================================
// BROWSE
// ========================================

async function handlerBrowse(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  let limit = 2;

  if (args.length > 0) {
    const parsedLimit =
      Number(args[0]);

    if (
      !Number.isInteger(
        parsedLimit
      ) ||
      parsedLimit <= 0
    ) {
      throw new Error(
        "limit must be a positive integer"
      );
    }

    limit =
      parsedLimit;
  }

  const posts =
    await getPostsForUser(
      user.id,
      limit
    );

  for (const post of posts) {
    console.log(
      `Title: ${post.title}`
    );

    console.log(
      `URL: ${post.url}`
    );

    console.log(
      `Feed: ${post.feedName}`
    );

    if (post.publishedAt) {
      console.log(
        `Published: ${post.publishedAt}`
      );
    }

    if (post.description) {
      console.log(
        `Description: ${post.description}`
      );
    }

    console.log();
  }
}


// ========================================
// MAIN
// ========================================

async function main() {
  const registry:
    CommandsRegistry = {};

  registerCommand(
    registry,
    "login",
    handlerLogin
  );

  registerCommand(
    registry,
    "register",
    handlerRegister
  );

  registerCommand(
    registry,
    "reset",
    handlerReset
  );

  registerCommand(
    registry,
    "users",
    handlerUsers
  );

  registerCommand(
    registry,
    "feeds",
    handlerFeeds
  );

  registerCommand(
    registry,
    "addfeed",
    middlewareLoggedIn(
      handlerAddFeed
    )
  );

  registerCommand(
    registry,
    "follow",
    middlewareLoggedIn(
      handlerFollow
    )
  );

  registerCommand(
    registry,
    "unfollow",
    middlewareLoggedIn(
      handlerUnfollow
    )
  );

  registerCommand(
    registry,
    "following",
    middlewareLoggedIn(
      handlerFollowing
    )
  );

  registerCommand(
    registry,
    "agg",
    handlerAgg
  );

  registerCommand(
    registry,
    "browse",
    middlewareLoggedIn(
      handlerBrowse
    )
  );

  const args =
    process.argv.slice(2);

  if (args.length === 0) {
    console.error(
      "not enough arguments"
    );

    process.exit(1);
  }

  const cmdName =
    args[0];

  const cmdArgs =
    args.slice(1);

  try {
    await runCommand(
      registry,
      cmdName,
      ...cmdArgs
    );
  } catch (err) {
    console.error(err);

    process.exit(1);
  }

  process.exit(0);
}

main();