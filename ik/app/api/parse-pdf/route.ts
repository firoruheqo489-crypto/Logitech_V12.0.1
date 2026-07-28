import { generateText, Output } from "ai"
import { NextResponse } from "next/server"
import {
  ikTestDataSchema,
  validateEnergyMapping,
} from "@/lib/ik-test-data"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_FILE_SIZE = 15 * 1024 * 1024

const EXTRACTION_PROMPT = `你是工业质量试验报告解析专家。请解析随消息提供的 IK 冲击试验记录 PDF，并严格按 schema 输出。

解析规则：
1. 四块数据必须隔离提取：钢球/设备、图2判定状态、图3 IK 能量、附录图片，禁止字段串扰。
2. 判定项只有明确看到勾选或明确文字结论时才输出 true/false；表单漏勾选、模糊或无法确认时必须输出 null，不得猜测。
3. energy.impactEnergyJ 只返回所选 IK 等级对应的具体数值，不返回整张对照表。常用映射：IK07=2.0J、IK08=5.0J、IK09=10.0J、IK10=20.0J。
4. selectedIKLevel、energy.ikLevel 必须一致。
5. PASS/FAIL 以报告最终结论或勾选结果为准。
6. 日期按 PDF 原文保留；人员字段无法识别时填写“未记录”。
7. appendix.imageSrc 固定返回空字符串。只判断 PDF 是否存在附录试验图片，并给出简短说明。
8. 不要根据文件名臆测正文中不存在的数据。`

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请选择要解析的 PDF 文件" }, { status: 400 })
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "仅支持 PDF 文件" }, { status: 400 })
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "PDF 文件为空" }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "PDF 文件不能超过 15 MB" }, { status: 400 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const { output } = await generateText({
      model: "google/gemini-2.5-flash",
      output: Output.object({ schema: ikTestDataSchema }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACTION_PROMPT },
            {
              type: "file",
              mediaType: "application/pdf",
              data: bytes,
              filename: file.name,
            },
          ],
        },
      ],
    })

    const data = validateEnergyMapping(ikTestDataSchema.parse(output))
    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF 解析失败"
    const isValidationError =
      message.includes("IK 等级") || message.includes("解析结果")

    return NextResponse.json(
      {
        error: isValidationError
          ? message
          : "AI 未能可靠解析该 PDF，请确认文件清晰且属于 IK 试验记录模板后重试",
      },
      { status: isValidationError ? 422 : 500 },
    )
  }
}
