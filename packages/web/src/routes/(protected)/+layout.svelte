<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { page } from "$app/state";

  let { children } = $props();
</script>

<div class="min-h-screen bg-background">
  <header class="border-b">
    <div class="container mx-auto px-4">
      <div class="flex h-16 items-center justify-between">
        <div class="flex items-center space-x-4">
          <Button variant="ghost" href="/" class="text-lg font-semibold">
            Shipwrecked AI
          </Button>
        </div>

        <nav class="flex items-center space-x-4">
          <Button
            variant={page.route.id === "/" ? "default" : "ghost"}
            href="/"
            size="sm"
          >
            Home
          </Button>
          <Button
            variant={page.route.id === "/browse" ? "default" : "ghost"}
            href="/browse"
            size="sm"
          >
            Browse Q&A
          </Button>
        </nav>
      </div>
    </div>
  </header>

  <main>
    {@render children()}
  </main>
</div>
