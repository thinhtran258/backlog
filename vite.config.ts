import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// mode "demo": đóng gói 1 file HTML duy nhất, dữ liệu giả, không cần Supabase
export default defineConfig(({ mode }) => ({
  plugins: mode === "demo" ? [react(), viteSingleFile()] : [react()],
  build: { outDir: mode === "demo" ? "dist-demo" : "dist" },
}));
