"use client"

import { useEffect, useState } from "react"
import { IKDashboard } from "@/components/ik-dashboard"
import { PDFUploadPanel } from "@/components/pdf-upload-panel"
import {
  ikTestData,
  type IKTestData,
} from "@/lib/ik-test-data"

export default function Page() {
  const [data, setData] = useState<IKTestData>(ikTestData)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [sourceName, setSourceName] = useState("示例记录")

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [pdfUrl])

  function handleParsed(nextData: IKTestData, file: File) {
    setPdfUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl)
      return URL.createObjectURL(file)
    })
    setData(nextData)
    setSourceName(file.name)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
        <PDFUploadPanel onParsed={handleParsed} />
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>当前数据来源：{sourceName}</span>
          <span>数据仅保留在当前页面，不会保存上传文件</span>
        </div>
      </div>
      <IKDashboard data={data} pdfUrl={pdfUrl} />
    </main>
  )
}
