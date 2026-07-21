import { describe, expect, it } from "vitest"

import { clearProductIllustrationSlotImage } from "./ProductIllustrationGallery"

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
})
