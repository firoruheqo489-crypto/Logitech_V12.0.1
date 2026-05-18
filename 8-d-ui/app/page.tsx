import { DisciplineCard } from "@/components/report-8d/discipline-card"
import { ReportHeader } from "@/components/report-8d/report-header"
import {
  D0Content,
  D1Content,
  D2Content,
  D3Content,
  D4Content,
  D5Content,
  D6Content,
  D7Content,
  D8Content,
} from "@/components/report-8d/discipline-sections"

export default function Report8DPage() {
  return (
    <div className="min-h-screen bg-background py-6 px-4">
      <div className="mx-auto max-w-4xl">
        <ReportHeader
          reportNo="8D-202605-001"
          customer="Nordic Outdoor Lighting Inc."
          product="150W LED 路灯 (IP66)"
          defectIssue="进水 / LED阵列短路"
          dateOpened="2026-05-18"
          currentStatus="D4 根因分析 - 进行中"
          statusVariant="secondary"
          champion="左聪 (DQE)"
        />

        <DisciplineCard disciplineNumber="D0" title="问题准备与紧急响应">
          <D0Content />
        </DisciplineCard>

        <DisciplineCard disciplineNumber="D1" title="团队组建">
          <D1Content />
        </DisciplineCard>

        <DisciplineCard disciplineNumber="D2" title="问题描述 (5W2H)">
          <D2Content />
        </DisciplineCard>

        <DisciplineCard disciplineNumber="D3" title="临时遏制措施 (ICA)">
          <D3Content />
        </DisciplineCard>

        <DisciplineCard disciplineNumber="D4" title="根本原因分析">
          <D4Content />
        </DisciplineCard>

        <DisciplineCard disciplineNumber="D5" title="永久纠正措施 (PCA)">
          <D5Content />
        </DisciplineCard>

        <DisciplineCard disciplineNumber="D6" title="实施与验证 PCA">
          <D6Content />
        </DisciplineCard>

        <DisciplineCard disciplineNumber="D7" title="防止再发 (系统更新)">
          <D7Content />
        </DisciplineCard>

        <DisciplineCard disciplineNumber="D8" title="结案与团队认可">
          <D8Content />
        </DisciplineCard>

        <footer className="text-center text-muted-foreground text-xs py-6 border-t border-border mt-6">
          <p>8D 纠正措施报告系统 v1.0 | LED照明行业专用</p>
          <p className="mt-1">© 2026 Quality Engineering Department</p>
        </footer>
      </div>
    </div>
  )
}
