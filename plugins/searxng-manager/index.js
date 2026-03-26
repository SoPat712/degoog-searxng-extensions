// SearXNG Engine Manager Plugin for degoog
// Provides a web UI to browse, filter, and toggle SearXNG engines
// Access via: Settings > Engines > "Manage SearXNG Engines"
// Or directly: /api/plugin/searxng-manager/

const SEARXNG_BASE = process.env.SEARXNG_BASE_URL || "http://127.0.0.1:8888";
const SETTINGS_PATH =
  process.env.SEARXNG_SETTINGS_PATH || "/etc/searxng/settings.yml";

export const routes = [
  {
    method: "get",
    path: "/",
    handler: async (_req) => {
      const html = await Bun.file(
        new URL("page.html", import.meta.url).pathname,
      ).text();
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    },
  },
  {
    method: "get",
    path: "/engines",
    handler: async (_req) => {
      try {
        const configRes = await fetch(`${SEARXNG_BASE}/config`);
        const config = await configRes.json();
        return Response.json({
          engines: config.engines,
          categories: config.categories,
        });
      } catch (err) {
        return Response.json(
          { error: "SearXNG not reachable", detail: String(err) },
          { status: 502 },
        );
      }
    },
  },
  {
    method: "post",
    path: "/toggle",
    handler: async (req) => {
      try {
        const body = await req.json();
        if (!body.engines || !Array.isArray(body.engines)) {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const { readFile, writeFile } = await import("fs/promises");
        let settings = await readFile(SETTINGS_PATH, "utf-8");

        for (const { name, enabled } of body.engines) {
          const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const nameRegex = new RegExp(
            `(- name: ${escapedName}\\n(?:.*\\n)*?\\s+)disabled: (true|false)`,
          );
          if (settings.match(nameRegex)) {
            settings = settings.replace(
              nameRegex,
              `$1disabled: ${enabled ? "false" : "true"}`,
            );
          }
        }

        await writeFile(SETTINGS_PATH, settings, "utf-8");

        const { execFile } = await import("child_process");
        await new Promise((resolve) => {
          execFile(
            "supervisorctl",
            ["restart", "searxng"],
            { timeout: 10000 },
            () => resolve(),
          );
        });

        return Response.json({ ok: true, restarted: true });
      } catch (err) {
        return Response.json(
          { error: "Failed to update", detail: String(err) },
          { status: 500 },
        );
      }
    },
  },
];
