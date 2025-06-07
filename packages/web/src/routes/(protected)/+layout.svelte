<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    Avatar,
    AvatarFallback,
    AvatarImage,
  } from "$lib/components/ui/avatar/index.js";
  import OrganizationSwitcher from "$lib/components/organization-switcher.svelte";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import { LogOut, User, Settings } from "@lucide/svelte";
  import { goto } from "$app/navigation";

  const session = authClient.useSession();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  async function signOut() {
    await authClient.signOut();
    goto("/login");
  }
</script>

<div class="min-h-screen bg-background">
  <header
    class="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
  >
    <div class="container flex h-16 items-center justify-between px-4">
      <OrganizationSwitcher />

      <div class="flex items-center gap-4">
        {#if $session.data?.user}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button
                  variant="ghost"
                  class="relative h-8 w-8 rounded-full cursor-pointer"
                  {...props}
                >
                  <Avatar class="h-8 w-8">
                    <AvatarImage
                      src={$session.data?.user.image ?? ""}
                      alt={$session.data?.user.name ?? ""}
                    />
                    <AvatarFallback>
                      {getInitials($session.data?.user.name ?? "")}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" class="w-56">
              <DropdownMenu.Label class="font-normal">
                <div class="flex flex-col space-y-1">
                  <p class="text-sm font-medium leading-none">
                    {$session.data.user.name}
                  </p>
                  <p class="text-xs leading-none text-muted-foreground">
                    {$session.data.user.email}
                  </p>
                </div>
              </DropdownMenu.Label>
              <DropdownMenu.Separator />
              <DropdownMenu.Item onclick={signOut} class="cursor-pointer">
                <LogOut class="h-4 w-4" />
                Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        {/if}
      </div>
    </div>
  </header>

  <main class="flex-1">
    <slot />
  </main>
</div>
