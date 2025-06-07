<script>
  import { dev } from "$app/environment";
  import { authClient } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button";

  const signIn = async () => {
    await authClient.signIn.oauth2({
      providerId: "slack",
    });
  };

  const signInDev = async () => {
    await authClient.signIn.social({
      provider: "google",
    });
  };
</script>

<div class="container mx-auto py-16 px-4">
  <div class="max-w-2xl mx-auto text-center space-y-8">
    <div class="space-y-4">
      <h1 class="text-4xl font-bold tracking-tight">Shipwrecked AI</h1>
    </div>

    <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
      <Button onclick={signIn} size="lg">Sign In with Slack</Button>
      {#if dev}
        <Button variant="outline" onclick={signInDev} size="lg">
          Sign In with Google
        </Button>
      {/if}

      <Button variant="outline" href="/browse" size="lg">
        Browse Q&A Pairs
      </Button>
    </div>
  </div>
</div>
