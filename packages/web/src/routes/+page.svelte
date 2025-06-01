<script>
  import { authClient } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button";

  const signIn = async () => {
    await authClient.signIn.oauth2({
      providerId: "slack",
    });
  };
</script>

<Button onclick={signIn}>Click me</Button>
