import { loadBatteryDataset } from '@/lib/battery-data'
import { BatteryDashboard } from '@/components/dashboard/battery-dashboard'

export default async function Page() {
  const dataset = await loadBatteryDataset()
  return <BatteryDashboard dataset={dataset} />
}
