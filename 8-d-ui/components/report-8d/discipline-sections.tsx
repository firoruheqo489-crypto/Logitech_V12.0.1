"use client"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

// D0: 问题准备与紧急响应
export function D0Content() {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <Badge variant="destructive" className="mt-0.5">
          紧急
        </Badge>
        <p>仓库库存及在途货物隔离状态</p>
      </div>
      <div className="bg-secondary/50 rounded p-4 border border-border">
        <p className="text-sm">
          已隔离仓库内 <span className="font-mono font-bold text-accent">450</span> 台库存。
          生产线 <span className="font-mono font-bold text-destructive">2号线</span> 已停线待查。
          在途货物 <span className="font-mono font-bold text-accent">120</span> 台已通知物流暂停发货。
        </p>
      </div>
    </div>
  )
}

// D1: 团队组建
interface TeamMember {
  name: string
  department: string
  role: string
}

export function D1Content() {
  const teamMembers: TeamMember[] = [
    { name: "左聪", department: "品质部", role: "项目负责人 (Champion)" },
    { name: "张伟", department: "研发部", role: "技术分析" },
    { name: "李明", department: "供应商质量", role: "SQE" },
    { name: "王芳", department: "生产部", role: "工艺工程师" },
    { name: "赵强", department: "客服部", role: "客户对接" },
  ]

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border">
          <TableHead className="text-muted-foreground">姓名</TableHead>
          <TableHead className="text-muted-foreground">部门</TableHead>
          <TableHead className="text-muted-foreground">角色</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {teamMembers.map((member, index) => (
          <TableRow key={index} className="border-border">
            <TableCell className="font-medium">{member.name}</TableCell>
            <TableCell>{member.department}</TableCell>
            <TableCell>{member.role}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// D2: 问题描述 (5W2H)
interface W5H2Item {
  label: string
  value: string
}

export function D2Content() {
  const items: W5H2Item[] = [
    { label: "Who (谁)", value: "终端用户 - Nordic Outdoor Lighting Inc." },
    { label: "What (什么)", value: "LED阵列短路导致灯具失效" },
    { label: "Where (哪里)", value: "挪威奥斯陆市政道路照明项目现场" },
    { label: "When (何时)", value: "2026年5月16日，连续暴雨后2天内" },
    { label: "Why (为什么)", value: "内部凝结水导致MCPCB短路" },
    { label: "How (如何)", value: "水汽从密封圈缝隙渗入，在温差作用下凝结于LED基板表面" },
    { label: "How Many (多少)", value: "200台安装量中15台失效，失效率 7.5%" },
  ]

  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <div
          key={index}
          className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 py-2 border-b border-border last:border-b-0"
        >
          <span className="text-primary font-medium text-sm min-w-[120px]">
            {item.label}
          </span>
          <span className="text-card-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

// D3: 临时遏制措施 (ICA)
interface ContainmentAction {
  action: string
  owner: string
  date: string
  status: "completed" | "in-progress" | "pending"
}

export function D3Content() {
  const actions: ContainmentAction[] = [
    {
      action: "对当前在制品100%进行手动IP65气压测试",
      owner: "王芳",
      date: "2026-05-18",
      status: "completed",
    },
    {
      action: "通知客户暂停使用可疑批次产品",
      owner: "赵强",
      date: "2026-05-18",
      status: "completed",
    },
    {
      action: "召回已发货但未安装的50台产品",
      owner: "李明",
      date: "2026-05-19",
      status: "in-progress",
    },
    {
      action: "安排现场技术人员进行失效品取样",
      owner: "张伟",
      date: "2026-05-20",
      status: "pending",
    },
  ]

  const statusConfig = {
    completed: { label: "已完成", variant: "default" as const, className: "bg-green-600/20 text-green-400 border-green-600/30" },
    "in-progress": { label: "进行中", variant: "secondary" as const, className: "bg-amber-600/20 text-amber-400 border-amber-600/30" },
    pending: { label: "待处理", variant: "outline" as const, className: "bg-zinc-600/20 text-zinc-400 border-zinc-600/30" },
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border">
          <TableHead className="text-muted-foreground">措施</TableHead>
          <TableHead className="text-muted-foreground">责任人</TableHead>
          <TableHead className="text-muted-foreground">日期</TableHead>
          <TableHead className="text-muted-foreground">状态</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {actions.map((action, index) => (
          <TableRow key={index} className="border-border">
            <TableCell>{action.action}</TableCell>
            <TableCell>{action.owner}</TableCell>
            <TableCell className="font-mono text-sm">{action.date}</TableCell>
            <TableCell>
              <Badge className={cn("text-xs", statusConfig[action.status].className)}>
                {statusConfig[action.status].label}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// D4: 根本原因分析
export function D4Content() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <h3 className="text-amber-400 font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          发生原因 (Why did it happen?)
        </h3>
        <div className="bg-secondary/50 rounded p-4 border border-border space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">直接原因：</span>
            密封垫圈在螺丝紧固时发生形变，导致IP防护等级降低
          </p>
          <p>
            <span className="text-muted-foreground">根因 (5-Why)：</span>
            手动拧紧扭矩不一致，部分工位扭矩超标导致垫圈永久变形
          </p>
          <p>
            <span className="text-muted-foreground">系统原因：</span>
            未对关键装配工序设定扭矩管控标准
          </p>
        </div>
      </div>
      <div className="space-y-3">
        <h3 className="text-red-400 font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-400"></span>
          逃逸原因 (Why wasn&apos;t it detected?)
        </h3>
        <div className="bg-secondary/50 rounded p-4 border border-border space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">检测遗漏：</span>
            IP测试仅按1/1000抽检执行，未能覆盖异常批次
          </p>
          <p>
            <span className="text-muted-foreground">过程缺陷：</span>
            缺少在线实时扭矩监控反馈机制
          </p>
          <p>
            <span className="text-muted-foreground">标准缺失：</span>
            PFMEA中未识别该失效模式风险
          </p>
        </div>
      </div>
    </div>
  )
}

// D5: 永久纠正措施 (PCA)
interface CorrectiveAction {
  action: string
  type: string
  owner: string
  targetDate: string
}

export function D5Content() {
  const actions: CorrectiveAction[] = [
    {
      action: "引入自动扭矩电动螺丝刀 (硬件防错)",
      type: "设备升级",
      owner: "王芳",
      targetDate: "2026-06-01",
    },
    {
      action: "设定扭矩上下限报警阈值 (0.8-1.2 N·m)",
      type: "参数管控",
      owner: "王芳",
      targetDate: "2026-06-01",
    },
    {
      action: "IP测试抽检比例提升至1/100",
      type: "检验升级",
      owner: "左聪",
      targetDate: "2026-05-25",
    },
    {
      action: "新增温度冲击 + IP66喷淋组合测试",
      type: "测试新增",
      owner: "张伟",
      targetDate: "2026-06-15",
    },
  ]

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border">
          <TableHead className="text-muted-foreground">永久纠正措施</TableHead>
          <TableHead className="text-muted-foreground">类型</TableHead>
          <TableHead className="text-muted-foreground">责任人</TableHead>
          <TableHead className="text-muted-foreground">目标日期</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {actions.map((action, index) => (
          <TableRow key={index} className="border-border">
            <TableCell>{action.action}</TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs">
                {action.type}
              </Badge>
            </TableCell>
            <TableCell>{action.owner}</TableCell>
            <TableCell className="font-mono text-sm">{action.targetDate}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// D6: 实施与验证 PCA
export function D6Content() {
  return (
    <div className="space-y-4">
      <div className="bg-secondary/50 rounded p-4 border border-border">
        <h4 className="text-primary font-medium mb-2">验证数据</h4>
        <p className="text-sm mb-3">
          使用新扭矩标准对 <span className="font-mono font-bold text-accent">50</span> 台原型机进行验证测试：
        </p>
        <ul className="list-disc list-inside text-sm space-y-1 text-card-foreground">
          <li>温度冲击测试 (-40°C ~ +85°C, 100 cycles): <span className="text-green-400 font-medium">全部通过</span></li>
          <li>IP66喷淋测试 (6小时持续): <span className="text-green-400 font-medium">全部通过</span></li>
          <li>扭矩一致性验证 (Cpk): <span className="text-green-400 font-medium">1.67 (目标 ≥1.33)</span></li>
        </ul>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Badge className="bg-green-600/20 text-green-400 border-green-600/30">验证通过</Badge>
        <span className="text-muted-foreground">验证完成日期: 2026-06-10</span>
      </div>
    </div>
  )
}

// D7: 防止再发 (系统更新)
export function D7Content() {
  const updates = [
    { tag: "PFMEA 已更新", color: "bg-blue-600/20 text-blue-400 border-blue-600/30" },
    { tag: "控制计划 已更新", color: "bg-blue-600/20 text-blue-400 border-blue-600/30" },
    { tag: "SOP Rev 3.0 已发布", color: "bg-green-600/20 text-green-400 border-green-600/30" },
    { tag: "作业指导书 已更新", color: "bg-blue-600/20 text-blue-400 border-blue-600/30" },
    { tag: "供应商通知 已发送", color: "bg-amber-600/20 text-amber-400 border-amber-600/30" },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {updates.map((update, index) => (
          <Badge key={index} className={cn("text-xs", update.color)}>
            {update.tag}
          </Badge>
        ))}
      </div>
      <div className="bg-secondary/50 rounded p-4 border border-border text-sm">
        <p className="text-muted-foreground mb-2">横向展开措施:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>同系列产品 (100W/200W/250W Street Light) 同步更新扭矩标准</li>
          <li>培训计划已纳入新员工入职培训清单</li>
          <li>内部审核检查表已增加扭矩管控检查项</li>
        </ul>
      </div>
    </div>
  )
}

// D8: 结案与团队认可
export function D8Content() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-secondary/50 rounded p-4 border border-border">
          <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
            客户确认日期
          </p>
          <p className="font-mono font-medium text-foreground">2026-06-18</p>
        </div>
        <div className="bg-secondary/50 rounded p-4 border border-border">
          <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
            内部结案日期
          </p>
          <p className="font-mono font-medium text-foreground">2026-06-20</p>
        </div>
      </div>
      <div className="bg-secondary/50 rounded p-4 border border-border">
        <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">
          结案总结
        </p>
        <p className="text-sm leading-relaxed">
          本次8D纠正措施已全部完成并经客户确认。通过引入自动扭矩控制设备和提升IP测试频率，
          有效消除了因扭矩不一致导致的密封失效风险。后续将持续监控量产数据，确保措施有效性。
        </p>
      </div>
      <div className="text-sm text-muted-foreground">
        <p>感谢项目团队的专业贡献与高效协作。</p>
      </div>
    </div>
  )
}
