import {
  genericOAuthClient,
  organizationClient,
  apiKeyClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/svelte";

export const authClient = createAuthClient({
  plugins: [genericOAuthClient(), organizationClient(), apiKeyClient()],
});
