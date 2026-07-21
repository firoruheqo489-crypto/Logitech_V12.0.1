"use client"

import { useState } from "react"
import "./pilot-production.css"
import { AlertTriangle, ArrowRight, BookOpen, Check, ChevronDown, Clock3, Factory, Fullscreen, Gauge, Lightbulb, RefreshCw, ShieldCheck, Thermometer, Users, Zap } from "lucide-react"

const team = [["统筹","周明","总控",4],["研发","李维","光学",2],["电子","陈工","驱动",1],["结构","赵凯","散热",3],["采购","王莉","物料",1],["品质","许妍","验证",2],["生产","何勇","装配",0],["工艺","林森","制程",1]]
const issues = [
  {id:"PL-017",title:"连续点亮后色温漂移超限",type:"光学",level:"高风险",owner:"李维",due:"今日 18:00",status:"验证中",desc:"样灯连续点亮 4 小时后，色温由 4000K 漂移至 4286K，超过规格上限 175K。异常集中在第三组灯珠区域。",root:"散热硅脂涂布不均，局部结温偏高",quick:"硅脂网板开孔优化，首件增加称重检查",permanent:"铝基板铜箔 1oz 调整为 2oz，输出功率下调 2.5%"},
  {id:"PL-014",title:"灯罩卡扣装配间隙偏大",type:"结构",level:"中风险",owner:"赵凯",due:"明日 12:00",status:"待处理",desc:"灯罩左侧卡扣装配后出现 0.8mm 可见间隙，振动测试伴随轻微异响。",root:"模具收缩补偿不足，卡扣尺寸处于下限",quick:"本批次分档装配并执行塞尺全检",permanent:"修正卡扣根部尺寸，增加止口预压量"},
  {id:"PL-009",title:"驱动板高压区爬电距离不足",type:"电子",level:"高风险",owner:"陈工",due:"已逾期 2h",status:"已阻塞",desc:"高压输入端与低压控制区最小爬电距离仅 5.4mm，未达到设计规范。",root:"PCB 改版后安规边界未同步锁定",quick:"暂停当前版本投产并隔离在制品",permanent:"移动器件并增加隔离槽，安规边界纳入 DRC"},
  {id:"PL-005",title:"标签耐擦拭测试字迹变淡",type:"物料",level:"低风险",owner:"王莉",due:"07月16日",status:"待验证",desc:"酒精擦拭 12 次后批次号对比度下降，不满足内部标准。",root:"供应商油墨固化温度波动",quick:"当前批次增加 20 次擦拭抽检",permanent:"切换耐酒精油墨并锁定固化曲线"},
]
const filters=["全部","高风险","待验证","已阻塞"]

function Heading({n,en,cn}:{n:string;en:string;cn:string}){return <div className="section-heading"><span>{n}</span><div><p>{en}</p><h2>{cn}</h2></div></div>}
function Mini({label,value,note,tone="default"}:{label:string;value:string;note:string;tone?:string}){return <div className={`mini-stat ${tone}`}><p>{label}</p><strong>{value}</strong><span>{note}</span></div>}
function Evidence({mode,title}:{mode:"thermal"|"curve";title:string}){return <figure className={`evidence ${mode}`}><div className="evidence-head"><span>{title}</span><span>REC · 14:32:08</span></div><div className="measure-grid">{mode==="thermal"?<><i className="hotspot h1">P1</i><i className="hotspot h2">P2</i><div className="temp-scale"><span>92°</span><span>54°</span><span>26°</span></div></>:<><div className="target-line"/><span className="curve-label">目标线 175K</span></>}</div><figcaption><span>样本 V-P2-0714B</span><span>{mode==="thermal"?"MAX 83.6°C":"8h / 92K"}</span></figcaption></figure>}

