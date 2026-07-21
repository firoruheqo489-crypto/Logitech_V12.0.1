import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  title: "Lumina 试产指挥舱",
  description: "照明行业试产问题闭环与 FMEA 知识沉淀看板",
  generator: "v0.app",
}

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#000000",
  userScalable: true,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN" className="bg-background"><body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>{children}{process.env.NODE_ENV === "production" && <Analytics />}</body></html>
}
