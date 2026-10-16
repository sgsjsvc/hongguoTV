import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "node:fs";

export default defineConfig(async ({command}) => {
  let backend=process.env.HG_BACKEND_URL || "http://localhost:8788";
  if(command==='serve'&&!process.env.HG_BACKEND_URL){
    try {
      const directory=process.env.HG_DATA_DIR || path.resolve(__dirname,"../../custom-server/data");
      const state=JSON.parse(fs.readFileSync(path.join(directory,"service-address.json"),"utf8"));
      if(!Number.isInteger(state.port)||state.port<1||state.port>65535)throw Error('Invalid backend port');
      process.kill(state.pid,0);
      const origin=`http://127.0.0.1:${state.port}`;
      const health=await (await fetch(origin+'/health',{signal:AbortSignal.timeout(1000)})).json();
      if(health.ok&&health.service==='hongguotv-custom-bridge')backend=origin;
    } catch { /* Backend may not have started yet; preserve the default target. */ }
  }
  return {
  base: "./",
  plugins: [react()],
  // B8：生产构建产物精简（tree-shaking / 分包 / 去除 debugger）
  esbuild: { drop: ["debugger"] },
  build: {
    cssCodeSplit: true,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      treeshake: "smallest",
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          vendor: ["axios", "lucide-react"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../../shared"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: false,
    proxy: {
      "/api": {
        target: backend,
        changeOrigin: true,
      },
    },
  },
};
});
