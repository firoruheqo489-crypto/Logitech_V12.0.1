# Dashboard Access Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disable the project-dashboard entry password by default while preserving the complete viewer-login feature and keeping administrator write protection unchanged.

**Architecture:** Add a server-owned `DASHBOARD_ACCESS_ENABLED` feature flag whose only enabled values are `1` and `true`. The server remains the access-control source of truth: it bypasses only the viewer-session middleware while disabled and reports a `required` field to the client; the existing write middleware remains later in the pipeline and continues to protect mutations. The React gate uses that field to hide the login/logout UI while the feature is disabled; existing viewer-session expiry and login rate limiting stay untouched, and no local storage fallback is introduced.

**Tech Stack:** TypeScript, Express middleware and routes, React, Vitest, Vite, PowerShell release gates.

---

## File map

- Modify `server/middleware/auth.ts`: parse and expose the viewer-access feature flag; bypass only viewer-session enforcement when disabled.
- Modify `server/routes/auth-session.ts`: publish the server-owned `required` state.
- Modify `server/middleware/auth.test.ts`: cover disabled-by-default and explicitly enabled middleware behavior.
- Modify `server/routes/auth-session.test.ts`: cover status payloads in both modes and retain login-session coverage.
- Modify `server/middleware/apiAccessPolicy.test.ts`: prove disabled viewer access does not disable write authorization.
- Modify `scripts/verify-release-guards.ts`: keep the release guard exercising the explicitly enabled viewer-login path.
- Modify `client/src/lib/dashboardAccess.ts`: model and parse `required`; expose small UI-decision helpers.
- Create `client/src/lib/dashboardAccess.test.ts`: test status parsing and UI decisions with real helper code.
- Modify `client/src/components/DashboardAccessGate.tsx`: render login/logout UI only when viewer access is required.
- Modify `.env.example`: document the disabled default and the one-line re-enable setting.

### Task 1: Server viewer-access flag

**Files:**
- Modify: `server/middleware/auth.test.ts`
- Modify: `server/middleware/auth.ts`

- [ ] **Step 1: Extend the test environment helper and write the failing disabled-default test**

Add `DASHBOARD_ACCESS_ENABLED?: string` to `loadAuthModule`, set it before importing the module, and remove it in `afterEach`. Add this test before the existing production fail-closed test:

```ts
it("allows dashboard reads when viewer access is disabled by default", async () => {
  const { dashboardAccessAuth, isDashboardAccessRequired } =
    await loadAuthModule({ NODE_ENV: "production" });
  const req = createMockRequest({
    method: "GET",
    path: "/dashboard/projects",
  });
  const { res, state } = createMockResponse();
  const next = vi.fn<NextFunction>();

  dashboardAccessAuth(req, res, next);

  expect(isDashboardAccessRequired()).toBe(false);
  expect(next).toHaveBeenCalledOnce();
  expect(state.statusCode).toBeNull();
});
```

Set `DASHBOARD_ACCESS_ENABLED: "1"` in the existing tests that assert a missing password returns 503 and that a configured password returns `DASHBOARD_ACCESS_REQUIRED`.

- [ ] **Step 2: Run the middleware test and verify RED**

Run:

```powershell
pnpm exec vitest run server/middleware/auth.test.ts
```

Expected: FAIL because `isDashboardAccessRequired` is not exported and the current middleware still fails closed when the flag is absent.

- [ ] **Step 3: Implement the minimal server flag**

In `server/middleware/auth.ts`, read the new environment variable once at module load and expose its meaning:

```ts
const DASHBOARD_ACCESS_ENABLED = /^(1|true)$/i.test(
  (process.env.DASHBOARD_ACCESS_ENABLED || "").trim()
);

export function isDashboardAccessRequired(): boolean {
  return DASHBOARD_ACCESS_ENABLED;
}
```

Change `hasDashboardAccess` so a disabled viewer gate counts as access without weakening the independent write middleware:

```ts
export function hasDashboardAccess(req: Request): boolean {
  return (
    !isDashboardAccessRequired() ||
    isLocalDevelopmentRequest(req) ||
    hasValidDashboardAccessSession(req)
  );
}
```

- [ ] **Step 4: Run the middleware test and verify GREEN**

Run:

```powershell
pnpm exec vitest run server/middleware/auth.test.ts
```

Expected: all tests pass, including disabled-by-default, enabled fail-closed, enabled login-required, session-cookie, API-key and localhost cases.

### Task 2: Server status contract and write-protection regression

**Files:**
- Modify: `server/routes/auth-session.test.ts`
- Modify: `server/routes/auth-session.ts`
- Modify: `server/middleware/apiAccessPolicy.test.ts`
- Modify: `scripts/verify-release-guards.ts`

