<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import ExternalLink from "@lucide/svelte/icons/external-link";

  interface Citation {
    permalink: string;
    content: string;
    timestamp: string;
    username: string;
  }

  interface QAPair {
    id: string;
    question: string;
    answer: string;
    citationDetails: Citation[];
  }

  let { qa }: { qa: QAPair } = $props();

  function formatTimestamp(timestamp: string) {
    try {
      const date = new Date(parseFloat(timestamp) * 1000);
      return date.toLocaleDateString();
    } catch {
      return timestamp;
    }
  }
</script>

<Card.Root class="h-full">
  <Card.Header>
    <Card.Title class="text-lg leading-tight">
      {qa.question}
    </Card.Title>
  </Card.Header>
  <Card.Content class="space-y-4">
    <div class="prose prose-sm max-w-none">
      <p class="text-muted-foreground">{qa.answer}</p>
    </div>

    {#if qa.citationDetails && qa.citationDetails.length > 0}
      <div class="space-y-2">
        <h4 class="text-sm font-medium">Sources:</h4>
        <div class="space-y-4">
          {#each qa.citationDetails as citation}
            <div
              class="flex items-center gap-2 p-4 bg-muted/50 rounded-md text-xs"
            >
              <div class="flex-1">
                <div class="font-medium flex items-baseline gap-1.5 mb-1">
                  {citation.username}
                  <div class="text-muted-foreground font-normal">
                    {formatTimestamp(citation.timestamp)}
                  </div>
                </div>
                <div class="text-muted-foreground line-clamp-2">
                  {citation.content}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                class="h-6 w-6 shrink-0"
                target="_blank"
                href={citation.permalink}
              >
                <ExternalLink class="h-3 w-3" />
              </Button>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
