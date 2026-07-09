import "./final-sample-report/styles/final-sample-report.css"
import { FinalSampleReportPage } from "./final-sample-report/source-page"
import { FinalSampleReportDataProvider } from "./final-sample-report/report-data-context"

export default function FinalSampleReportDashboard() {
  return (
    <div className="final-sample-report-bleed final-sample-report-scope">
      <FinalSampleReportDataProvider>
        <FinalSampleReportPage />
      </FinalSampleReportDataProvider>
    </div>
  )
}