- [ ] **Step 1: Write failing route tests for `required`**

Extend `startAuthServer` with `DASHBOARD_ACCESS_ENABLED?: string`, set it before module import, and clear it in `afterEach`. Add:

```ts
it("reports authenticated access when the viewer gate is disabled", async () => {
  const { baseUrl, server } = await startAuthServer({
    API_SECRET_KEY: "machine-key",
    DASHBOARD_ACCESS_PASSWORD: "viewer-password",
  });
  try {
    const response = await fetch(`${baseUrl}/api/auth/access-session`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      authenticated: true,
      configured: true,
      required: false,
    });
  } finally {
    await closeServer(server);
  }
});
```

Set `DASHBOARD_ACCESS_ENABLED: "1"` in the existing missing-password and successful-login route tests, and extend their expected status payloads with `required: true`.

- [ ] **Step 2: Write the failing pipeline regression for administrator protection**

Add to `server/middleware/apiAccessPolicy.test.ts`, after extending its environment cleanup with `DASHBOARD_ACCESS_ENABLED`:

```ts
it("keeps write authorization active while viewer access is disabled", async () => {
  const { apiKeyAuth, dashboardAccessAuth } = await loadAuthModule({
    API_SECRET_KEY: "expected-key",
    NODE_ENV: "production",
  });
  const req = createMockRequest({ method: "POST" });
  const { res, state } = createMockResponse();
  const done = vi.fn<NextFunction>();

  runMiddlewarePipeline(
    [apiCors, dashboardAccessAuth, apiKeyAuth],
    req,
    res,
    done
  );

  expect(done).not.toHaveBeenCalled();
  expect(state.statusCode).toBe(403);
  expect(state.jsonBody).toEqual({
    error: "api key missing or invalid",
    code: "API_KEY_INVALID",
  });
});
```

- [ ] **Step 3: Run both test files and verify RED**

Run:

```powershell
pnpm exec vitest run server/routes/auth-session.test.ts server/middleware/apiAccessPolicy.test.ts
```

Expected: route assertions FAIL because `required` is absent. The pipeline test may already reach the write middleware after Task 1; keep it as the regression proving the security boundary.

- [ ] **Step 4: Implement the status contract**

Import `isDashboardAccessRequired` in `server/routes/auth-session.ts` and return:

```ts
authSessionRouter.get("/access-session", (req: Request, res: Response) => {
  const required = isDashboardAccessRequired();
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    authenticated: required ? hasDashboardAccess(req) : true,
    configured: isDashboardAccessConfigured(),
    required,
    expiresInSeconds: DASHBOARD_ACCESS_SESSION_TTL_SECONDS,
  });
});
```

In `scripts/verify-release-guards.ts`, add `DASHBOARD_ACCESS_ENABLED: "1"` to the fixture that creates and uses a dashboard viewer session so the release guard continues to test the retained enabled path.

- [ ] **Step 5: Run server access tests and release guards**

Run:

```powershell
pnpm exec vitest run server/middleware/auth.test.ts server/routes/auth-session.test.ts server/middleware/apiAccessPolicy.test.ts
pnpm run verify:release-guards
```

Expected: all Vitest cases pass and the release guard ends with `[release-guard] all checks passed`.

### Task 3: Client gate behavior

**Files:**
- Create: `client/src/lib/dashboardAccess.test.ts`
- Modify: `client/src/lib/dashboardAccess.ts`
- Modify: `client/src/components/DashboardAccessGate.tsx`

- [ ] **Step 1: Write failing client contract tests**

Create `client/src/lib/dashboardAccess.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDashboardAccessStatus,
  shouldShowDashboardAccessLogin,
  shouldShowDashboardAccessLogout,
} from "./dashboardAccess";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("dashboard access toggle", () => {
  it("parses disabled viewer access as authenticated and not required", async () => {
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            authenticated: true,
            configured: true,
            required: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    await expect(getDashboardAccessStatus()).resolves.toEqual({
      authenticated: true,
      configured: true,
      reachable: true,
      required: false,
    });
  });

  it("hides both viewer login and logout UI while access is not required", () => {
    const status = {
      authenticated: true,
      configured: true,
      reachable: true,
      required: false,
    };

    expect(shouldShowDashboardAccessLogin(status)).toBe(false);
    expect(shouldShowDashboardAccessLogout(status)).toBe(false);
  });

  it("shows the retained login flow when viewer access is required", () => {
    expect(
      shouldShowDashboardAccessLogin({
        authenticated: false,
        configured: true,
        reachable: true,
        required: true,
      })
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run the client test and verify RED**

Run:

```powershell
pnpm exec vitest run client/src/lib/dashboardAccess.test.ts
```

Expected: FAIL because `required` and both UI-decision helpers do not exist.

- [ ] **Step 3: Implement the client contract and helpers**

Add `required: boolean` to `DashboardAccessStatus`. Use fail-closed defaults when the server is unavailable or does not yet publish the field:

```ts
return {
  authenticated: Boolean(payload?.authenticated),
  configured: Boolean(payload?.configured),
  reachable: true,
  required: payload?.required !== false,
};
```

Every unreachable/SSR return also includes `required: true`. Export:

```ts
export function shouldShowDashboardAccessLogin(
  status: DashboardAccessStatus
): boolean {
  return status.required && !status.authenticated;
}

