"use client"

import { motion } from "framer-motion"

interface PremiumToggleProps {
  enabled: boolean
  onToggle: () => void
  label: string
  labelCn: string
}

export function PremiumToggle({ enabled, onToggle, label, labelCn }: PremiumToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`group flex items-center gap-4 w-full p-4 rounded-xl transition-all duration-300 ${
        enabled
          ? "glass-card glow-teal"
          : "glass-inner hover:bg-white/[0.03]"
      }`}
    >
      {/* Toggle Track */}
      <div
        className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
          enabled
            ? "bg-gradient-to-r from-[#00E5FF] to-[#00B8D4] toggle-glow"
            : "bg-white/[0.06] border border-white/[0.10]"
        }`}
      >
        {/* Track Inner Shadow */}
        {!enabled && (
          <div className="absolute inset-0 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]" />
        )}
        {/* Toggle Knob */}
        <motion.div
          className={`absolute top-1 w-6 h-6 rounded-full shadow-lg ${
            enabled
              ? "bg-white"
              : "bg-white/80"
          }`}
          style={{
            boxShadow: enabled
              ? "0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.2)"
              : "0 2px 4px rgba(0,0,0,0.4)"
          }}
          animate={{ x: enabled ? 32 : 4 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </div>

      {/* Labels */}
      <div className="flex flex-col items-start">
        <span className={`text-sm font-medium transition-colors duration-300 ${
          enabled ? "text-[#00E5FF]" : "text-white/60"
        }`}>
          {label}
        </span>
        <span className={`text-xs transition-colors duration-300 ${
          enabled ? "text-white/50" : "text-white/30"
        }`}>
          {labelCn}
        </span>
      </div>

      {/* Status Indicator */}
      <div className="ml-auto flex items-center gap-2">
        <span className={`text-[10px] font-medium uppercase tracking-wider transition-colors ${
          enabled ? "text-[#00E5FF]/80" : "text-white/30"
        }`}>
          {enabled ? "Active" : "Inactive"}
        </span>
        <div className={`relative w-2.5 h-2.5 rounded-full transition-all duration-300 ${
          enabled
            ? "bg-[#00E5FF] status-dot"
            : "bg-white/20"
        }`} />
      </div>
    </button>
  )
}
