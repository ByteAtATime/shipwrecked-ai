import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import {
  invitation as invitationTable,
  organization as organizationTable,
  user as userTable,
} from "$lib/server/db/auth-schema";
import { eq, and, sql } from "drizzle-orm";

export const GET: RequestHandler = async () => {
  try {
    const pendingInvitations = await db
      .select({
        id: invitationTable.id,
        email: invitationTable.email,
        role: invitationTable.role,
        organizationId: invitationTable.organizationId,
        organizationName: organizationTable.name,
        inviterName: userTable.name,
        inviterEmail: userTable.email,
        expiresAt: invitationTable.expiresAt,
      })
      .from(invitationTable)
      .innerJoin(
        organizationTable,
        eq(invitationTable.organizationId, organizationTable.id)
      )
      .innerJoin(userTable, eq(invitationTable.inviterId, userTable.id))
      .where(
        and(
          eq(invitationTable.status, "pending"),
          eq(invitationTable.slackNotificationSent, false)
        )
      );

    return json({ invitations: pendingInvitations });
  } catch (error) {
    console.error("Error fetching pending invitations:", error);
    return json(
      { error: "Failed to fetch pending invitations" },
      { status: 500 }
    );
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { invitationIds } = await request.json();

    if (!invitationIds || !Array.isArray(invitationIds)) {
      return json(
        { error: "invitationIds array is required" },
        { status: 400 }
      );
    }

    await db
      .update(invitationTable)
      .set({ slackNotificationSent: true })
      .where(
        and(
          eq(invitationTable.slackNotificationSent, false),
          // This is a simplified approach - in production you might want a more robust IN clause
          invitationIds.length > 0
            ? sql`${invitationTable.id} IN ${invitationIds}`
            : sql`1=0`
        )
      );

    return json({ success: true, updated: invitationIds.length });
  } catch (error) {
    console.error("Error marking invitations as sent:", error);
    return json(
      { error: "Failed to mark invitations as sent" },
      { status: 500 }
    );
  }
};
