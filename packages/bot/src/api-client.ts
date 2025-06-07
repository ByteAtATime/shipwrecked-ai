export const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5173";
export const API_KEY = process.env.API_KEY;

class APIClient {
  private baseUrl: string;
  private apiKey: string | undefined;

  constructor(
    baseUrl: string = API_BASE_URL,
    apiKey: string | undefined = API_KEY
  ) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private async request(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;

    if (!this.apiKey) {
      throw new Error("API_KEY environment variable is required");
    }

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `API request to ${endpoint} failed: ${response.status} ${error}`
      );
    }

    return response.json();
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const result = await this.request("/api/embeddings", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    return result.embedding;
  }

  async parseQAs(thread: any[]): Promise<
    Array<{
      question: string;
      answer: string;
      citations: number[];
    }>
  > {
    const result = await this.request("/api/ai/parse-qas", {
      method: "POST",
      body: JSON.stringify({ thread }),
    });
    return result.qa_pairs;
  }

  async createCitation(citation: {
    permalink: string;
    content: string;
    timestamp: string;
    username?: string;
  }): Promise<{ id: string }> {
    const result = await this.request("/api/citations", {
      method: "POST",
      body: JSON.stringify(citation),
    });
    return result.citation;
  }

  async getCitations(ids: string[]): Promise<
    Array<{
      id: string;
      permalink: string;
      content: string;
      timestamp: string;
      username: string;
    }>
  > {
    const result = await this.request(`/api/citations?ids=${ids.join(",")}`, {
      method: "GET",
    });
    return result.citations;
  }

  async createQuestion(question: {
    question: string;
    answer: string;
    citationIds: string[];
    embedding: number[];
  }): Promise<{ id: string }> {
    const result = await this.request("/api/questions", {
      method: "POST",
      body: JSON.stringify(question),
    });
    return result.question;
  }

  async searchSimilarQuestions(
    embedding: number[],
    limit: number = 3
  ): Promise<{
    results: Array<{
      id: string;
      question: string;
      answer: string;
      citationIds: string[];
      similarity: number;
      citationDetails: Array<{
        permalink: string;
        content: string;
        timestamp: string;
        username: string;
      }>;
    }>;
  }> {
    const result = await this.request(`/api/questions/search`, {
      method: "POST",
      body: JSON.stringify({ embedding, limit }),
    });
    return result;
  }

  async answerQuestion(question: string): Promise<{
    answer: string;
    hasAnswer: boolean;
    sources?: string[];
  }> {
    const result = await this.request("/api/ai/answer", {
      method: "POST",
      body: JSON.stringify({ question }),
    });
    return result;
  }

  async getPendingInvitations(): Promise<
    Array<{
      id: string;
      email: string;
      role: string;
      organizationId: string;
      organizationName: string;
      inviterName: string;
      inviterEmail: string;
      expiresAt: string;
    }>
  > {
    const result = await this.request("/api/slack/invitations", {
      method: "GET",
    });
    return result.invitations;
  }

  async markInvitationsAsSent(invitationIds: string[]): Promise<{
    success: boolean;
    updated: number;
  }> {
    const result = await this.request("/api/slack/invitations", {
      method: "POST",
      body: JSON.stringify({ invitationIds }),
    });
    return result;
  }
}

export const apiClient = new APIClient();
