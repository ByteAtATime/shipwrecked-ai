import { json } from "@sveltejs/kit";
import { auth } from "$lib/server/auth";

export async function requireApiKeyAuth(request: Request) {
  try {
    const apiKey = request.headers.get("x-api-key");

    if (!apiKey) {
      return {
        error: json(
          { error: "Unauthorized - Invalid or missing API key" },
          { status: 401 }
        ),
        session: null,
        user: null,
        organizationId: null,
      };
    }

    const { valid, error, key } = await auth.api.verifyApiKey({
      body: {
        key: apiKey,
      },
    });

    const organizationId = key?.metadata?.organizationId;

    if (!organizationId) {
      return {
        error: json(
          { error: "Unauthorized - No organization associated with API key" },
          { status: 401 }
        ),
        session: null,
        user: null,
        organizationId: null,
      };
    }

    return {
      error: null,
      organizationId,
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
      organizationId: null,
    };
  }
}