export function PilotDashboard(){
 const [selected,setSelected]=useState(0),[filter,setFilter]=useState("全部"),[refreshing,setRefreshing]=useState(false),[stored,setStored]=useState(false)
 const issue=issues[selected], visible=issues.filter(i=>filter==="全部"||i.level===filter||i.status===filter)
 const refresh=()=>{setRefreshing(true);setTimeout(()=>setRefreshing(false),900)}
 return <div className="pilot-production-scope min-h-screen bg-[#000] text-[#f4f2ed]">
  <header className="command-header"><div className="shell flex items-center justify-between gap-4 py-3"><div className="flex min-w-0 items-center gap-3"><div className="brand-mark"><Lightbulb/></div><div><p className="text-sm font-semibold tracking-wide">LUMINA · 试产指挥舱</p><p className="text-[10px] uppercase tracking-[.2em] text-muted-foreground">NPI Control Center</p></div></div><button className="product-switch hidden md:flex">星澜 Pro 吸顶灯 · P2 <ChevronDown/></button><div className="flex items-center gap-2"><span className="live hidden lg:flex"><i/>LIVE · DAY 2/3</span><button className="icon-button" aria-label="刷新" onClick={refresh}><RefreshCw className={refreshing?"animate-spin":""}/></button><button className="icon-button" aria-label="全屏" onClick={()=>document.documentElement.requestFullscreen?.()}><Fullscreen/></button></div></div></header>
  <main className="shell py-6 md:py-8">
   <section className="command-deck"><div className="deck-copy"><div className="kicker"><Factory/> P2 工程试产 / 风险收敛阶段</div><p className="release-state"><span/>当前判定：有条件放行</p><h1>距离量产放行<br/><em>还有 4 个关键问题</em></h1><p>优先关闭安规阻塞与色温漂移，下一评审节点为今日 18:30。</p></div><div className="deck-stats"><Mini label="试产进度" value="286 / 320" note="89.4% 已完成"/><Mini label="一次合格率" value="92.6%" note="距离目标 -2.4%" tone="warn"/><Mini label="高风险" value="04" note="其中 1 项阻塞" tone="risk"/><Mini label="闭环率" value="68%" note="11 / 17 已关闭" tone="good"/></div></section>

   <section className="section"><Heading n="01" en="TRIAL TEAM" cn="全链协同与任务负载"/><div className="team-chain">{team.map(([r,n,s,t],i)=><article key={String(r)} className={i===0?"person lead":"person"}><div className="avatar">{String(n).slice(-1)}</div><div className="min-w-0"><strong>{n}</strong><p>{r} · {s}</p></div><span className={Number(t)>2?"todo hot":"todo"}>{t}</span></article>)}</div></section>

   <section className="section"><Heading n="02" en="PILOT PROFILE" cn="试产参数与风险态势"/><div className="profile-grid"><div className="glass parameter-strip">{[["试产周期","07.14 — 07.16"],["产品型号","XL-PRO 36W"],["计划 / 完成","320 / 286 PCS"],["当前节拍","42 PCS / h"]].map(x=><div key={x[0]}><span>{x[0]}</span><strong>{x[1]}</strong></div>)}</div><div className="glass risk-radar"><div><span>问题分类</span><strong>17 TOTAL</strong></div><div className="risk-bar"><i/><i/><i/><i/></div><p><span>光学 6</span><span>结构 5</span><span>电子 4</span><span>物料 2</span></p></div></div></section>

   <section className="section"><Heading n="03" en="ISSUE RESOLUTION" cn="问题决策与解决方案"/><div className="filters">{filters.map(f=><button key={f} className={filter===f?"active":""} onClick={()=>setFilter(f)}>{f}</button>)}</div><div className="issue-layout"><div className="glass issue-list">{visible.map(item=>{const i=issues.indexOf(item);return <button key={item.id} className={selected===i?"issue active":"issue"} onClick={()=>setSelected(i)}><span className="issue-code">{item.id}</span><span className={`severity ${item.level}`}>{item.level}</span><strong>{item.title}</strong><small>{item.owner} · {item.status} · {item.due}</small></button>})}</div><article className="glass issue-detail"><div className="detail-head"><div><span>{issue.id} / {issue.type}</span><h3>{issue.title}</h3></div><b>{issue.level}</b></div><p className="description">{issue.desc}</p><div className="evidence-pair"><Evidence mode="thermal" title="异常区域热成像"/><Evidence mode="curve" title="色温漂移采样曲线"/></div><div className="action-grid"><div><span>01 · 根因判断</span><p>{issue.root}</p></div><div><span>02 · 立即措施</span><p>{issue.quick}</p></div><div><span>03 · 永久措施</span><p>{issue.permanent}</p></div><div className="action-owner"><span>责任 / 期限</span><strong>{issue.owner}</strong><p>{issue.due}</p></div></div></article></div></section>

   <section className="section"><Heading n="04" en="CLOSURE VALIDATION" cn="闭环有效性验证"/><div className="validation-grid"><article className="glass verdict"><div className="verdict-title"><div><ShieldCheck/></div><span><strong>验证通过 · 措施有效</strong><small>品质签核：许妍 / 07.14 17:26</small></span></div><div className="delta-row"><Mini label="改善前" value="+286K" note="超限 111K" tone="risk"/><Mini label="改善后" value="+92K" note="裕量 83K" tone="good"/><Mini label="验证样本" value="3 / 3" note="连续点亮 8h"/></div><ul>{["最高结温下降 8.4°C","3 台复测样机全部通过","工艺参数已纳入受控文件"].map(x=><li key={x}><Check/>{x}</li>)}</ul><div className="conclusion">允许进入下一阶段小批量验证 <ArrowRight/></div></article><div className="evidence-pair"><Evidence mode="thermal" title="改善后热成像"/><Evidence mode="curve" title="8h 稳态验证曲线"/></div></div></section>

   <section className="section last"><Heading n="05" en="KNOWLEDGE DISTILLATION" cn="FMEA 知识蒸馏"/><div className="knowledge-grid"><Knowledge icon={<Thermometer/>} mode="局部热阻" control="铜箔加厚 + 硅脂称重" from="168" to="54"/><Knowledge icon={<Zap/>} mode="安规边界漂移" control="安规边界纳入 DRC" from="240" to="48"/><Knowledge icon={<Gauge/>} mode="卡扣尺寸链异响" control="止口预压 + 尺寸分档" from="126" to="42"/></div><div className="knowledge-cta"><div><BookOpen/><span><strong>3 条经验已具备组织复用价值</strong><small>目标文档：《照明产品设计 FMEA · 2026 Q3》</small></span></div><button onClick={()=>setStored(true)}>{stored?"已纳入知识库":"纳入组织知识库"}</button></div></section>
  </main>
 </div>
}

export default PilotDashboard

function Knowledge({icon,mode,control,from,to}:{icon:React.ReactNode;mode:string;control:string;from:string;to:string}){return <article className="glass knowledge"><div>{icon}<span>建议入库</span></div><p>失效模式</p><h3>{mode}</h3><p>预防控制</p><strong>{control}</strong><footer><s>RPN {from}</s><ArrowRight/><b>RPN {to}</b></footer></article>}
