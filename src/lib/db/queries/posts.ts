import { eq } from "drizzle-orm";
import { db } from "..";
import { feedFollows, feeds, posts, users } from "../schema";

export async function getPostByUrl(url: string) {
  const [post] = await db.select().from(posts).where(eq(posts.url, url));
  return post;
}

export async function createPost(
  title: string,
  url: string,
  description: string | null,
  publishedAt: Date | null,
  feedId: string,
) {
  const [result] = await db
    .insert(posts)
    .values({ title, url, description, publishedAt, feedId })
    .returning();

  return result;
}

export async function getPostsForUser(userId: string, limit: number) {
  return db
    .select({
      title: posts.title,
      url: posts.url,
      description: posts.description,
      publishedAt: posts.publishedAt,
      feedName: feeds.name,
    })
    .from(posts)
    .innerJoin(feeds, eq(posts.feedId, feeds.id))
    .innerJoin(feedFollows, eq(feedFollows.feedId, feeds.id))
    .where(eq(feedFollows.userId, userId))
    .orderBy(posts.publishedAt, "desc")
    .limit(limit);
}
