import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function loadDashboardSource(): Promise<string> {
  return readFile(path.resolve(__dirname, "./pages/dashboard/DashboardHome.tsx"), "utf8")
}

describe("dashboard administrator module visibility", () => {
  it("keeps public navigation only through laboratory report parsing", async () => {
    const source = await loadDashboardSource()

    expect(source).toContain("DASHBOARD_TABS.indexOf('laboratory-pdf-parser') + 1")
    expect(source).toContain("DASHBOARD_TABS.slice(0, PUBLIC_DASHBOARD_TAB_LIMIT)")
    expect(source).not.toContain("EXTRA_PUBLIC_DASHBOARD_TABS")
  })

  it("redirects a logged-out administrator away from hidden modules", async () => {
    const source = await loadDashboardSource()

    expect(source).toContain("if (!isAdminMode && ADMIN_ONLY_DASHBOARD_TABS.includes(currentTab))")
    expect(source).toContain("return 'laboratory-pdf-parser'")
    expect(source).toContain("const visibleTabs = isAdminMode ? DASHBOARD_TABS : PUBLIC_DASHBOARD_TABS")
  })
})
