import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Local proxy so the browser never sees the API keys and we dodge CORS.
// Accounts + favorites are handled directly by Supabase from the browser, so
// the dev server only proxies the external event APIs below.
//  /api/tm  -> Ticketmaster Discovery  (injects apikey)
//  /api/sg  -> SeatGeek Platform       (injects client_id)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const TM_KEY = env.TM_KEY || env.VITE_TM_KEY || "";
  const SG_ID = env.SEATGEEK_CLIENT_ID || "";
  const BIT_ID = env.BANDSINTOWN_APP_ID || "spotlight-edm";

  const appendKey = (key, val) => (proxyReq) => {
    if (!val) return;
    const [path, qs = ""] = proxyReq.path.split("?");
    const params = new URLSearchParams(qs);
    params.set(key, val);
    proxyReq.path = `${path}?${params}`;
  };

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: true,
      port: 5173,
      // allow access through tunnels (e.g. *.trycloudflare.com) and any LAN host
      allowedHosts: true,
      proxy: {
        "/api/tm": {
          target: "https://app.ticketmaster.com",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/tm/, "/discovery/v2/events.json"),
          configure: (proxy) => proxy.on("proxyReq", appendKey("apikey", TM_KEY)),
        },
        "/api/attr": {
          target: "https://app.ticketmaster.com",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/attr/, "/discovery/v2/attractions.json"),
          configure: (proxy) => proxy.on("proxyReq", appendKey("apikey", TM_KEY)),
        },
        "/api/venues": {
          target: "https://app.ticketmaster.com",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/venues/, "/discovery/v2/venues.json"),
          configure: (proxy) => proxy.on("proxyReq", appendKey("apikey", TM_KEY)),
        },
        "/api/sg": {
          target: "https://api.seatgeek.com",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/sg/, "/2/events"),
          configure: (proxy) => proxy.on("proxyReq", appendKey("client_id", SG_ID)),
        },
        "/api/bit": {
          target: "https://rest.bandsintown.com",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/bit/, ""),
          configure: (proxy) => proxy.on("proxyReq", appendKey("app_id", BIT_ID)),
        },
      },
    },
  };
});
