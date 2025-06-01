import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    allowedHosts: [
      "5a07-2601-647-4d7c-90d3-fab3-ebe6-d64a-7163.ngrok-free.app",
    ],
  },
});
