import type { App } from "@slack/bolt";
import { API_BASE_URL, apiClient } from "./api-client";

export async function findUserByEmail(
  app: App,
  email: string
): Promise<string | null> {
  try {
    const result = await app.client.users.lookupByEmail({
      email: email,
    });

    return result.user?.id || null;
  } catch (error) {
    console.log(`User with email ${email} not found in Slack workspace`);
    return null;
  }
}

export async function sendInvitationDM(
  app: App,
  invitation: {
    id: string;
    email: string;
    role: string;
    organizationName: string;
    inviterName: string;
    expiresAt: string;
  }
) {
  const userId = await findUserByEmail(app, invitation.email);

  if (!userId) {
    console.log(
      `Cannot send DM to ${invitation.email} - user not found in Slack`
    );
    return false;
  }

  try {
    const expirationDate = new Date(invitation.expiresAt).toLocaleDateString();

    await app.client.chat.postMessage({
      channel: userId,
      text: `You've been invited to join ${invitation.organizationName}!`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*🎉 Organization Invitation*",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `You've been invited by *${invitation.inviterName}* to join *${invitation.organizationName}* as a *${invitation.role}*.`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `This invitation expires on *${expirationDate}*.`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `To accept this invitation, please visit *<${API_BASE_URL}/invite/${invitation.id}|this link>*.`,
          },
        },
      ],
    });

    console.log(`Sent invitation DM to ${invitation.email} (${userId})`);
    return true;
  } catch (error) {
    console.error(`Failed to send DM to ${invitation.email}:`, error);
    return false;
  }
}

export async function processInvitations(app: App) {
  try {
    const invitations = await apiClient.getPendingInvitations();

    if (invitations.length === 0) {
      return;
    }

    console.log(`Found ${invitations.length} pending invitation(s) to process`);

    const sentInvitationIds: string[] = [];

    for (const invitation of invitations) {
      const sent = await sendInvitationDM(app, invitation);
      if (sent) {
        sentInvitationIds.push(invitation.id);
      }
    }

    if (sentInvitationIds.length > 0) {
      await apiClient.markInvitationsAsSent(sentInvitationIds);
      console.log(`Marked ${sentInvitationIds.length} invitation(s) as sent`);
    }
  } catch (error) {
    console.error("Error processing invitations:", error);
  }
}
