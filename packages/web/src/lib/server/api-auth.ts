import { json } from "@sveltejs/kit";
import { auth } from "$lib/server/auth";

export async function requireApiKeyAuth(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || !session.user) {
      return {
        error: json(
          { error: "Unauthorized - Invalid or missing API key" },
          { status: 401 }
        ),
        session: null,
        user: null,
      };
    }

    return {
      error: null,
      session,
      user: session.user,
    };
  } catch (error) {
    console.error("API key authentication error:", error);
    return {
      error: json(
        { error: "Unauthorized - Authentication failed" },
        { status: 401 }
      ),
      session: null,
      user: null,
    };
  }
}
