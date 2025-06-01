import { betterAuth } from "better-auth";
import { db } from "./db";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth, organization } from "better-auth/plugins";
import { env } from "$env/dynamic/private";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "slack",
          clientId: env.SLACK_CLIENT_ID!,
          clientSecret: env.SLACK_CLIENT_SECRET!,
          discoveryUrl: "https://slack.com/.well-known/openid-configuration",
          scopes: ["openid", "email", "profile"],
        },
      ],
    }),
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 5,
      creatorRole: "owner",
      membershipLimit: 100,
      invitationExpiresIn: 48 * 60 * 60,
      cancelPendingInvitationsOnReInvite: true,
      invitationLimit: 100,
    }),
  ],
});
