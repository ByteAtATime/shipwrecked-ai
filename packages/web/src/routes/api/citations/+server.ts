import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireApiKeyAuth } from "$lib/server/api-auth";
import { db } from "$lib/server/db";
import { citationsTable } from "$lib/server/db/schema";
import { sql, eq } from "drizzle-orm";

export const POST: RequestHandler = async ({ request }) => {
  const authResult = await requireApiKeyAuth(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { permalink, content, timestamp, username } = await request.json();

    if (!permalink || !content || !timestamp) {
      return json(
        { error: "permalink, content, and timestamp are required" },
        { status: 400 }
      );
    }

    const [citationRecord] = await db
      .insert(citationsTable)
      .values({
        organizationId: authResult.organizationId,
        permalink,
        content,
        timestamp,
        username: username || "Unknown User",
      })
      .returning({ id: citationsTable.id });

    return json({ citation: citationRecord });
  } catch (error) {
    console.error("Error creating citation:", error);
    return json({ error: "Failed to create citation" }, { status: 500 });
  }
};

export const GET: RequestHandler = async ({ request, url }) => {
  const authResult = await requireApiKeyAuth(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const ids = url.searchParams.get("ids");

    if (!ids) {
      return json({ error: "ids parameter is required" }, { status: 400 });
    }

    const idArray = ids.split(",");

    const citations = await db
      .select({
        id: citationsTable.id,
        permalink: citationsTable.permalink,
        content: citationsTable.content,
        timestamp: citationsTable.timestamp,
        username: citationsTable.username,
      })
      .from(citationsTable)
      .where(
        sql`${citationsTable.id} IN ${idArray} AND ${citationsTable.organizationId} = ${authResult.organizationId}`
      );

    return json({ citations });
  } catch (error) {
    console.error("Error fetching citations:", error);
    return json({ error: "Failed to fetch citations" }, { status: 500 });
  }
};
