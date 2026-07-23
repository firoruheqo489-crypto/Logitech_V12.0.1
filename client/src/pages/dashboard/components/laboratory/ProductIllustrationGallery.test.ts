import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { clearProductIllustrationSlotImage } from "./ProductIllustrationGallery"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe("product illustration gallery slots", () => {
  it("leaves the deleted slot empty without shifting later images forward", () => {
    const slots = [
      { id: "slot-1", label: "测试项目", imageUrl: "image-1" },
      { id: "slot-2", label: "产品实物", imageUrl: "image-2" },
      { id: "slot-3", label: "防水测试", imageUrl: "image-3" },
      { id: "slot-4", label: "浪涌测试", imageUrl: "image-4" },
    ]

    const result = clearProductIllustrationSlotImage(slots, "slot-2")

    expect(result).toEqual([
      { id: "slot-1", label: "测试项目", imageUrl: "image-1" },
      { id: "slot-2", label: "产品实物", imageUrl: undefined },
      { id: "slot-3", label: "防水测试", imageUrl: "image-3" },
      { id: "slot-4", label: "浪涌测试", imageUrl: "image-4" },
    ])
    expect(slots[1].imageUrl).toBe("image-2")
  })

  it("starts a newly mounted gallery empty instead of restoring browser-cached photos", async () => {
    const source = await readFile(path.resolve(__dirname, "ProductIllustrationGallery.tsx"), "utf8")

    expect(source).not.toContain("readGalleryState")
    expect(source).not.toContain("writeGalleryState")
    expect(source).not.toContain("window.localStorage")
    expect(source).toContain("archivedGalleryState ?? normalizeGalleryState(null)")
  })

  it("shows the complete image inside each fixed gallery slot", async () => {
    const source = await readFile(path.resolve(__dirname, "ProductIllustrationGallery.tsx"), "utf8")

    expect(source).toContain("object-contain p-2")
    expect(source).not.toContain("rounded-lg object-cover")
  })
})
