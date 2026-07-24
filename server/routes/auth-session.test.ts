import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

async function startAuthServer(env: {
  API_SECRET_KEY?: string;
  DASHBOARD_ACCESS_PASSWORD?: string;
  DASHBOARD_WRITE_PASSWORD?: string;
}): Promise<{ baseUrl: string; server: Server }> {
  vi.resetModules();
  setEnv("API_SECRET_KEY", env.API_SECRET_KEY);
  setEnv("DASHBOARD_ACCESS_PASSWORD", env.DASHBOARD_ACCESS_PASSWORD);
  setEnv("DASHBOARD_WRITE_PASSWORD", env.DASHBOARD_WRITE_PASSWORD);
  setEnv("NODE_ENV", "production");
  delete process.env.DEV_API;

  const { authSessionRouter } = await import("./auth-session.js");
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authSessionRouter);

  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Auth test server did not bind");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
}

afterEach(() => {
  vi.resetModules();
  delete process.env.API_SECRET_KEY;
  delete process.env.DASHBOARD_ACCESS_PASSWORD;
  delete process.env.DASHBOARD_WRITE_PASSWORD;
  delete process.env.NODE_ENV;
  delete process.env.DEV_API;
});

describe("dashboard access session routes", () => {
  it("reports fail-closed configuration state when the viewer password is missing", async () => {
    const { baseUrl, server } = await startAuthServer({
      API_SECRET_KEY: "machine-key",
    });
    try {
      const response = await fetch(`${baseUrl}/api/auth/access-session`);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toMatchObject({
        authenticated: false,
        configured: false,
      });
    } finally {
      await closeServer(server);
    }
  });

  it("creates an HttpOnly viewer session only for the configured password", async () => {
    const { baseUrl, server } = await startAuthServer({
      API_SECRET_KEY: "machine-key",
      DASHBOARD_ACCESS_PASSWORD: "viewer-password",
    });
    try {
      const invalidResponse = await fetch(
        `${baseUrl}/api/auth/access-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: "wrong-password" }),
        }
      );
      expect(invalidResponse.status).toBe(403);
      expect(await invalidResponse.json()).toMatchObject({
        code: "DASHBOARD_ACCESS_INVALID",
      });

      const loginResponse = await fetch(`${baseUrl}/api/auth/access-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "viewer-password" }),
      });
      expect(loginResponse.status).toBe(200);
      const cookie = loginResponse.headers.get("set-cookie") || "";
      expect(cookie).toContain("dashboard_access_session=");
      expect(cookie.toLowerCase()).toContain("httponly");
      expect(cookie.toLowerCase()).toContain("samesite=lax");

      const sessionResponse = await fetch(
        `${baseUrl}/api/auth/access-session`,
        {
          headers: { Cookie: cookie.split(";")[0] || "" },
        }
      );
      expect(await sessionResponse.json()).toMatchObject({
        authenticated: true,
        configured: true,
      });
    } finally {
      await closeServer(server);
    }
  });

  it("clears viewer and administrator sessions when the user logs out", async () => {
    const { baseUrl, server } = await startAuthServer({
      API_SECRET_KEY: "machine-key",
      DASHBOARD_ACCESS_PASSWORD: "viewer-password",
      DASHBOARD_WRITE_PASSWORD: "admin-password",
    });
    try {
      const response = await fetch(`${baseUrl}/api/auth/access-session`, {
        method: "DELETE",
      });
      expect(response.status).toBe(200);
      const cookies = response.headers.getSetCookie();
      expect(
        cookies.some(cookie => cookie.startsWith("dashboard_access_session="))
      ).toBe(true);
      expect(
        cookies.some(cookie => cookie.startsWith("dashboard_write_session="))
      ).toBe(true);
    } finally {
      await closeServer(server);
    }
  });
});
