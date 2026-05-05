"use client"

import { motion } from "framer-motion"
import { Activity, Settings, Database, Cpu } from "lucide-react"

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-black/90 backdrop-blur-2xl">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <motion.div
                className="absolute -inset-2 rounded-2xl bg-[#00E5FF]/20 blur-xl"
                animate={{ opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#00E5FF] to-[#00B8D4] flex items-center justify-center shadow-[0_0_25px_rgba(0,229,255,0.4)]">
                <Activity className="w-5 h-5 text-black" />
              </div>
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">精密注塑田口DOE系统</h1>
              <p className="text-[10px] text-white/40 tracking-wider uppercase">Precision Injection Molding · Taguchi DOE Module v3.0</p>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-6 px-4 py-2 rounded-xl glass-card">
              <div className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-[#00E5FF]/70" />
                <span className="text-[10px] text-white/50 uppercase tracking-wider">Session</span>
                <span className="text-xs font-mono text-[#00E5FF]">DOE-2024-0512</span>
              </div>
              <div className="w-px h-4 bg-white/10" />
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-white/60">Online</span>
                <motion.div
                  className="w-2 h-2 rounded-full bg-emerald-400"
                  animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.1, 0.9] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
            </div>
            <button className="p-2.5 rounded-xl glass-card hover:bg-white/[0.06] transition-all group">
              <Settings className="w-4.5 h-4.5 text-white/40 group-hover:text-white/70 transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
