import { apiClient } from "./api-client";

export const generateEmbedding = async (text: string) => {
  return apiClient.generateEmbedding(text);
};
