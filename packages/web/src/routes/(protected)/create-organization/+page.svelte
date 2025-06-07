<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as Card from "$lib/components/ui/card";
  import { Label } from "$lib/components/ui/label";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import { Building2, Plus, ArrowLeft } from "@lucide/svelte";

  let isCreating = $state(false);
  let formData = $state({
    name: "",
    slug: "",
  });

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  let previousName = $state("");

  function handleNameChange() {
    if (!formData.slug.trim() || formData.slug === generateSlug(previousName)) {
      formData.slug = generateSlug(formData.name);
    }
    previousName = formData.name;
  }

  async function createOrganization() {
    if (!formData.name.trim()) {
      toast.error("Organization name is required");
      return;
    }

    try {
      isCreating = true;
      const result = await authClient.organization.create({
        name: formData.name,
        slug: formData.slug || generateSlug(formData.name),
      });

      if (result.data) {
        toast.success("Organization created successfully!");

        await authClient.organization.setActive({
          organizationId: result.data.id,
        });

        goto("/");
      }
    } catch (error) {
      toast.error("Failed to create organization");
      console.error(error);
    } finally {
      isCreating = false;
    }
  }

  $effect(() => {
    if (formData.name) {
      handleNameChange();
    }
  });
</script>

<svelte:head>
  <title>Create Organization</title>
</svelte:head>

<div class="container max-w-2xl py-8 mx-auto">
  <div class="mb-8">
    <Button href="/" variant="ghost" class="gap-2 mb-4">
      <ArrowLeft class="h-4 w-4" />
      Back to Dashboard
    </Button>

    <div class="text-center space-y-2">
      <div
        class="mx-auto w-12 h-12 bg-primary rounded-full flex items-center justify-center mb-4"
      >
        <Building2 class="h-6 w-6 text-primary-foreground" />
      </div>
      <h1 class="text-3xl font-bold tracking-tight">Create Organization</h1>
      <p class="text-muted-foreground">
        Set up a new organization for a new event
      </p>
    </div>
  </div>

  <Card.Root>
    <Card.Header>
      <Card.Title>Organization Details</Card.Title>
      <Card.Description>
        Choose a name and identifier for your new organization
      </Card.Description>
    </Card.Header>
    <Card.Content class="space-y-6">
      <div class="space-y-2">
        <Label for="org-name">Organization Name *</Label>
        <Input
          id="org-name"
          bind:value={formData.name}
          oninput={handleNameChange}
          placeholder="Enter organization name"
          class="w-full"
        />
        <p class="text-xs text-muted-foreground">
          This will be the display name for your organization
        </p>
      </div>

      <div class="space-y-2">
        <Label for="org-slug">Organization Slug</Label>
        <Input
          id="org-slug"
          bind:value={formData.slug}
          placeholder="organization-slug"
          class="w-full"
        />
        <p class="text-xs text-muted-foreground">
          Used for URLs and identification. Auto-generated from name if left
          empty.
        </p>
      </div>

      <div class="flex flex-col sm:flex-row gap-3">
        <Button
          onclick={createOrganization}
          disabled={isCreating || !formData.name.trim()}
          class="gap-2 flex-1"
        >
          <Plus class="h-4 w-4" />
          {isCreating ? "Creating..." : "Create Organization"}
        </Button>
        <Button
          href="/"
          variant="outline"
          disabled={isCreating}
          class="flex-1 sm:flex-initial"
        >
          Cancel
        </Button>
      </div>
    </Card.Content>
  </Card.Root>

  <div class="mt-4 text-center text-sm text-muted-foreground">
    <p>
      You'll be automatically switched to the new organization once it's
      created.
    </p>
  </div>
</div>
