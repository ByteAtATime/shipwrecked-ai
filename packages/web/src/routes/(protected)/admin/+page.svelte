<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import * as Avatar from "$lib/components/ui/avatar";
  import { Label } from "$lib/components/ui/label";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Select from "$lib/components/ui/select";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import * as Table from "$lib/components/ui/table";
  import { toast } from "svelte-sonner";
  import {
    MoreVertical,
    UserPlus,
    User,
    Mail,
    Settings,
    Trash2,
    Key,
  } from "@lucide/svelte";
  import { untrack } from "svelte";
  import type { Invitation, Member, Organization } from "better-auth/plugins";
  import { getRoleColor, getRoleInfo, roles } from "$lib/organization";

  const activeOrg = authClient.useActiveOrganization();
  const session = authClient.useSession();

  let org: Organization | null = $state(null);
  let members: (Member & {
    user: { email: string; name: string; image?: string | undefined };
  })[] = $state([]);
  let invitations: Invitation[] = $state([]);
  let isLoading = $state(true);
  let showInviteDialog = $state(false);
  let inviteEmail = $state("");
  let inviteRole: "member" | "admin" | "owner" = $state("member");

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  async function loadData() {
    try {
      isLoading = true;

      const [orgData, invitationsData] = await Promise.all([
        authClient.organization.getFullOrganization({
          query: { organizationId: $activeOrg.data?.id },
        }),
        authClient.organization.listInvitations({
          query: { organizationId: $activeOrg.data?.id },
        }),
      ]);

      org = orgData.data;
      members = orgData.data?.members || [];
      invitations = (invitationsData.data || []).filter(
        (i) => i.status === "pending"
      );
    } catch (error) {
      toast.error("Failed to load organization data");
      console.error(error);
    } finally {
      isLoading = false;
    }
  }

  async function inviteMember() {
    if (!inviteEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    try {
      await authClient.organization.inviteMember({
        email: inviteEmail,
        role: inviteRole,
        organizationId: $activeOrg.data?.id,
      });

      toast.success("Invitation sent successfully");
      showInviteDialog = false;
      inviteEmail = "";
      inviteRole = "member";
      loadData();
    } catch (error) {
      toast.error("Failed to send invitation");
      console.error(error);
    }
  }

  async function removeMember(memberId: string) {
    try {
      await authClient.organization.removeMember({
        memberIdOrEmail: memberId,
      });
      toast.success("Member removed successfully");
      loadData();
    } catch (error) {
      toast.error("Failed to remove member");
      console.error(error);
    }
  }

  async function updateMemberRole(
    memberId: string,
    newRole: "member" | "admin" | "owner"
  ) {
    try {
      await authClient.organization.updateMemberRole({
        memberId: memberId,
        role: newRole,
      });
      toast.success("Member role updated successfully");
      loadData();
    } catch (error) {
      toast.error("Failed to update member role");
      console.error(error);
    }
  }

  async function cancelInvitation(invitationId: string) {
    try {
      await authClient.organization.cancelInvitation({
        invitationId,
      });
      toast.success("Invitation cancelled");
      loadData();
    } catch (error) {
      toast.error("Failed to cancel invitation");
      console.error(error);
    }
  }

  let previousOrgId: string | null = null;

  $effect(() => {
    const currentOrgId = $activeOrg.data?.id;

    untrack(() => {
      if (currentOrgId !== previousOrgId) {
        loadData();
        previousOrgId = currentOrgId ?? null;
      }
    });
  });
</script>

<div class="container max-w-screen-lg py-8 mx-auto">
  <div class="mb-8">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Member Management</h1>
        <p class="text-muted-foreground mt-2">
          Manage your organization members and invitations
        </p>
      </div>
      <Button onclick={() => (showInviteDialog = true)} class="gap-2">
        <UserPlus class="h-4 w-4" />
        Invite Member
      </Button>
    </div>
  </div>

  {#if isLoading}
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
          <Card.Title>Admin Tools</Card.Title>
          <Card.Description>
            Quick access to administrative functions
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <div class="flex gap-4">
            <Button href="/admin/api-keys" variant="outline" class="gap-2">
              <Key class="h-4 w-4" />
              API Keys
            </Button>
          </div>
        </Card.Content>
      </Card.Root>

      <!-- Organization Overview -->
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2">
            <Settings class="h-5 w-5" />
            Organization Overview
          </Card.Title>
          <Card.Description>
            {org?.name || "Organization"} • {members.length} members • {invitations.length}
            pending invitations
          </Card.Description>
        </Card.Header>
      </Card.Root>

      <!-- Members Table -->
      <Card.Root>
        <Card.Header>
          <Card.Title>Active Members ({members.length})</Card.Title>
          <Card.Description>
            Manage your organization members and their roles
          </Card.Description>
        </Card.Header>
        <Card.Content>
          {#if members.length === 0}
            <div class="text-center py-8 text-muted-foreground">
              <User class="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No members found</p>
            </div>
          {:else}
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Member</Table.Head>
                  <Table.Head>Role</Table.Head>
                  <Table.Head>Joined</Table.Head>
                  <Table.Head class="text-right">Actions</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each members as member}
                  <Table.Row>
                    <Table.Cell>
                      <div class="flex items-center gap-3">
                        <Avatar.Root class="h-10 w-10">
                          <Avatar.Image
                            src={member.user?.image ?? ""}
                            alt={member.user?.name ?? ""}
                          />
                          <Avatar.Fallback
                            >{getInitials(
                              member.user?.name || ""
                            )}</Avatar.Fallback
                          >
                        </Avatar.Root>
                        <div>
                          <div class="font-medium">{member.user?.name}</div>
                          <div class="text-sm text-muted-foreground">
                            {member.user?.email}
                          </div>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge class={getRoleColor(member.role)}>
                        {getRoleInfo(member.role).label}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell class="text-muted-foreground">
                      {new Date(member.createdAt).toLocaleDateString()}
                    </Table.Cell>
                    <Table.Cell class="text-right">
                      {#if member.userId !== $session.data?.user?.id}
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger>
                            <Button
                              variant="ghost"
                              size="sm"
                              class="h-8 w-8 p-0"
                            >
                              <MoreVertical class="h-4 w-4" />
                            </Button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Content align="end">
                            <DropdownMenu.Label
                              >Manage Member</DropdownMenu.Label
                            >
                            <DropdownMenu.Separator />
                            {#each roles as role}
                              {#if role.value !== member.role}
                                <DropdownMenu.Item
                                  onclick={() =>
                                    updateMemberRole(member.id, role.value)}
                                  class="gap-2"
                                >
                                  <role.icon class="h-4 w-4" />
                                  Make {role.label}
                                </DropdownMenu.Item>
                              {/if}
                            {/each}
                            <DropdownMenu.Separator />
                            <DropdownMenu.Item
                              onclick={() => removeMember(member.id)}
                              class="gap-2 text-destructive focus:text-destructive"
                            >
                              <Trash2 class="h-4 w-4" />
                              Remove Member
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Root>
                      {:else}
                        <Badge variant="outline">You</Badge>
                      {/if}
                    </Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          {/if}
        </Card.Content>
      </Card.Root>

      <!-- Pending Invitations -->
      {#if invitations.length > 0}
        <Card.Root>
          <Card.Header>
            <Card.Title>Pending Invitations ({invitations.length})</Card.Title>
            <Card.Description>
              Invitations waiting for acceptance
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Email</Table.Head>
                  <Table.Head>Role</Table.Head>
                  <Table.Head>Expires</Table.Head>
                  <Table.Head>Status</Table.Head>
                  <Table.Head class="text-right">Actions</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each invitations as invitation}
                  <Table.Row>
                    <Table.Cell>
                      <div class="flex items-center gap-3">
                        <div
                          class="h-10 w-10 rounded-full bg-muted flex items-center justify-center"
                        >
                          <Mail class="h-4 w-4" />
                        </div>
                        <div class="font-medium">{invitation.email}</div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge class={getRoleColor(invitation.role)}>
                        {getRoleInfo(invitation.role).label}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell class="text-muted-foreground">
                      {new Date(invitation.expiresAt).toLocaleDateString()}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge
                        variant="outline"
                        class="bg-yellow-50 text-yellow-700 border-yellow-200"
                      >
                        Pending
                      </Badge>
                    </Table.Cell>
                    <Table.Cell class="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onclick={() => cancelInvitation(invitation.id)}
                        class="text-destructive hover:text-destructive"
                      >
                        Cancel
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          </Card.Content>
        </Card.Root>
      {/if}
    </div>
  {/if}
</div>

<Dialog.Root bind:open={showInviteDialog}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <UserPlus class="h-5 w-5" />
        Invite New Member
      </Dialog.Title>
      <Dialog.Description>
        Send an invitation to join your organization.
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 py-4">
      <div class="space-y-2">
        <Label for="email">Email Address</Label>
        <Input
          id="email"
          type="email"
          placeholder="member@example.com"
          bind:value={inviteEmail}
          class="w-full"
        />
      </div>

      <div class="space-y-2">
        <Label for="role">Role</Label>
        <Select.Root bind:value={inviteRole} type="single">
          <Select.Trigger class="w-full">
            {@const role = roles.find((r) => r.value === inviteRole)}
            {#if role}
              <span class="flex items-center gap-2">
                <role.icon class="h-4 w-4" />
                {role.label}
              </span>
            {:else}
              Select a role
            {/if}
          </Select.Trigger>
          <Select.Content>
            {#each roles.filter((r) => r.value !== "owner") as role}
              <Select.Item value={role.value} class="gap-2">
                <role.icon class="h-4 w-4" />
                <div>
                  <div class="font-medium">{role.label}</div>
                  <div class="text-xs text-muted-foreground">
                    {role.description}
                  </div>
                </div>
              </Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => (showInviteDialog = false)}>
        Cancel
      </Button>
      <Button onclick={inviteMember} class="gap-2">
        <Mail class="h-4 w-4" />
        Send Invitation
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
