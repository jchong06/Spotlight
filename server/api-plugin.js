// ============================================================
//  Spotlight — auth + favorites API, mounted into the Vite dev server.
//  Delegates to the shared handlers (server/handlers.js) so dev and the
//  standalone production server (server/index.js) behave identically.
//  Routes:
//    POST   /api/auth/signup   {email,password,name}  -> {token,user}
//    POST   /api/auth/login    {email,password}        -> {token,user}
//    POST   /api/auth/logout                            -> {ok}
//    GET    /api/auth/me                                -> {user}
//    PATCH  /api/auth/me        {name?,city?,homeLat?,homeLng?} -> {user}
//    GET    /api/favorites                              -> {favorites:[event]}
//    PUT    /api/favorites      {events:[event]}        -> {favorites:[event]}  (bulk merge)
//    POST   /api/favorites      <event>                 -> {ok}                 (add one)
//    DELETE /api/favorites/:id                          -> {ok}
// ============================================================
import { authRoutes, favoritesRoutes } from "./handlers.js";

const subpath = (req) => (req.url || "/").split("?")[0]; // Vite strips the mount prefix

export default function apiPlugin() {
  return {
    name: "spotlight-api",
    configureServer(server) {
      server.middlewares.use("/api/auth", (req, res) => authRoutes(req, res, subpath(req)));
      server.middlewares.use("/api/favorites", (req, res) => favoritesRoutes(req, res, subpath(req)));
    },
  };
}
