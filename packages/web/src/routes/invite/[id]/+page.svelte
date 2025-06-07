<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import { Building2, Mail, Crown, Shield, User, Clock } from "@lucide/svelte";
  import { getRoleColor, getRoleInfo } from "$lib/organization";

  let { data } = $props();
  let invitation = $derived(data.invitation);

  let loading = $state(false);
  let accepting = $state(false);
  let error = $state("");

  const roleIcons = {
    owner: Crown,
    admin: Shield,
    member: User,
  };

  const getRoleIcon = (role: string) =>
    roleIcons[role as keyof typeof roleIcons] || User;

  async function acceptInvitation() {
    if (!invitation) return;

    try {
      accepting = true;

      await authClient.organization.acceptInvitation({
        invitationId: invitation.id,
      });

      toast.success("Invitation accepted successfully!");

      await authClient.organization.setActive({
        organizationId: invitation.organizationId,
      });

      goto("/");
    } catch (err) {
      console.error("Error accepting invitation:", err);
      toast.error("Failed to accept invitation. Please try again.");
    } finally {
      accepting = false;
    }
  }

  async function declineInvitation() {
    if (!invitation) return;

    try {
      await authClient.organization.rejectInvitation({
        invitationId: invitation.id,
      });

      toast.success("Invitation declined.");
      goto("/");
    } catch (err) {
      console.error("Error declining invitation:", err);
      toast.error("Failed to decline invitation. Please try again.");
    }
  }
</script>

<svelte:head>
  <title>Accept Invitation</title>
</svelte:head>

<div class="flex items-center justify-center p-4 min-h-screen">
  <div class="w-full max-w-md">
    {#if loading}
      <Card.Root>
        <Card.Content class="flex items-center justify-center p-8">
          <div
            class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
          ></div>
        </Card.Content>
      </Card.Root>
    {:else if error}
      <Card.Root>
        <Card.Header class="text-center">
          <Card.Title class="text-red-600">Invitation Error</Card.Title>
        </Card.Header>
        <Card.Content class="space-y-4">
          <p class="text-center text-muted-foreground">{error}</p>
          <div class="flex justify-center">
            <Button href="/" variant="outline">Go to Dashboard</Button>
          </div>
        </Card.Content>
      </Card.Root>
    {:else if invitation}
      <Card.Root>
        <Card.Header class="text-center">
          <div
            class="mx-auto w-12 h-12 bg-primary rounded-full flex items-center justify-center mb-4"
          >
            <Building2 class="h-6 w-6 text-primary-foreground" />
          </div>
          <Card.Title>You're Invited!</Card.Title>
          <Card.Description>
            You've been invited to join
            <strong>{invitation.organizationName}</strong>
          </Card.Description>
        </Card.Header>
        <Card.Content class="space-y-8">
          <div class="space-y-5">
            <div class="flex items-start gap-3">
              <Mail class="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <span class="text-muted-foreground">Invited by:</span>
                <span class="font-medium">{invitation.inviterEmail}</span>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <Shield class="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <span class="text-muted-foreground">Role:</span>
                <Badge class={getRoleColor(invitation.role)}>
                  {@const RoleIcon = getRoleIcon(invitation.role)}
                  <RoleIcon class="h-4 w-4 mr-1" />
                  {getRoleInfo(invitation.role).label}
                </Badge>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <Clock class="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <span class="text-muted-foreground">Expires:</span>
                <span class="font-medium">
                  {new Date(invitation.expiresAt).toLocaleString(undefined, {
                    year: "numeric",
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span class="text-xs text-muted-foreground mt-1">
                  ({Math.max(
                    0,
                    Math.ceil(
                      (new Date(invitation.expiresAt).getTime() - Date.now()) /
                        (1000 * 60 * 60 * 24)
                    )
                  )} days remaining)
                </span>
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-3 pt-2">
            <Button
              onclick={acceptInvitation}
              disabled={accepting}
              class="w-full"
            >
              {accepting ? "Accepting..." : "Accept Invitation"}
            </Button>
            <Button
              onclick={declineInvitation}
              variant="outline"
              class="w-full"
            >
              Decline
            </Button>
          </div>
          <div class="text-center">
            <Button href="/" variant="ghost" size="sm">Go to Dashboard</Button>
          </div>
        </Card.Content>
      </Card.Root>
    {/if}
  </div>
</div>
