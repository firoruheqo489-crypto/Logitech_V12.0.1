/// <reference path="../types/multer.d.ts" />
// @ts-ignore local declaration fallback covers runtime usage even when @types/multer is incomplete
import multer from "multer";
import type { MulterFile } from "multer";
import { generateText, Output } from "ai";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import {
  ikTestDataSchema,
  validateEnergyMapping,
  type IKTestData,
} from "../../client/src/pages/dashboard/components/ik-impact/ik-test-data.js";

const MAX_FILE_SIZE = 15 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

const EXTRACTION_PROMPT = `你是工业质量试验报告解析专家。请解析随消息提供的 IK 冲击试验记录 PDF，并严格按 schema 输出。

解析规则：
1. 四块数据必须隔离提取：钢球/设备、图2判定状态、图3 IK 能量、附录图片，禁止字段串扰。
2. 判定项只有明确看到勾选或明确文字结论时才输出 true/false；表单漏勾选、模糊或无法确认时必须输出 null，不得猜测。
3. energy.impactEnergyJ 只返回所选 IK 等级对应的具体数值，不返回整张对照表。常用映射：IK07=2.0J、IK08=5.0J、IK09=10.0J、IK10=20.0J。
4. selectedIKLevel、energy.ikLevel 必须一致。
5. PASS/FAIL 以报告最终结论或勾选结果为准。
6. 日期按 PDF 原文保留；人员字段无法识别时填写“未记录”。
7. appendix.imageSrc 固定返回空字符串。只判断 PDF 是否存在附录试验图片，并给出简短说明。
8. 不要根据文件名臆测正文中不存在的数据。`;

type IkUploadValidation =
  | { ok: true; file: MulterFile & { buffer: Buffer } }
  | { ok: false; status: 400; code: IkPdfRouteErrorCode; error: string };

type IkPdfRouteErrorCode =
  | "IK_PDF_FILE_REQUIRED"
  | "IK_PDF_INVALID_FILE_TYPE"
  | "IK_PDF_EMPTY_FILE"
  | "IK_PDF_FILE_TOO_LARGE"
  | "IK_PDF_SCHEMA_INVALID"
  | "IK_PDF_ENERGY_INVALID"
  | "IK_PDF_PARSE_FAILED";

function sendIkPdfRouteError(
  res: Response,
  status: number,
  code: IkPdfRouteErrorCode,
  error: string,
): void {
  res.status(status).json({ error, code });
}

export function validateIkUpload(file: MulterFile | undefined): IkUploadValidation {
  if (!file) {
    return { ok: false, status: 400, code: "IK_PDF_FILE_REQUIRED", error: "请选择要解析的 PDF 文件" };
  }
  if (file.mimetype !== "application/pdf" && !file.originalname.toLowerCase().endsWith(".pdf")) {
    return { ok: false, status: 400, code: "IK_PDF_INVALID_FILE_TYPE", error: "仅支持 PDF 文件" };
  }
  if (file.size === 0 || !file.buffer?.length) {
    return { ok: false, status: 400, code: "IK_PDF_EMPTY_FILE", error: "PDF 文件为空" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, status: 400, code: "IK_PDF_FILE_TOO_LARGE", error: "PDF 文件不能超过 15 MB" };
  }
  return { ok: true, file: file as MulterFile & { buffer: Buffer } };
}

export function parseAndValidateIkOutput(output: unknown): IKTestData {
  return validateEnergyMapping(ikTestDataSchema.parse(output));
}

async function extractIkTestData(file: MulterFile & { buffer: Buffer }): Promise<IKTestData> {
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
            data: new Uint8Array(file.buffer),
            filename: file.originalname,
          },
        ],
      },
    ],
  });

  return parseAndValidateIkOutput(output);
}

async function handleIkPdfUpload(req: Request, res: Response): Promise<void> {
  const validation = validateIkUpload(req.file);
  if (!validation.ok) {
    sendIkPdfRouteError(res, validation.status, validation.code, validation.error);
    return;
  }

  try {
    const data = await extractIkTestData(validation.file);
    res.status(200).json({ data });
  } catch (error) {
    if (error instanceof ZodError) {
      sendIkPdfRouteError(res, 422, "IK_PDF_SCHEMA_INVALID", "解析结果不符合 IK 试验数据格式");
      return;
    }

    const validationText = String(error);
    const energyMessage = validationText.match(/IK\d{2} 应对应 \d+(?:\.\d+)? J，解析结果不一致/)?.[0];
    if (energyMessage || validationText.includes("解析结果中的 IK 等级不一致")) {
      sendIkPdfRouteError(
        res,
        422,
        "IK_PDF_ENERGY_INVALID",
        energyMessage ?? "解析结果中的 IK 等级不一致",
      );
      return;
    }

    sendIkPdfRouteError(
      res,
      500,
      "IK_PDF_PARSE_FAILED",
      "AI 未能可靠解析该 PDF，请确认文件清晰且属于 IK 试验记录模板后重试",
    );
  }
}

export function parseDashboardIkPdfUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (error: unknown) => {
    if (!error) {
      void handleIkPdfUpload(req, res);
      return;
    }

    if ((error as { code?: unknown } | null)?.code === "LIMIT_FILE_SIZE") {
      sendIkPdfRouteError(res, 400, "IK_PDF_FILE_TOO_LARGE", "PDF 文件不能超过 15 MB");
      return;
    }

    next(error);
  });
}
