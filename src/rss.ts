import { XMLParser } from "fast-xml-parser";

export type RSSItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
};

export type RSSFeed = {
  channel: {
    title: string;
    link: string;
    description: string;
    item: RSSItem[];
  };
};

export async function fetchFeed(feedURL: string): Promise<RSSFeed> {
  const response = await fetch(feedURL, {
    headers: {
      "User-Agent": "gator",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const parser = new XMLParser({ processEntities: false });
  const parsed = parser.parse(xml);

  const rssRoot = parsed?.rss ?? parsed;
  if (!rssRoot || typeof rssRoot !== "object") {
    throw new Error("Invalid RSS feed: missing rss root.");
  }

  const channel = rssRoot.channel;
  if (!channel || typeof channel !== "object") {
    throw new Error("Invalid RSS feed: missing channel.");
  }

  const title = channel.title;
  const link = channel.link;
  const description = channel.description;

  if (typeof title !== "string" || typeof link !== "string" || typeof description !== "string") {
    throw new Error("Invalid RSS feed: missing channel metadata.");
  }

  let rawItems: unknown = channel.item;
  let itemList: unknown[] = [];

  if (rawItems === undefined || rawItems === null) {
    itemList = [];
  } else if (Array.isArray(rawItems)) {
    itemList = rawItems;
  } else if (typeof rawItems === "object") {
    itemList = [rawItems];
  }

  const items: RSSItem[] = itemList
    .map((rawItem) => {
      if (!rawItem || typeof rawItem !== "object") {
        return undefined;
      }

      const itemTitle = (rawItem as any).title;
      const itemLink = (rawItem as any).link;
      const itemDescription = (rawItem as any).description;
      const itemPubDate = (rawItem as any).pubDate;

      if (
        typeof itemTitle !== "string" ||
        typeof itemLink !== "string" ||
        typeof itemDescription !== "string" ||
        typeof itemPubDate !== "string"
      ) {
        return undefined;
      }

      return {
        title: itemTitle,
        link: itemLink,
        description: itemDescription,
        pubDate: itemPubDate,
      };
    })
    .filter((item): item is RSSItem => item !== undefined);

  return {
    channel: {
      title,
      link,
      description,
      item: items,
    },
  };
}
