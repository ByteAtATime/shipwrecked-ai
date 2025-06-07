import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { auth } from "$lib/server/auth";

export const load: PageServerLoad = async ({ request, params }) => {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return redirect(302, "/login");
  }

  const invitation = await auth.api.getInvitation({
    query: {
      id: params.id,
    },
    headers: request.headers,
  });

  if (!invitation) {
    return redirect(302, "/");
  }

  if (invitation.status !== "pending") {
    return redirect(302, "/");
  }

  if (invitation.expiresAt < new Date()) {
    return redirect(302, "/");
  }

  if (invitation.email !== session.user.email) {
    return redirect(302, "/");
  }

  return {
    invitation,
  };
};
