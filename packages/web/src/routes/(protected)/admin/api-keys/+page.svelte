<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import { Label } from "$lib/components/ui/label";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import * as Table from "$lib/components/ui/table";
  import { toast } from "svelte-sonner";
  import {
    MoreVertical,
    Plus,
    Key,
    Copy,
    Trash2,
    Edit,
    Shield,
    Settings,
  } from "@lucide/svelte";
  import { untrack } from "svelte";

  type ApiKey = {
    permissions: {
      [key: string]: string[];
    } | null;
    id: string;
    name: string | null;
    start: string | null;
    prefix: string | null;
    userId: string;
    refillInterval: number | null;
    refillAmount: number | null;
    lastRefillAt: Date | null;
    enabled: boolean;
    rateLimitEnabled: boolean;
    rateLimitTimeWindow: number | null;
    rateLimitMax: number | null;
    requestCount: number;
    remaining: number | null;
    lastRequest: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    metadata: Record<string, any> | null;
  };

  const activeOrg = authClient.useActiveOrganization();
  const session = authClient.useSession();

  let apiKeys: ApiKey[] = $state([]);
  let isLoading = $state(true);
  let showCreateDialog = $state(false);
  let showUpdateDialog = $state(false);
  let selectedApiKey: ApiKey | null = $state(null);

  let newApiKeyForm = $state({
    name: "",
    expiresIn: "",
  });

  let updateApiKeyForm = $state({
    name: "",
    enabled: true,
  });

  let lastCreatedApiKey: string | null = $state(null);
  let showApiKey = $state(false);

  const isAdmin = $derived.by(() => {
    const currentUserMember = $activeOrg.data?.members?.find(
      (member: any) => member.userId === $session.data?.user?.id
    );
    return (
      currentUserMember?.role === "admin" || currentUserMember?.role === "owner"
    );
  });

  async function loadApiKeys() {
    if (!isAdmin) return;

    try {
      isLoading = true;
      const response = await authClient.apiKey.list();

      if (response.data) {
        apiKeys = response.data;
      }
    } catch (error) {
      toast.error("Failed to load API keys");
      console.error(error);
    } finally {
      isLoading = false;
    }
  }

  async function createApiKey() {
    if (!newApiKeyForm.name.trim()) {
      toast.error("Please enter an API key name");
      return;
    }

    try {
      const payload: {
        metadata?: any;
        name?: string | undefined;
        userId?: string | undefined;
        prefix?: string | undefined;
        expiresIn?: number | null | undefined;
        permissions?: Record<string, string[]> | undefined;
        rateLimitMax?: number | undefined;
        refillInterval?: number | undefined;
        refillAmount?: number | undefined;
        rateLimitEnabled?: boolean | undefined;
        rateLimitTimeWindow?: number | undefined;
        remaining?: number | null | undefined;
      } = {
        name: newApiKeyForm.name,
        metadata: {
          organizationId: $activeOrg.data?.id,
        },
      };

      if (newApiKeyForm.expiresIn) {
        const days = parseInt(newApiKeyForm.expiresIn);
        if (days > 0) {
          payload.expiresIn = days * 24 * 60 * 60;
        }
      }

      const response = await authClient.apiKey.create(payload);

      if (response.data) {
        lastCreatedApiKey = response.data.key;
        showApiKey = true;
        toast.success("API key created successfully");
        showCreateDialog = false;
        resetCreateForm();
        loadApiKeys();
      }
    } catch (error) {
      toast.error("Failed to create API key");
      console.error(error);
    }
  }

  async function updateApiKey() {
    if (!selectedApiKey) return;

    try {
      await authClient.apiKey.update({
        keyId: selectedApiKey.id,
        name: updateApiKeyForm.name,
        enabled: updateApiKeyForm.enabled,
      });

      toast.success("API key updated successfully");
      showUpdateDialog = false;
      selectedApiKey = null;
      loadApiKeys();
    } catch (error) {
      toast.error("Failed to update API key");
      console.error(error);
    }
  }

  async function deleteApiKey(keyId: string) {
    try {
      await authClient.apiKey.delete({ keyId });
      toast.success("API key deleted successfully");
      loadApiKeys();
    } catch (error) {
      toast.error("Failed to delete API key");
      console.error(error);
    }
  }

  function resetCreateForm() {
    newApiKeyForm = {
      name: "",
      expiresIn: "",
    };
  }

  function openUpdateDialog(apiKey: ApiKey) {
    selectedApiKey = apiKey;
    updateApiKeyForm = {
      name: apiKey.name,
      enabled: apiKey.enabled,
    };
    showUpdateDialog = true;
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  function formatDate(date: string | Date) {
    return new Date(date).toLocaleDateString();
  }

  function formatExpiryStatus(expiresAt: string | null) {
    if (!expiresAt)
      return { text: "Never", color: "bg-green-100 text-green-800" };

    const now = new Date();
    const expiry = new Date(expiresAt);

    if (expiry < now) {
      return { text: "Expired", color: "bg-red-100 text-red-800" };
    }

    const daysUntilExpiry = Math.ceil(
      (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry <= 7) {
      return {
        text: `${daysUntilExpiry} days`,
        color: "bg-yellow-100 text-yellow-800",
      };
    }

    return { text: formatDate(expiresAt), color: "bg-gray-100 text-gray-800" };
  }

  let previousOrgId: string | null = null;

  $effect(() => {
    const currentOrgId = $activeOrg.data?.id;

    untrack(() => {
      if (currentOrgId !== previousOrgId) {
        loadApiKeys();
        previousOrgId = currentOrgId ?? null;
      }
    });
  });
</script>

<svelte:head>
  <title>API Keys - Admin</title>
</svelte:head>

<div class="container max-w-screen-lg py-8 mx-auto">
  <div class="mb-8">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">API Key Management</h1>
        <p class="text-muted-foreground mt-2">
          Manage API keys for your organization
        </p>
      </div>
      {#if isAdmin}
        <Button
          onclick={() => (showCreateDialog = true)}
          class="gap-2 cursor-pointer"
        >
          <Plus class="h-4 w-4" />
          Create API Key
        </Button>
      {/if}
    </div>
  </div>

  {#if !isAdmin}
    <Card.Root>
      <Card.Content class="flex items-center justify-center p-8">
        <div class="text-center">
          <Shield class="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 class="text-lg font-semibold mb-2">Admin Access Required</h3>
          <p class="text-muted-foreground">
            You need admin or owner permissions to manage API keys.
          </p>
        </div>
      </Card.Content>
    </Card.Root>
  {:else if isLoading}
    <div class="grid gap-6">
      <Card.Root>
        <Card.Content class="p-6">
          <div class="flex items-center justify-center h-32">
            <div
              class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
            ></div>
          </div>
        </Card.Content>
      </Card.Root>
    </div>
  {:else}
    <div class="grid gap-6">
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2">
            API Keys ({apiKeys.length})
          </Card.Title>
          <Card.Description>
            API keys provide programmatic access to your organization's
            resources
          </Card.Description>
        </Card.Header>
        <Card.Content>
          {#if apiKeys.length === 0}
            <div class="text-center py-8 text-muted-foreground">
              <Key class="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No API keys found</p>
              <p class="text-xs mt-1">
                Create your first API key to get started
              </p>
            </div>
          {:else}
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Name</Table.Head>
                  <Table.Head>Key</Table.Head>
                  <Table.Head>Status</Table.Head>
                  <Table.Head>Expires</Table.Head>
                  <Table.Head>Created</Table.Head>
                  <Table.Head class="text-right">Actions</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each apiKeys as apiKey}
                  <Table.Row>
                    <Table.Cell>
                      <div class="font-medium">{apiKey.name}</div>
                      {#if apiKey.prefix}
                        <div class="text-xs text-muted-foreground">
                          Prefix: {apiKey.prefix}
                        </div>
                      {/if}
                    </Table.Cell>
                    <Table.Cell>
                      <div class="flex items-center gap-2">
                        <code class="text-xs bg-muted px-2 py-1 rounded">
                          {apiKey.start || "***"}••••••••
                        </code>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge
                        class={apiKey.enabled ?
                          "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"}
                      >
                        {apiKey.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {@const expiryStatus = formatExpiryStatus(
                        apiKey.expiresAt
                      )}
                      <Badge class={expiryStatus.color}>
                        {expiryStatus.text}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell class="text-muted-foreground">
                      {formatDate(apiKey.createdAt)}
                    </Table.Cell>
                    <Table.Cell class="text-right">
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger>
                          <Button variant="ghost" size="sm" class="h-8 w-8 p-0">
                            <MoreVertical class="h-4 w-4" />
                          </Button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content align="end">
                          <DropdownMenu.Label>Manage API Key</DropdownMenu.Label
                          >
                          <DropdownMenu.Separator />
                          <DropdownMenu.Item
                            onclick={() => openUpdateDialog(apiKey)}
                            class="gap-2"
                          >
                            <Edit class="h-4 w-4" />
                            Edit
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator />
                          <DropdownMenu.Item
                            onclick={() => deleteApiKey(apiKey.id)}
                            class="gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 class="h-4 w-4" />
                            Delete
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Root>
                    </Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          {/if}
        </Card.Content>
      </Card.Root>
    </div>
  {/if}
</div>

<!-- Create API Key Dialog -->
<Dialog.Root bind:open={showCreateDialog}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <Plus class="h-5 w-5" />
        Create New API Key
      </Dialog.Title>
      <Dialog.Description>
        Create a new API key for programmatic access to your organization.
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 py-4">
      <div class="space-y-2">
        <Label for="name">Name *</Label>
        <Input
          id="name"
          placeholder="My API Key"
          bind:value={newApiKeyForm.name}
          class="w-full"
        />
      </div>

      <div class="space-y-2">
        <Label for="expires">Expires in (days, optional)</Label>
        <Input
          id="expires"
          type="number"
          placeholder="30"
          bind:value={newApiKeyForm.expiresIn}
          class="w-full"
        />
      </div>

      <Dialog.Footer>
        <Button variant="outline" onclick={() => (showCreateDialog = false)}>
          Cancel
        </Button>
        <Button onclick={createApiKey} class="gap-2">
          <Key class="h-4 w-4" />
          Create API Key
        </Button>
      </Dialog.Footer>
    </div></Dialog.Content
  >
</Dialog.Root>

<Dialog.Root bind:open={showUpdateDialog}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <Edit class="h-5 w-5" />
        Update API Key
      </Dialog.Title>
      <Dialog.Description>
        Update the settings for this API key.
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 py-4">
      <div class="space-y-2">
        <Label for="update-name">Name</Label>
        <Input
          id="update-name"
          bind:value={updateApiKeyForm.name}
          class="w-full"
        />
      </div>

      <div class="flex items-center space-x-2">
        <input
          type="checkbox"
          id="enabled"
          bind:checked={updateApiKeyForm.enabled}
          class="rounded"
        />
        <Label for="enabled">Enabled</Label>
      </div>
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => (showUpdateDialog = false)}>
        Cancel
      </Button>
      <Button onclick={updateApiKey} class="gap-2">
        <Settings class="h-4 w-4" />
        Update
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={showApiKey}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <Key class="h-5 w-5" />
        API Key Created
      </Dialog.Title>
      <Dialog.Description>
        Your API key has been created. Make sure to copy it now as you won't be
        able to see it again.
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 py-4">
      <div class="space-y-2">
        <Label>API Key</Label>
        <div class="flex items-center space-x-2">
          <Input
            value={lastCreatedApiKey || ""}
            readonly
            class="font-mono text-xs"
          />
          <Button
            variant="outline"
            size="sm"
            onclick={() => copyToClipboard(lastCreatedApiKey || "")}
            class="gap-2"
          >
            <Copy class="h-4 w-4" />
            Copy
          </Button>
        </div>
      </div>
      <div class="text-sm text-muted-foreground p-3 bg-muted rounded-md">
        <strong>Important:</strong> This is the only time you'll see this API key.
        Store it securely and don't share it with anyone.
      </div>
    </div>

    <Dialog.Footer>
      <Button onclick={() => (showApiKey = false)} class="w-full">
        I've copied the API key
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
