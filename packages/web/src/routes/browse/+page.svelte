<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import QACard from "$lib/components/QACard.svelte";
  import { Input } from "$lib/components/ui/input";
  import * as Pagination from "$lib/components/ui/pagination";
  import Search from "@lucide/svelte/icons/search";
  import Loader2 from "@lucide/svelte/icons/loader-2";

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

  interface BrowseResponse {
    questions: QAPair[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }

  let questions: QAPair[] = $state([]);
  let pagination = $state({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  let loading = $state(false);
  let searchQuery = $state("");
  let searchTimeout: NodeJS.Timeout | undefined;

  async function fetchQuestions(pageNum: number = 1, search: string = "") {
    loading = true;
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "12",
      });

      if (search.trim()) {
        params.append("search", search.trim());
      }

      const response = await fetch(`/api/questions/browse?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch questions");
      }

      const data: BrowseResponse = await response.json();
      questions = data.questions;
      pagination = data.pagination;

      if (browser) {
        const url = new URL(window.location.href);
        url.searchParams.set("page", pageNum.toString());
        if (search.trim()) {
          url.searchParams.set("search", search.trim());
        } else {
          url.searchParams.delete("search");
        }
        window.history.replaceState({}, "", url);
      }
    } catch (error) {
      console.error("Error fetching questions:", error);
    } finally {
      loading = false;
    }
  }

  function handleSearch() {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(() => {
      fetchQuestions(1, searchQuery);
    }, 300);
  }

  function goToPage(pageNum: number) {
    fetchQuestions(pageNum, searchQuery);
  }

  onMount(() => {
    if (browser) {
      const urlParams = new URLSearchParams(window.location.search);
      const initialPage = parseInt(urlParams.get("page") || "1");
      const initialSearch = urlParams.get("search") || "";

      searchQuery = initialSearch;
      fetchQuestions(initialPage, initialSearch);
    }
  });
</script>

<svelte:head>
  <title>Browse Q&A Pairs</title>
</svelte:head>

<div class="container mx-auto py-8 px-4">
  <div class="space-y-6">
    <div class="text-center space-y-2">
      <h1 class="text-3xl font-bold">Browse Q&A Pairs</h1>
      <p class="text-muted-foreground">
        Explore questions and answers from our knowledge base
      </p>
    </div>

    <div class="max-w-md mx-auto">
      <div class="relative">
        <Search
          class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder="Search questions and answers..."
          bind:value={searchQuery}
          oninput={handleSearch}
          class="pl-10"
        />
      </div>
    </div>

    {#if loading}
      <div class="flex justify-center items-center py-12">
        <Loader2 class="h-8 w-8 animate-spin" />
      </div>
    {:else if questions.length === 0}
      <div class="text-center py-12">
        <p class="text-muted-foreground">
          {searchQuery ?
            "No questions found matching your search."
          : "No questions available."}
        </p>
      </div>
    {:else}
      <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {#each questions as qa (qa.id)}
          <QACard {qa} />
        {/each}
      </div>
      {#if pagination.totalPages > 1}
        <div class="flex justify-center">
          <Pagination.Root count={pagination.total} perPage={pagination.limit}>
            {#snippet children({ pages, currentPage })}
              <Pagination.Content>
                <Pagination.Item>
                  <Pagination.PrevButton
                    onclick={() => goToPage(pagination.page - 1)}
                    disabled={!pagination.hasPrev}
                  />
                </Pagination.Item>
                {#each pages as pageInfo (pageInfo.key)}
                  {#if pageInfo.type === "ellipsis"}
                    <Pagination.Item>
                      <Pagination.Ellipsis />
                    </Pagination.Item>
                  {:else}
                    <Pagination.Item>
                      <Pagination.Link
                        page={pageInfo}
                        isActive={currentPage === pageInfo.value}
                        onclick={() => goToPage(pageInfo.value)}
                      >
                        {pageInfo.value}
                      </Pagination.Link>
                    </Pagination.Item>
                  {/if}
                {/each}
                <Pagination.Item>
                  <Pagination.NextButton
                    onclick={() => goToPage(pagination.page + 1)}
                    disabled={!pagination.hasNext}
                  />
                </Pagination.Item>
              </Pagination.Content>
            {/snippet}
          </Pagination.Root>
        </div>
      {/if}
    {/if}

    <div class="text-center text-sm text-muted-foreground">
      {#if !loading && questions.length > 0}
        Showing {(pagination.page - 1) * pagination.limit + 1}-{Math.min(
          pagination.page * pagination.limit,
          pagination.total
        )} of {pagination.total} questions
      {/if}
    </div>
  </div>
</div>
