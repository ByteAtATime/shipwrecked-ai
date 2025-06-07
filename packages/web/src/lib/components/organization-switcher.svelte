<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import {
    Building2,
    Check,
    ChevronsUpDown,
    Mail,
    Plus,
    X,
    Crown,
    Shield,
    User,
  } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import type { Invitation } from "better-auth/plugins";
  import { invalidateAll } from "$app/navigation";

  const activeOrg = authClient.useActiveOrganization();

  let open = $state(false);
  let invitations: Invitation[] = $state([]);

  const roleIcons = {
    owner: Crown,
    admin: Shield,
    member: User,
  };

  const orgs = authClient.useListOrganizations();

  async function switchOrganization(orgId: string) {
    try {
      await authClient.organization.setActive({ organizationId: orgId });
      toast.success("Switched organization");
      open = false;
    } catch (error) {
      toast.error("Failed to switch organization");
      console.error(error);
    }
  }
</script>

<DropdownMenu.Root bind:open>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button variant="outline" class="w-[280px] justify-between" {...props}>
        <div class="flex items-center gap-2 truncate">
          <Building2 class="h-4 w-4 shrink-0" />
          <span class="truncate">
            {$activeOrg.data?.name || "Select organization..."}
          </span>
        </div>
        <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>

  <DropdownMenu.Content class="w-[280px]">
    {#if ($orgs.data?.length ?? 0) > 0}
      <DropdownMenu.Label>Your Organizations</DropdownMenu.Label>
      {#each $orgs.data ?? [] as org}
        <DropdownMenu.Item
          onclick={() => switchOrganization(org.id)}
          class="flex items-center justify-between cursor-pointer"
        >
          <div class="flex items-center gap-2">
            <Building2 class="h-4 w-4" />
            <span>{org.name}</span>
            {#if org.id === $activeOrg.data?.id}
              <Check class="h-4 w-4 text-primary" />
            {/if}
          </div>
        </DropdownMenu.Item>
      {/each}
    {/if}

    {#if $orgs.data?.length === 0 && invitations.length === 0}
      <div class="px-2 py-6 text-center text-sm text-muted-foreground">
        <Building2 class="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No organizations yet</p>
        <p class="text-xs mt-1">Create or get invited to one</p>
      </div>
    {/if}

    <DropdownMenu.Separator />
    <DropdownMenu.Item class="gap-2">
      <Plus class="h-4 w-4" />
      Create Organization
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