export function shouldShowDashboardAccessLogout(
  status: DashboardAccessStatus
): boolean {
  return status.required && status.authenticated;
}
```

- [ ] **Step 4: Wire the helpers into the React gate**

Import both helpers in `DashboardAccessGate.tsx`. Preserve `required` when updating status after logout:

```ts
setStatus(current => ({
  authenticated: false,
  configured: current?.configured ?? true,
  reachable: true,
  required: current?.required ?? true,
}));
```

Replace the login condition with:

```ts
if (shouldShowDashboardAccessLogin(status)) {
```

Render the existing fixed logout button only when:

```tsx
{shouldShowDashboardAccessLogout(status) ? (
  <button
    type="button"
    onClick={() => void handleLogout()}
    disabled={loggingOut}
    className="fixed right-4 top-4 z-[90] inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.1] bg-[#080b10]/85 px-3 text-xs font-medium text-slate-400 shadow-lg backdrop-blur-xl transition hover:border-rose-300/25 hover:bg-rose-400/10 hover:text-rose-200 disabled:opacity-50"
    title="退出项目看板"
  >
    {loggingOut ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
    ) : (
      <LogOut className="h-3.5 w-3.5" />
    )}
    安全退出
  </button>
) : null}
```

- [ ] **Step 5: Run client test and typecheck**

Run:

```powershell
pnpm exec vitest run client/src/lib/dashboardAccess.test.ts
pnpm run check
```

Expected: three client tests pass and TypeScript exits with code 0.

### Task 4: Configuration documentation and complete verification

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Document the reversible switch**

Place the switch directly before `DASHBOARD_ACCESS_PASSWORD` in `.env.example`:

```dotenv
# Viewer login is disabled unless this is set to 1 or true.
# Re-enable later without restoring code by setting DASHBOARD_ACCESS_ENABLED=1.
DASHBOARD_ACCESS_ENABLED=0
DASHBOARD_ACCESS_PASSWORD=replace-with-a-dashboard-viewer-password
```

Do not remove or blank the password example.

- [ ] **Step 2: Run focused regression tests**

Run:

```powershell
pnpm exec vitest run server/middleware/auth.test.ts server/routes/auth-session.test.ts server/middleware/apiAccessPolicy.test.ts client/src/lib/dashboardAccess.test.ts client/src/pages/dashboard/lib/dashboardApi.test.ts
```

Expected: all selected test files and cases pass with zero failures.

- [ ] **Step 3: Run full release-oriented verification**

Run:

```powershell
pnpm run check
pnpm run verify:release-guards
pnpm run build
pnpm run verify:oss-api:local
```

Expected: TypeScript exits 0, release guards pass, the Vite/server production build completes, and the OSS smoke reports `[SUCCESS] Local OSS smoke passed.`

- [ ] **Step 4: Inspect the final diff and stage exact files**

Run:

```powershell
git diff --check
git diff --stat
git add -- .env.example server/middleware/auth.ts server/middleware/auth.test.ts server/routes/auth-session.ts server/routes/auth-session.test.ts server/middleware/apiAccessPolicy.test.ts scripts/verify-release-guards.ts client/src/lib/dashboardAccess.ts client/src/lib/dashboardAccess.test.ts client/src/components/DashboardAccessGate.tsx docs/superpowers/plans/2026-07-28-dashboard-access-toggle.md
git status --short
```

Expected: only the listed implementation, test, configuration, and plan files are staged; no unrelated file is modified or untracked.

- [ ] **Step 5: Human commit and standard release**

Per repository SOP, the human developer performs the commit:

```powershell
git commit -m "feat: make dashboard viewer login configurable"
```

After human confirmation, push the current branch and publish only through:

```powershell
git push origin release/fix3-c282f36
pnpm run release -- -ReleaseNote "默认关闭看板入口密码并保留可重新启用开关"
```

Expected: remote Git points to the new commit; the canonical release flow creates a backup, deploys an immutable artifact, verifies the remote commit, and passes remote OSS/reliability smoke tests.
