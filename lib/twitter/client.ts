import { Client, OAuth1 } from "@xdevplatform/xdk";

let _client: Client | null = null;

export function getTwitterClient(): Client {
  if (_client) return _client;

  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    throw new Error(
      "Missing X API credentials. Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET in .env.local",
    );
  }

  const oauth1 = new OAuth1({ apiKey, apiSecret, accessToken, accessTokenSecret, callback: "oob" });
  _client = new Client({ oauth1 });
  return _client;
}

export async function postTweet(text: string): Promise<{ id: string } | null> {
  try {
    const client = getTwitterClient();
    const res = await client.posts.create({ text });
    const id = res.data?.id;
    if (id) {
      console.log(`[X] Posted: ${id} — ${text.slice(0, 60)}...`);
      return { id };
    }
    console.error("[X] No post ID in response");
    return null;
  } catch (err) {
    console.error("[X] Post failed:", (err as Error).message);
    return null;
  }
}

export async function postThread(tweets: string[]): Promise<string[]> {
  const ids: string[] = [];
  const client = getTwitterClient();

  for (let i = 0; i < tweets.length; i++) {
    try {
      const opts: { text: string; reply?: { inReplyToTweetId: string } } = {
        text: tweets[i],
      };
      if (i > 0 && ids[i - 1]) {
        opts.reply = { inReplyToTweetId: ids[i - 1] };
      }
      const res = await client.posts.create(opts);
      const id = res.data?.id;
      if (id) {
        ids.push(id);
        console.log(`[X] Thread ${i + 1}/${tweets.length}: ${id}`);
      }
      // Rate limit spacing
      if (i < tweets.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (err) {
      console.error(`[X] Thread ${i + 1} failed:`, (err as Error).message);
      break;
    }
  }
  return ids;
}
