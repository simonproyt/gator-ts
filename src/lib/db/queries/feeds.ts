import { eq } from "drizzle-orm";
import { db } from "..";
import { feeds, users } from "../schema";

export async function createFeed(name: string, url: string, userId: string) {
  const [result] = await db
    .insert(feeds)
    .values({ name, url, userId })
    .returning();

  return result;
}

export async function getFeedsWithUsers() {
  return db
    .select({
      feedName: feeds.name,
      feedUrl: feeds.url,
      creatorName: users.name,
    })
    .from(feeds)
    .leftJoin(users, eq(feeds.userId, users.id));
}
