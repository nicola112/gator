import { eq, sql } from "drizzle-orm";

import { db } from "../index.js";
import {
  feeds,
  users,
} from "../schema.js";


// =========================
// CREATE FEED
// =========================

export async function createFeed(
  name: string,
  url: string,
  userId: string
) {
  const [result] = await db
    .insert(feeds)
    .values({
      name,
      url,
      userId,
    })
    .returning();

  return result;
}


// =========================
// GET FEED BY URL
// =========================

export async function getFeedByURL(
  url: string
) {
  const [result] = await db
    .select()
    .from(feeds)
    .where(eq(feeds.url, url));

  return result;
}


// =========================
// GET ALL FEEDS
// =========================

export async function getFeeds() {
  return await db
    .select({
      id: feeds.id,
      createdAt: feeds.createdAt,
      updatedAt: feeds.updatedAt,
      lastFetchedAt: feeds.lastFetchedAt,

      name: feeds.name,
      url: feeds.url,
      userId: feeds.userId,

      userName: users.name,
    })
    .from(feeds)
    .innerJoin(
      users,
      eq(feeds.userId, users.id)
    );
}


// =========================
// MARK FEED FETCHED
// =========================

export async function markFeedFetched(
  feedId: string
) {
  const now = new Date();

  const [result] = await db
    .update(feeds)
    .set({
      lastFetchedAt: now,
      updatedAt: now,
    })
    .where(eq(feeds.id, feedId))
    .returning();

  return result;
}


// =========================
// NEXT FEED TO FETCH
// =========================

export async function getNextFeedToFetch() {
  const [feed] = await db
    .select()
    .from(feeds)
    .orderBy(
      sql`${feeds.lastFetchedAt} ASC NULLS FIRST`
    )
    .limit(1);

  return feed;
}