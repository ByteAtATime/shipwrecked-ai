import { betterAuth, type Session } from "better-auth";
import { db } from "./db";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth, organization } from "better-auth/plugins";
import { env } from "$env/dynamic/private";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import {
  member,
  organization as organizationTable,
  user as userTable,
} from "./db/auth-schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID!,
      clientSecret: env.GOOGLE_CLIENT_SECRET!,
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (
          session,
          ctx
        ): Promise<
          | boolean
          | void
          | {
              data: Partial<Session> & Record<string, any>;
            }
        > => {
          const user = ctx?.context.session;

          if (user?.session.activeOrganizationId) {
            return {
              data: session,
            };
          }

          let activeOrganizationId = null;

          const orgs = await db
            .select()
            .from(organizationTable)
            .innerJoin(member, eq(organizationTable.id, member.organizationId))
            .where(eq(member.userId, session.userId));

          if (orgs.length === 0) {
            const userRow = await db
              .select()
              .from(userTable)
              .where(eq(userTable.id, session.userId))
              .limit(1);
            if (!userRow?.[0]) {
              throw new Error("User not found");
            }

            const org = await auth.api.createOrganization({
              body: {
                name: `${userRow[0].name}'s Organization`,
                slug: uuidv4(),
                userId: session.userId,
              },
            });
            activeOrganizationId = org?.id;
          } else {
            activeOrganizationId = orgs[0].organization.id;
          }

          return {
            data: {
              ...session,
              activeOrganizationId,
            },
          };
        },
      },
    },
  },
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
      async sendInvitationEmail(data, request) {
        console.log(data, request);
      },
    }),
  ],
});
