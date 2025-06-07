<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as Card from "$lib/components/ui/card";
  import { Label } from "$lib/components/ui/label";
  import { toast } from "svelte-sonner";
  import { Settings, Save, Building2 } from "@lucide/svelte";
  import { untrack } from "svelte";
  import type { Organization } from "better-auth/plugins";

  const activeOrg = authClient.useActiveOrganization();
  const session = authClient.useSession();

  let org: Organization | null = $state(null);
  let isLoading = $state(true);
  let isSaving = $state(false);

  let formData = $state({
    name: "",
    slug: "",
  });

  const isAdmin = $derived.by(() => {
    const currentUserMember = $activeOrg.data?.members?.find(
      (member: any) => member.userId === $session.data?.user?.id
    );
    return (
      currentUserMember?.role === "admin" || currentUserMember?.role === "owner"
    );
  });

  async function loadOrganization() {
    try {
      isLoading = true;
      const orgData = await authClient.organization.getFullOrganization({
        query: { organizationId: $activeOrg.data?.id },
      });

      org = orgData.data;
      if (org) {
        formData = {
          name: org.name,
          slug: org.slug || "",
        };
      }
    } catch (error) {
      toast.error("Failed to load organization details");
      console.error(error);
    } finally {
      isLoading = false;
    }
  }

  async function updateOrganization() {
    if (!org || !formData.name.trim()) {
      toast.error("Organization name is required");
      return;
    }

    try {
      isSaving = true;
      await authClient.organization.update({
        data: {
          name: formData.name,
          slug: formData.slug || undefined,
        },
        organizationId: org.id,
      });

      toast.success("Organization updated successfully");
      loadOrganization();
    } catch (error) {
      toast.error("Failed to update organization");
      console.error(error);
    } finally {
      isSaving = false;
    }
  }

  let previousOrgId: string | null = null;

  $effect(() => {
    const currentOrgId = $activeOrg.data?.id;

    untrack(() => {
      if (currentOrgId !== previousOrgId) {
        loadOrganization();
        previousOrgId = currentOrgId ?? null;
      }
    });
  });
</script>

<svelte:head>
  <title>Organization Settings - Admin</title>
</svelte:head>

<div class="container max-w-screen-lg py-8 mx-auto">
  <div class="mb-8">
    <div class="flex items-center gap-2">
      <Settings class="h-6 w-6" />
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Organization Settings</h1>
        <p class="text-muted-foreground mt-2">
          Manage your organization's details and preferences
        </p>
      </div>
    </div>
  </div>

  {#if !isAdmin}
    <Card.Root>
      <Card.Content class="flex items-center justify-center p-8">
        <div class="text-center">
          <Building2 class="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 class="text-lg font-semibold mb-2">Admin Access Required</h3>
          <p class="text-muted-foreground">
            You need admin or owner permissions to manage organization settings.
          </p>
        </div>
      </Card.Content>
    </Card.Root>
  {:else if isLoading}
    <Card.Root>
      <Card.Content class="p-6">
        <div class="flex items-center justify-center h-32">
          <div
            class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
          ></div>
        </div>
      </Card.Content>
    </Card.Root>
  {:else}
    <div class="grid gap-6">
      <Card.Root>
        <Card.Header>
          <Card.Title>Basic Information</Card.Title>
          <Card.Description>
            Update your organization's basic details
          </Card.Description>
        </Card.Header>
        <Card.Content class="space-y-6">
          <div class="space-y-2">
            <Label for="org-name">Organization Name *</Label>
            <Input
              id="org-name"
              bind:value={formData.name}
              placeholder="Enter organization name"
              class="max-w-md"
            />
          </div>

          <div class="space-y-2">
            <Label for="org-slug">Organization Slug</Label>
            <Input
              id="org-slug"
              bind:value={formData.slug}
              placeholder="organization-slug"
              class="max-w-md"
            />
            <p class="text-xs text-muted-foreground">
              Optional. Used for custom URLs and identification.
            </p>
          </div>

          <div class="flex items-center gap-3 pt-4">
            <Button
              onclick={updateOrganization}
              disabled={isSaving || !formData.name.trim()}
              class="gap-2"
            >
              <Save class="h-4 w-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </Card.Content>
      </Card.Root>

      {#if org}
        <Card.Root>
          <Card.Header>
            <Card.Title>Organization Details</Card.Title>
            <Card.Description
              >Read-only organization information</Card.Description
            >
          </Card.Header>
          <Card.Content class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label class="text-sm text-muted-foreground"
                  >Organization ID</Label
                >
                <p class="font-mono text-sm mt-1">{org.id}</p>
              </div>
              <div>
                <Label class="text-sm text-muted-foreground">Created</Label>
                <p class="text-sm mt-1">
                  {new Date(org.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </Card.Content>
        </Card.Root>
      {/if}
    </div>
  {/if}
</div>
