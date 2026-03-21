import { useState, useMemo, useEffect, useRef } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend,
} from "recharts";

// ── Brand ────────────────────────────────────────────────────────
const B = {
  blue:"#1d4ed8", teal:"#0891b2", green:"#059669", purple:"#7c3aed",
  orange:"#d97706", red:"#dc2626", grey:"#f8fafc", border:"#e2e8f0",
  text:"#0f172a", sub:"#64748b", light:"#94a3b8",
};

// ── Equipment Definitions ────────────────────────────────────────
const EQUIPMENT = [
  {
    id:"TK-101", name:"Pasteurisation Tank", type:"Tank & Vessel", location:"Processing Hall A",
    icon:"🥛", color:B.blue,
    lastCIP:"6h 20m ago", nextScheduled:"2h 00m", aiRecommended:"Now",
    soilingIndex:0.84, biofilmRisk:"HIGH", productResidual:"Milk fat detected",
    cipStatus:"due_early", // normal | in_progress | due_early | overdue | completed
    aiAlert:"Soiling index 0.84 — 34% above threshold. AI recommends immediate CIP to prevent biofilm formation.",
    sensors:{ conductivity:{ val:1.82, unit:"mS/cm", warn:2.0, crit:3.5 }, turbidity:{ val:14.2, unit:"NTU", warn:10, crit:20 }, temperature:{ val:4.2, unit:"°C", warn:8, crit:12 } },
    savings:{ water:"18%", chemical:"22%", time:"25 min" },
    lastCompliance:"PASS", auditId:"CIP-2024-0318-001",
  },
  {
    id:"PL-202", name:"Pipeline Network", type:"Pipelines & Valves", location:"Processing Hall A–B",
    icon:"🔧", color:B.teal,
    lastCIP:"1h 10m ago", nextScheduled:"Running", aiRecommended:"In Progress",
    soilingIndex:0.61, biofilmRisk:"MEDIUM", productResidual:"Whey protein trace",
    cipStatus:"in_progress",
    aiAlert:"CIP cycle running — Phase 3/5 (Acid Wash). Conductivity normal. No anomalies detected.",
    sensors:{ conductivity:{ val:8.4, unit:"mS/cm", warn:7.0, crit:5.0 }, turbidity:{ val:3.1, unit:"NTU", warn:8, crit:15 }, temperature:{ val:65.2, unit:"°C", warn:60, crit:55 } },
    savings:{ water:"21%", chemical:"19%", time:"18 min" },
    lastCompliance:"PASS", auditId:"CIP-2024-0319-004",
  },
  {
    id:"HX-303", name:"Heat Exchanger", type:"Heat Exchanger", location:"Pasteurisation Unit",
    icon:"♨️", color:B.orange,
    lastCIP:"4h 05m ago", nextScheduled:"8h 00m", aiRecommended:"On Schedule",
    soilingIndex:0.28, biofilmRisk:"LOW", productResidual:"Clean",
    cipStatus:"completed",
    aiAlert:"All parameters within spec. Next CIP on schedule. Fouling factor nominal at 0.28.",
    sensors:{ conductivity:{ val:0.45, unit:"mS/cm", warn:2.0, crit:3.5 }, turbidity:{ val:1.2, unit:"NTU", warn:10, crit:20 }, temperature:{ val:3.8, unit:"°C", warn:8, crit:12 } },
    savings:{ water:"15%", chemical:"28%", time:"30 min" },
    lastCompliance:"PASS", auditId:"CIP-2024-0319-002",
  },
  {
    id:"FL-404", name:"Filler Line A", type:"Filler & Packaging", location:"Packaging Hall",
    icon:"🏭", color:B.purple,
    lastCIP:"3h 40m ago", nextScheduled:"6h 20m", aiRecommended:"4h 30m",
    soilingIndex:0.71, biofilmRisk:"MEDIUM-HIGH", productResidual:"Cream residual",
    cipStatus:"due_early",
    aiAlert:"Cream residual buildup detected. AI recommends advancing CIP by 1h 50m to prevent quality deviation.",
    sensors:{ conductivity:{ val:1.45, unit:"mS/cm", warn:2.0, crit:3.5 }, turbidity:{ val:8.6, unit:"NTU", warn:10, crit:20 }, temperature:{ val:5.1, unit:"°C", warn:8, crit:12 } },
    savings:{ water:"24%", chemical:"17%", time:"20 min" },
    lastCompliance:"PASS", auditId:"CIP-2024-0318-003",
  },
  {
    id:"SP-505", name:"Separator Unit", type:"Separator & Centrifuge", location:"Separation Hall",
    icon:"⚙️", color:B.red,
    lastCIP:"9h 55m ago", nextScheduled:"Overdue", aiRecommended:"IMMEDIATE",
    soilingIndex:0.96, biofilmRisk:"CRITICAL", productResidual:"Fat & protein buildup",
    cipStatus:"overdue",
    aiAlert:"CRITICAL: Soiling index 0.96. CIP overdue by 1h 55m. Biofilm risk HIGH. Immediate CIP required — product quality at risk.",
    sensors:{ conductivity:{ val:3.8, unit:"mS/cm", warn:2.0, crit:3.5 }, turbidity:{ val:22.4, unit:"NTU", warn:10, crit:20 }, temperature:{ val:9.8, unit:"°C", warn:8, crit:12 } },
    savings:{ water:"12%", chemical:"8%", time:"10 min" },
    lastCompliance:"CONDITIONAL", auditId:"CIP-2024-0317-005",
  },
];

// ── CIP Phases ────────────────────────────────────────────────────
const CIP_PHASES = [
  { id:"prerinse",  label:"Pre-rinse",    icon:"💧", color:B.teal,   duration:5,  temp:40,  chemical:"Water", conc:"—",      flow:800, purpose:"Flush loose residuals" },
  { id:"caustic",   label:"Caustic Wash", icon:"🧪", color:B.orange, duration:20, temp:75,  chemical:"NaOH",  conc:"2.0%",   flow:600, purpose:"Remove organic soils & fats" },
  { id:"acid",      label:"Acid Wash",    icon:"⚗️", color:B.purple, duration:15, temp:65,  chemical:"HNO₃",  conc:"1.5%",   flow:600, purpose:"Remove mineral deposits & scale" },
  { id:"postrinse", label:"Post-rinse",   icon:"🚿", color:B.blue,   duration:8,  temp:40,  chemical:"Water", conc:"—",      flow:800, purpose:"Flush chemical residuals" },
  { id:"sanitise",  label:"Sanitise",     icon:"✅", color:B.green,  duration:10, temp:25,  chemical:"PAA",   conc:"0.2%",   flow:400, purpose:"Final microbial elimination" },
];

// ── Synthetic historical data ─────────────────────────────────────
const genCycleHistory = () => Array.from({length:30},(_,i)=>({
  day:`D${i+1}`,
  duration: Math.round(55+Math.random()*12-(i>20?8:0)),
  water: Math.round(1800+Math.random()*200-(i>20?320:0)),
  chemical: +(1.8+Math.random()*0.3-(i>20?0.4:0)).toFixed(2),
  soilingAtCIP: +(0.6+Math.random()*0.25-(i>20?0.18:0)).toFixed(2),
}));

const genSoilingTrend = (eq) => {
  const d=[]; let val=0.1;
  for(let h=0;h<24;h++){
    val=Math.min(1.0,val+0.03+Math.random()*0.02+(h>16?0.04:0));
    d.push({hour:`${h}:00`,soiling:+val.toFixed(2),threshold:0.65});
  }
  return d;
};

const genPhaseSensorData = (phase) => Array.from({length:20},(_,i)=>({
  t:`${i*30}s`,
  conductivity: +(phase.id==="caustic"?8+Math.sin(i*0.5)*0.8:phase.id==="acid"?6+Math.sin(i*0.4)*0.6:0.5+Math.random()*0.3).toFixed(2),
  temperature: +(phase.temp-5+Math.min(i*0.5,5)+Math.random()*1.5).toFixed(1),
  flow: +(phase.flow-50+Math.random()*80).toFixed(0),
}));

const CYCLE_HISTORY = genCycleHistory();

const COMPLIANCE_LOG = [
  { id:"CIP-2024-0319-004", eq:"PL-202", date:"2026-03-19 10:42", status:"IN PROGRESS", phases:3, operator:"Auto", duration:"—", result:"RUNNING" },
  { id:"CIP-2024-0319-003", eq:"TK-101", date:"2026-03-19 04:18", status:"COMPLETED",   phases:5, operator:"Auto", duration:"56 min", result:"PASS" },
  { id:"CIP-2024-0319-002", eq:"HX-303", date:"2026-03-19 06:55", status:"COMPLETED",   phases:5, operator:"Auto", duration:"49 min", result:"PASS" },
  { id:"CIP-2024-0318-005", eq:"SP-505", date:"2026-03-18 23:58", status:"COMPLETED",   phases:5, operator:"Auto", duration:"61 min", result:"CONDITIONAL" },
  { id:"CIP-2024-0318-004", eq:"FL-404", date:"2026-03-18 21:20", status:"COMPLETED",   phases:5, operator:"Auto", duration:"52 min", result:"PASS" },
  { id:"CIP-2024-0318-003", eq:"PL-202", date:"2026-03-18 17:44", status:"COMPLETED",   phases:5, operator:"Manual", duration:"68 min", result:"PASS" },
  { id:"CIP-2024-0318-002", eq:"HX-303", date:"2026-03-18 12:30", status:"COMPLETED",   phases:5, operator:"Auto", duration:"48 min", result:"PASS" },
  { id:"CIP-2024-0318-001", eq:"TK-101", date:"2026-03-18 08:15", status:"COMPLETED",   phases:5, operator:"Auto", duration:"54 min", result:"PASS" },
];

// ── Helper components ─────────────────────────────────────────────
const StatusPill = ({ status }) => {
  const cfg = {
    in_progress:["#eff6ff","#1d4ed8","● IN PROGRESS"],
    due_early:  ["#fffbeb","#d97706","⚠ DUE EARLY"],
    overdue:    ["#fff5f5","#dc2626","🔴 OVERDUE"],
    completed:  ["#f0fdf4","#059669","✓ CLEAN"],
    normal:     ["#f0fdf4","#059669","✓ NORMAL"],
  };
  const [bg,color,label] = cfg[status]||cfg.normal;
  return <span style={{background:bg,color,border:`1px solid ${color}40`,borderRadius:4,padding:"2px 9px",fontSize:10,fontWeight:700,letterSpacing:0.8,whiteSpace:"nowrap"}}>{label}</span>;
};

const CTooltip = ({ active, payload, label }) => {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 14px",fontSize:12,boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}>
      <div style={{color:"#64748b",fontWeight:600,marginBottom:5}}>{label}</div>
      {payload.map((p,i)=>(<div key={i} style={{color:p.color,fontWeight:600}}>{p.name}: {p.value} {p.unit||""}</div>))}
    </div>
  );
};

// ── LIVE CIP Run Simulator ────────────────────────────────────────
function LiveCIPRun({ equipment }) {
  const [activePhase, setActivePhase] = useState(2);
  const [elapsed, setElapsed] = useState(38);
  const [running, setRunning] = useState(true);
  const [anomaly, setAnomaly] = useState(null);
  const timerRef = useRef(null);

  const totalDuration = CIP_PHASES.reduce((s,p)=>s+p.duration,0);
  const completedTime = CIP_PHASES.slice(0,activePhase).reduce((s,p)=>s+p.duration,0);
  const phasePct = Math.min(100,Math.round((elapsed/CIP_PHASES[activePhase].duration)*100));
  const overallPct = Math.min(100,Math.round(((completedTime+elapsed)/totalDuration)*100));

  useEffect(()=>{
    if(running){
      timerRef.current = setInterval(()=>{
        setElapsed(e=>{
          const max = CIP_PHASES[activePhase]?.duration||20;
          if(e>=max-1){
            setActivePhase(p=>Math.min(p+1,CIP_PHASES.length-1));
            return 0;
          }
          // random anomaly
          if(Math.random()<0.015&&!anomaly) setAnomaly("Conductivity spike detected — checking chemical concentration...");
          return e+1;
        });
      },800);
    }
    return()=>clearInterval(timerRef.current);
  },[running,activePhase]);

  const phase = CIP_PHASES[activePhase];
  const sensorData = useMemo(()=>genPhaseSensorData(phase),[activePhase]);

  return (
    <div>
      {/* Phase Progress Bar */}
      <div style={{background:"#fff",border:"2px solid #e2e8f0",borderRadius:12,padding:"18px 20px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontFamily:"Inter,sans-serif",fontSize:16,fontWeight:800,color:B.text}}>Live CIP Run — {equipment.id}</div>
            <div style={{fontSize:12,color:B.sub,marginTop:2}}>{equipment.name} · {equipment.type}</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{fontSize:12,color:B.sub}}>Overall: <strong style={{color:B.blue}}>{overallPct}%</strong></div>
            <button onClick={()=>setRunning(r=>!r)} style={{background:running?"#fff5f5":"#f0fdf4",border:`1px solid ${running?"#fecaca":"#bbf7d0"}`,color:running?"#dc2626":"#059669",borderRadius:6,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              {running?"⏸ Pause":"▶ Resume"}
            </button>
          </div>
        </div>

        {/* Phase steps */}
        <div style={{display:"flex",gap:4,marginBottom:12}}>
          {CIP_PHASES.map((p,i)=>(
            <div key={p.id} style={{flex:1,textAlign:"center",cursor:"pointer"}} onClick={()=>{setActivePhase(i);setElapsed(0);}}>
              <div style={{height:6,borderRadius:3,background:i<activePhase?"#059669":i===activePhase?p.color:"#e2e8f0",marginBottom:4,transition:"background 0.4s"}}/>
              <div style={{fontSize:9,color:i===activePhase?p.color:i<activePhase?"#059669":B.light,fontWeight:700}}>{p.icon} {p.label}</div>
            </div>
          ))}
        </div>

        {/* Current phase detail */}
        <div style={{background:`${phase.color}08`,border:`2px solid ${phase.color}30`,borderRadius:10,padding:"14px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
            <div>
              <div style={{fontFamily:"Inter,sans-serif",fontSize:15,fontWeight:800,color:phase.color}}>Phase {activePhase+1}/5 — {phase.icon} {phase.label}</div>
              <div style={{fontSize:12,color:B.sub,marginTop:2}}>{phase.purpose}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:"Inter,sans-serif",fontSize:22,fontWeight:800,color:phase.color}}>{elapsed}<span style={{fontSize:12,color:B.light}}>/{phase.duration} min</span></div>
              <div style={{fontSize:10,color:B.light}}>Phase progress</div>
            </div>
          </div>
          <div style={{background:"#fff",borderRadius:4,height:6,marginTop:10}}>
            <div style={{height:6,borderRadius:4,background:phase.color,width:`${phasePct}%`,transition:"width 0.8s"}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginTop:12}}>
            {[
              {label:"Chemical",value:phase.chemical,sub:phase.conc,color:phase.color},
              {label:"Temp Target",value:`${phase.temp}°C`,sub:"±2°C tolerance",color:B.orange},
              {label:"Flow Rate",value:`${phase.flow} L/min`,sub:"Nominal",color:B.teal},
            ].map((k,i)=>(
              <div key={i} style={{background:"#fff",borderRadius:8,padding:"8px 10px",textAlign:"center",border:`1px solid ${k.color}20`}}>
                <div style={{fontSize:9,color:B.light,marginBottom:2}}>{k.label}</div>
                <div style={{fontSize:13,fontWeight:800,color:k.color}}>{k.value}</div>
                <div style={{fontSize:9,color:B.light,marginTop:1}}>{k.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Anomaly alert */}
        {anomaly && (
          <div style={{marginTop:10,background:"#fffbeb",border:"1px solid #fde68a",borderLeft:`4px solid ${B.orange}`,borderRadius:8,padding:"8px 14px",fontSize:12,color:B.orange,fontWeight:600,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            ⚠ {anomaly}
            <button onClick={()=>setAnomaly(null)} style={{background:"none",border:"none",cursor:"pointer",color:B.light,fontSize:13}}>✕</button>
          </div>
        )}
      </div>

      {/* Live sensor chart */}
      <div style={{background:"#fff",border:"2px solid #e2e8f0",borderRadius:12,padding:"16px 18px"}}>
        <div style={{fontFamily:"Inter,sans-serif",fontSize:14,fontWeight:800,color:B.text,marginBottom:14}}>Live Sensor Readings — {phase.label}</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={sensorData} margin={{top:4,right:16,bottom:4,left:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
            <XAxis dataKey="t" stroke="#e2e8f0" tick={{fill:"#94a3b8",fontSize:10}}/>
            <YAxis stroke="#e2e8f0" tick={{fill:"#94a3b8",fontSize:10}} width={32}/>
            <Tooltip content={<CTooltip/>}/>
            <Legend wrapperStyle={{fontSize:11}}/>
            <Line type="monotone" dataKey="conductivity" stroke={phase.color} strokeWidth={2} dot={false} name="Conductivity (mS/cm)"/>
            <Line type="monotone" dataKey="temperature" stroke={B.orange} strokeWidth={2} dot={false} name="Temp (°C)" strokeDasharray="5 3"/>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


// ── Sign-in Screen ──────────────────────────────────────────────
function SignInScreen({ title, subtitle, onSubmit }) {
  const [form, setForm] = useState({ name:"", company:"", email:"" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const set = k => e => setForm(p=>({...p,[k]:e.target.value}));

  const validate = () => {
    const e = {};
    if(!form.name.trim()) e.name = "Required";
    if(!form.company.trim()) e.company = "Required";
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Valid email required";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if(Object.keys(e).length){ setErrors(e); return; }
    setSubmitting(true);
    try {
      await fetch("https://formspree.io/f/xqeywrry", {
        method:"POST",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body: JSON.stringify({
          name:form.name, company:form.company, email:form.email,
          _subject:`AriLinc ${title} Sign-in: ${form.name} — ${form.company}`,
        }),
      });
    } catch(_){}
    onSubmit(form);
  };

  const inp = key => ({
    width:"100%", padding:"11px 14px", borderRadius:8, fontSize:14,
    border:`1.5px solid ${errors[key]?"#fca5a5":"rgba(255,255,255,0.25)"}`,
    outline:"none", fontFamily:"Inter,sans-serif", color:"#0f172a",
    background:"#fff", marginTop:5,
  });
  const lbl = { fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.75)", letterSpacing:0.3 };

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 45%,#3b82f6 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"Inter,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .lb:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(0,0,0,0.2);}
        @media(max-width:480px){.sfc{padding:24px 18px!important;}}
      `}</style>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:64,height:64,background:"rgba(255,255,255,0.15)",borderRadius:16,marginBottom:16,border:"1px solid rgba(255,255,255,0.25)"}}>
            <span style={{fontSize:28}}>⚡</span>
          </div>
          <div style={{fontFamily:"Inter,sans-serif",fontSize:28,fontWeight:800,color:"#fff",marginBottom:4}}>AriLinc</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",letterSpacing:2,textTransform:"uppercase",fontWeight:600,marginBottom:8}}>{title} · by AriPrus</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.65)"}}>{subtitle}</div>
        </div>
        <div className="sfc" style={{background:"rgba(255,255,255,0.08)",backdropFilter:"blur(20px)",borderRadius:20,padding:"32px 32px",border:"1px solid rgba(255,255,255,0.18)",boxShadow:"0 24px 64px rgba(0,0,0,0.35)"}}>
          <div style={{fontFamily:"Inter,sans-serif",fontSize:20,fontWeight:800,color:"#fff",marginBottom:4,textAlign:"center"}}>Sign In</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",textAlign:"center",marginBottom:24}}>Enter your details to access the platform</div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <label style={lbl}>Full Name *</label>
              <input style={inp("name")} value={form.name} onChange={set("name")} />
              {errors.name&&<div style={{fontSize:11,color:"#fca5a5",marginTop:3}}>{errors.name}</div>}
            </div>
            <div>
              <label style={lbl}>Company *</label>
              <input style={inp("company")} value={form.company} onChange={set("company")} />
              {errors.company&&<div style={{fontSize:11,color:"#fca5a5",marginTop:3}}>{errors.company}</div>}
            </div>
            <div>
              <label style={lbl}>Work Email *</label>
              <input type="email" style={inp("email")} value={form.email} onChange={set("email")} />
              {errors.email&&<div style={{fontSize:11,color:"#fca5a5",marginTop:3}}>{errors.email}</div>}
            </div>
          </div>
          <button className="lb" onClick={handleSubmit} disabled={submitting}
            style={{width:"100%",marginTop:28,padding:"14px",background:submitting?"rgba(255,255,255,0.15)":"#fff",color:submitting?"rgba(255,255,255,0.4)":"#1d4ed8",border:"none",borderRadius:10,fontSize:15,fontWeight:800,cursor:submitting?"not-allowed":"pointer",fontFamily:"Inter,sans-serif",transition:"all 0.2s"}}>
            {submitting?"⏳ Launching...":"🚀 Launch Platform"}
          </button>
          <div style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:14}}>
            🔒 Secure · <a href="mailto:info@ariprus.com" style={{color:"rgba(255,255,255,0.6)",textDecoration:"none",fontWeight:600}}>info@ariprus.com</a>
          </div>
        </div>
        <div style={{textAlign:"center",marginTop:18,fontSize:12,color:"rgba(255,255,255,0.25)"}}>
          © 2026 AriPrus · <a href="https://ariprus.com" style={{color:"rgba(255,255,255,0.45)",textDecoration:"none"}}>ariprus.com</a>
        </div>
      </div>
    </div>
  );
}

// ================================================================
//  MAIN COMPONENT
// ================================================================
export default function CIPIntelligence() {
  const [user, setUser] = useState(null);
  const [section, setSection] = useState("equipment");
  const [selectedEq, setSelectedEq] = useState(EQUIPMENT[1]);
  const [scheduleModal, setScheduleModal] = useState(null);
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(()=>{ const t=setInterval(()=>setTime(new Date().toLocaleTimeString()),1000); return()=>clearInterval(t); },[]);

  if(!user) return <SignInScreen title="CIP Intelligence." subtitle="AI-Powered Clean-In-Place · Predictive Scheduling · Compliance" onSubmit={setUser}/>;

  const overdueCount = EQUIPMENT.filter(e=>e.cipStatus==="overdue").length;
  const dueEarlyCount = EQUIPMENT.filter(e=>e.cipStatus==="due_early").length;
  const inProgressCount = EQUIPMENT.filter(e=>e.cipStatus==="in_progress").length;
  const cleanCount = EQUIPMENT.filter(e=>e.cipStatus==="completed").length;

  const totalWaterSaved = 18400;
  const totalChemSaved = 42;
  const totalTimeSaved = 103;
  const totalCO2Saved = 8.4;

  const sections = [
    {key:"equipment", icon:"🏭", label:"Equipment Status"},
    {key:"live",      icon:"▶",  label:"Live CIP Run"},
    {key:"ai",        icon:"🤖", label:"AI Intelligence"},
    {key:"analytics", icon:"📊", label:"Analytics"},
    {key:"compliance",icon:"📋", label:"Compliance Log"},
  ];

  return (
    <div style={{background:B.grey,minHeight:"100vh",color:B.text,fontFamily:"Inter,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,0.05);}
        .sec-btn{padding:12px 18px;border:none;background:none;cursor:pointer;font-family:Inter,sans-serif;font-size:13px;font-weight:600;color:#64748b;border-bottom:3px solid transparent;transition:all 0.2s;white-space:nowrap;}
        .sec-btn:hover{color:#0f172a;background:#f1f5f9;}
        .nb{background:none;border:none;cursor:pointer;padding:7px 12px;border-radius:6px;font-size:12px;font-weight:600;color:#64748b;transition:all 0.2s;font-family:Inter,sans-serif;white-space:nowrap;}
        .nb:hover{background:#e2e8f0;}
        .na{background:#dbeafe!important;color:#1d4ed8!important;}
        .g3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
        .g4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;}
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
        .g5{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;}
        .hdr{background:#fff;border-bottom:1px solid #e2e8f0;padding:10px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;box-shadow:0 1px 4px rgba(0,0,0,0.05);}
        .sec-bar{background:#fff;border-bottom:2px solid #e2e8f0;padding:0 24px;display:flex;overflow-x:auto;}
        .pp{padding:20px 24px 32px;}
        .fw{padding:12px 24px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;background:#fff;}
        @keyframes blink{0%,100%{opacity:1;}50%{opacity:0;}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
        @media(max-width:900px){.g3{grid-template-columns:repeat(2,1fr);}.g4{grid-template-columns:repeat(2,1fr);}.g5{grid-template-columns:repeat(3,1fr);}.g2{grid-template-columns:1fr;}.pp{padding:14px 16px;}.hdr{padding:10px 14px;}.sec-bar{padding:0 14px;}}
        @media(max-width:600px){.g3{grid-template-columns:1fr;}.g4{grid-template-columns:repeat(2,1fr);}.g5{grid-template-columns:repeat(2,1fr);}.g2{grid-template-columns:1fr;}.pp{padding:10px 12px;}.sec-btn{padding:10px 12px;font-size:12px;}.hdr{flex-direction:column;align-items:flex-start;}.fw{flex-direction:column;}}
      `}</style>

      {/* Header */}
      <div className="hdr">
        <div style={{display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <div>
            <div style={{fontFamily:"Inter,sans-serif",fontSize:18,fontWeight:800,color:B.blue}}>AriLinc <span style={{color:B.teal}}>CIP</span> Intelligence</div>
            <div style={{fontSize:11,color:B.light,letterSpacing:0.5}}>Clean-In-Place · Dairy Operations · Powered by AriPrus</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          {overdueCount>0&&<div style={{background:"#fff5f5",border:"1px solid #fecaca",borderRadius:6,padding:"4px 10px",fontSize:12,fontWeight:700,color:"#dc2626"}}>🔴 {overdueCount} Overdue</div>}
          {dueEarlyCount>0&&<div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:6,padding:"4px 10px",fontSize:12,fontWeight:700,color:"#d97706"}}>⚠ {dueEarlyCount} Due Early</div>}
          {inProgressCount>0&&<div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,padding:"4px 10px",fontSize:12,fontWeight:700,color:B.blue,display:"flex",alignItems:"center",gap:5}}><span style={{animation:"blink 1s infinite"}}>●</span> {inProgressCount} Running</div>}
          <div style={{fontSize:12,color:B.light}}>{time}</div>
          <div style={{fontSize:12,color:B.light}}>👋 {user.name} · {user.company}</div>
          <button onClick={()=>setUser(null)} style={{fontSize:11,color:B.light,background:"none",border:`1px solid ${B.border}`,borderRadius:6,padding:"4px 10px",cursor:"pointer"}}>Sign Out</button>
        </div>
      </div>

      {/* Section bar */}
      <div className="sec-bar">
        {sections.map(s=>(
          <button key={s.key} className="sec-btn"
            style={{color:section===s.key?B.blue:B.sub,borderBottom:`3px solid ${section===s.key?B.blue:"transparent"}`,fontWeight:section===s.key?800:600}}
            onClick={()=>setSection(s.key)}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      <div className="pp">

        {/* ── EQUIPMENT STATUS ── */}
        {section==="equipment" && (
          <div>
            {/* Top KPIs */}
            <div className="g4" style={{marginBottom:20}}>
              {[
                {icon:"🏭",label:"Equipment Monitored",value:"5 / 5",sub:"100% coverage",color:B.blue},
                {icon:"🔴",label:"Overdue CIP",value:overdueCount,sub:"Immediate action needed",color:B.red},
                {icon:"⚠️",label:"Due Early (AI)",value:dueEarlyCount,sub:"AI advanced recommendation",color:B.orange},
                {icon:"✅",label:"Clean & Compliant",value:cleanCount,sub:"Last CIP passed",color:B.green},
              ].map((k,i)=>(
                <div key={i} style={{background:"#fff",border:`2px solid ${k.color}25`,borderRadius:12,padding:"16px 18px",borderTop:`4px solid ${k.color}`,boxShadow:"0 2px 6px rgba(0,0,0,0.05)"}}>
                  <div style={{fontSize:22,marginBottom:6}}>{k.icon}</div>
                  <div style={{fontFamily:"Inter,sans-serif",fontSize:26,fontWeight:800,color:k.color}}>{k.value}</div>
                  <div style={{fontSize:12,fontWeight:700,color:"#334155",marginTop:3}}>{k.label}</div>
                  <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Equipment cards */}
            <div style={{fontFamily:"Inter,sans-serif",fontSize:17,fontWeight:800,color:B.text,marginBottom:14}}>CIP Status — All Equipment</div>
            <div className="g3">
              {EQUIPMENT.map(eq=>{
                const soilingData = genSoilingTrend(eq).filter((_,i)=>i%3===0);
                return (
                  <div key={eq.id} style={{background:"#fff",border:`2px solid ${eq.cipStatus==="overdue"?"#fecaca":eq.cipStatus==="in_progress"?"#bfdbfe":eq.cipStatus==="due_early"?"#fde68a":"#e2e8f0"}`,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.05)",transition:"all 0.2s"}}>
                    {/* Card header */}
                    <div style={{padding:"12px 16px",borderBottom:`3px solid ${eq.color}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                          <span style={{fontSize:18}}>{eq.icon}</span>
                          <div style={{fontFamily:"Inter,sans-serif",fontSize:15,fontWeight:800,color:B.text}}>{eq.id}</div>
                        </div>
                        <div style={{fontSize:11,color:B.sub}}>{eq.name}</div>
                        <div style={{fontSize:10,color:B.light}}>{eq.type} · {eq.location}</div>
                      </div>
                      <StatusPill status={eq.cipStatus}/>
                    </div>

                    {/* Soiling trend sparkline */}
                    <div style={{padding:"8px 10px 0",background:"#fafafa"}}>
                      <div style={{fontSize:9,color:B.light,marginBottom:2}}>Soiling Index Trend (24h)</div>
                      <ResponsiveContainer width="100%" height={50}>
                        <AreaChart data={soilingData} margin={{top:2,right:4,bottom:0,left:0}}>
                          <defs><linearGradient id={`sg${eq.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={eq.color} stopOpacity={0.3}/><stop offset="95%" stopColor={eq.color} stopOpacity={0}/></linearGradient></defs>
                          <Area type="monotone" dataKey="soiling" stroke={eq.color} fill={`url(#sg${eq.id})`} strokeWidth={1.5} dot={false}/>
                          <ReferenceLine y={0.65} stroke="#d97706" strokeDasharray="3 2" strokeWidth={1}/>
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Sensor readings */}
                    <div style={{padding:"10px 14px",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,borderTop:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9"}}>
                      {Object.entries(eq.sensors).map(([k,s])=>{
                        const isAlert = k==="conductivity"||k==="turbidity" ? s.val>=s.warn : s.val>=s.warn;
                        const isCrit = k==="conductivity"||k==="turbidity" ? s.val>=s.crit : s.val>=s.crit;
                        const col = isCrit?B.red:isAlert?B.orange:B.green;
                        return (
                          <div key={k} style={{background:`${col}08`,border:`1px solid ${col}25`,borderRadius:6,padding:"5px 7px",textAlign:"center"}}>
                            <div style={{fontSize:8,color:B.light,textTransform:"capitalize",marginBottom:1}}>{k}</div>
                            <div style={{fontSize:12,fontWeight:800,color:col}}>{s.val}</div>
                            <div style={{fontSize:8,color:B.light}}>{s.unit}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* CIP schedule info */}
                    <div style={{padding:"10px 14px"}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                        {[
                          {label:"Last CIP",value:eq.lastCIP,color:B.sub},
                          {label:"Scheduled",value:eq.nextScheduled,color:eq.cipStatus==="overdue"?B.red:B.sub},
                          {label:"AI Recommends",value:eq.aiRecommended,color:eq.cipStatus==="overdue"||eq.cipStatus==="due_early"?B.red:B.green},
                          {label:"Soiling Index",value:eq.soilingIndex,color:eq.soilingIndex>0.8?B.red:eq.soilingIndex>0.6?B.orange:B.green},
                        ].map((f,i)=>(
                          <div key={i}>
                            <div style={{fontSize:9,color:B.light}}>{f.label}</div>
                            <div style={{fontSize:12,fontWeight:700,color:f.color}}>{f.value}</div>
                          </div>
                        ))}
                      </div>
                      {/* AI alert */}
                      <div style={{background:`${eq.cipStatus==="overdue"?B.red:eq.cipStatus==="due_early"?B.orange:B.green}08`,border:`1px solid ${eq.cipStatus==="overdue"?B.red:eq.cipStatus==="due_early"?B.orange:B.green}30`,borderRadius:7,padding:"6px 10px",fontSize:11,color:B.text,lineHeight:1.5,marginBottom:10}}>
                        <strong style={{color:eq.cipStatus==="overdue"?B.red:eq.cipStatus==="due_early"?B.orange:B.green}}>🤖 AI: </strong>{eq.aiAlert}
                      </div>
                      {/* Actions */}
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>{setSelectedEq(eq);setSection("live");}} style={{flex:1,padding:"7px",background:`${eq.color}10`,border:`1px solid ${eq.color}40`,borderRadius:7,fontSize:11,fontWeight:700,color:eq.color,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                          {eq.cipStatus==="in_progress"?"▶ View Live Run":"▶ Start CIP"}
                        </button>
                        <button onClick={()=>setScheduleModal(eq)} style={{padding:"7px 10px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:7,fontSize:11,fontWeight:700,color:B.sub,cursor:"pointer"}}>📅</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── LIVE CIP RUN ── */}
        {section==="live" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{fontFamily:"Inter,sans-serif",fontSize:18,fontWeight:800,color:B.text}}>Live CIP Run Monitor</div>
                <div style={{fontSize:13,color:B.sub,marginTop:2}}>Real-time phase tracking · Sensor monitoring · Anomaly detection</div>
              </div>
              <div style={{display:"flex",gap:6}}>
                {EQUIPMENT.map(e=>(<button key={e.id} onClick={()=>setSelectedEq(e)} style={{background:selectedEq.id===e.id?e.color:"#fff",color:selectedEq.id===e.id?"#fff":B.sub,border:`2px solid ${selectedEq.id===e.id?e.color:B.border}`,borderRadius:6,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{e.id}</button>))}
              </div>
            </div>

            <LiveCIPRun equipment={selectedEq}/>

            {/* Phase reference cards */}
            <div style={{marginTop:16}}>
              <div style={{fontFamily:"Inter,sans-serif",fontSize:15,fontWeight:800,color:B.text,marginBottom:12}}>CIP Phase Parameters</div>
              <div className="g5">
                {CIP_PHASES.map((p,i)=>(
                  <div key={p.id} style={{background:"#fff",border:`2px solid ${p.color}25`,borderRadius:10,padding:"12px 14px",borderTop:`3px solid ${p.color}`}}>
                    <div style={{fontSize:18,marginBottom:5}}>{p.icon}</div>
                    <div style={{fontFamily:"Inter,sans-serif",fontSize:12,fontWeight:800,color:p.color,marginBottom:6}}>{p.label}</div>
                    {[{l:"Duration",v:`${p.duration} min`},{l:"Temp",v:`${p.temp}°C`},{l:"Chemical",v:p.chemical},{l:"Conc.",v:p.conc},{l:"Flow",v:`${p.flow} L/min`}].map((r,j)=>(
                      <div key={j} style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:3}}>
                        <span style={{color:B.light}}>{r.l}</span>
                        <span style={{fontWeight:600,color:B.text}}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── AI INTELLIGENCE ── */}
        {section==="ai" && (
          <div>
            <div style={{fontFamily:"Inter,sans-serif",fontSize:18,fontWeight:800,color:B.text,marginBottom:4}}>🤖 CIP AI Intelligence</div>
            <div style={{fontSize:13,color:B.sub,marginBottom:20}}>Predictive scheduling · Chemical optimisation · Cycle optimisation · Anomaly detection</div>

            {/* AI features */}
            <div className="g2" style={{marginBottom:20}}>
              {/* Predictive scheduling */}
              <div className="card">
                <div style={{fontFamily:"Inter,sans-serif",fontSize:14,fontWeight:800,color:B.blue,marginBottom:4}}>🗓 Predictive CIP Scheduling</div>
                <div style={{fontSize:12,color:B.sub,marginBottom:14}}>AI advances or delays CIP based on actual soiling — not fixed time intervals</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {EQUIPMENT.map(eq=>(
                    <div key={eq.id} style={{background:`${eq.cipStatus==="overdue"?"#fff5f5":eq.cipStatus==="due_early"?"#fffbeb":"#f8fafc"}`,border:`1px solid ${eq.cipStatus==="overdue"?"#fecaca":eq.cipStatus==="due_early"?"#fde68a":"#e2e8f0"}`,borderRadius:8,padding:"10px 12px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:16}}>{eq.icon}</span>
                          <div>
                            <div style={{fontSize:12,fontWeight:700,color:B.text}}>{eq.id} — {eq.name}</div>
                            <div style={{fontSize:10,color:B.light}}>Scheduled: {eq.nextScheduled} · AI: <strong style={{color:eq.cipStatus==="overdue"?B.red:eq.cipStatus==="due_early"?B.orange:B.green}}>{eq.aiRecommended}</strong></div>
                          </div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontFamily:"Inter,sans-serif",fontSize:14,fontWeight:800,color:eq.soilingIndex>0.8?B.red:eq.soilingIndex>0.6?B.orange:B.green}}>{eq.soilingIndex}</div>
                          <div style={{fontSize:9,color:B.light}}>Soiling Index</div>
                        </div>
                      </div>
                      <div style={{marginTop:6,background:"#fff",borderRadius:3,height:5}}>
                        <div style={{height:5,borderRadius:3,width:`${eq.soilingIndex*100}%`,background:eq.soilingIndex>0.8?B.red:eq.soilingIndex>0.6?B.orange:B.green,transition:"width 1s"}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chemical dosing optimisation */}
              <div className="card">
                <div style={{fontFamily:"Inter,sans-serif",fontSize:14,fontWeight:800,color:B.purple,marginBottom:4}}>⚗️ Chemical Dosing Optimisation</div>
                <div style={{fontSize:12,color:B.sub,marginBottom:14}}>AI adjusts NaOH, HNO₃ and PAA concentrations based on soiling severity</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {[
                    {phase:"Caustic Wash (NaOH)",standard:"2.0%",aiOptimal:"1.6%",saving:"20%",color:B.orange},
                    {phase:"Acid Wash (HNO₃)",standard:"1.5%",aiOptimal:"1.2%",saving:"20%",color:B.purple},
                    {phase:"Sanitise (PAA)",standard:"0.2%",aiOptimal:"0.18%",saving:"10%",color:B.green},
                  ].map((c,i)=>(
                    <div key={i} style={{background:`${c.color}06`,border:`1px solid ${c.color}25`,borderRadius:8,padding:"10px 12px"}}>
                      <div style={{fontSize:12,fontWeight:700,color:B.text,marginBottom:6}}>{c.phase}</div>
                      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                        <div style={{textAlign:"center"}}><div style={{fontSize:9,color:B.light}}>Standard</div><div style={{fontSize:13,fontWeight:700,color:"#dc2626"}}>{c.standard}</div></div>
                        <div style={{color:"#e2e8f0",fontSize:14}}>→</div>
                        <div style={{textAlign:"center"}}><div style={{fontSize:9,color:B.light}}>AI Optimal</div><div style={{fontSize:13,fontWeight:700,color:"#059669"}}>{c.aiOptimal}</div></div>
                        <div style={{marginLeft:"auto",background:`${c.color}15`,border:`1px solid ${c.color}40`,borderRadius:5,padding:"3px 8px",fontSize:11,fontWeight:700,color:c.color}}>↓ {c.saving} saved</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:12,background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 12px",fontSize:12}}>
                  <strong style={{color:B.green}}>Monthly saving: </strong><span style={{color:B.text}}>₹42,000 in chemicals · 340 kg less chemical waste · CO₂ reduction: 8.4 tonnes</span>
                </div>
              </div>
            </div>

            {/* Anomaly detection + savings */}
            <div className="g2">
              {/* Anomaly detection */}
              <div className="card">
                <div style={{fontFamily:"Inter,sans-serif",fontSize:14,fontWeight:800,color:B.red,marginBottom:4}}>⚠️ Anomaly Detection During CIP</div>
                <div style={{fontSize:12,color:B.sub,marginBottom:14}}>AI monitors every phase for deviations — alerts operator instantly</div>
                {[
                  {time:"10:42 AM",eq:"PL-202",phase:"Acid Wash",anomaly:"Conductivity drop — possible dilution",severity:"WARN",resolved:false},
                  {time:"08:15 AM",eq:"TK-101",phase:"Caustic Wash",anomaly:"Temperature below setpoint by 3°C",severity:"WARN",resolved:true},
                  {time:"Yesterday",eq:"SP-505",phase:"Post-rinse",anomaly:"Turbidity high after rinse — extended rinse auto-triggered",severity:"ACTION",resolved:true},
                  {time:"Yesterday",eq:"FL-404",phase:"Sanitise",anomaly:"PAA concentration low — AI increased dosing",severity:"ACTION",resolved:true},
                ].map((a,i)=>(
                  <div key={i} style={{background:a.resolved?"#f8fafc":"#fffbeb",border:`1px solid ${a.resolved?"#e2e8f0":"#fde68a"}`,borderLeft:`3px solid ${a.severity==="WARN"?B.orange:B.red}`,borderRadius:7,padding:"8px 12px",marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:4}}>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:B.text}}>{a.eq} — {a.phase}</div>
                        <div style={{fontSize:11,color:B.sub,marginTop:2}}>{a.anomaly}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:9,color:B.light}}>{a.time}</div>
                        <div style={{fontSize:10,fontWeight:700,color:a.resolved?B.green:B.orange,marginTop:2}}>{a.resolved?"✓ Resolved":"● Active"}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cycle savings */}
              <div className="card">
                <div style={{fontFamily:"Inter,sans-serif",fontSize:14,fontWeight:800,color:B.green,marginBottom:4}}>💧 Cycle Time & Resource Savings</div>
                <div style={{fontSize:12,color:B.sub,marginBottom:14}}>AI shortens cycles when equipment is lightly soiled — saves water, time and energy</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                  {[
                    {icon:"💧",label:"Water Saved/Month",value:"18,400 L",color:B.teal},
                    {icon:"⏱",label:"Time Saved/Month",value:"103 min",color:B.blue},
                    {icon:"⚗️",label:"Chemical Saved",value:"42 kg",color:B.purple},
                    {icon:"🌱",label:"CO₂ Reduction",value:"8.4 t",color:B.green},
                  ].map((s,i)=>(
                    <div key={i} style={{background:`${s.color}08`,border:`1px solid ${s.color}25`,borderRadius:10,padding:"12px 14px",textAlign:"center"}}>
                      <div style={{fontSize:22,marginBottom:4}}>{s.icon}</div>
                      <div style={{fontFamily:"Inter,sans-serif",fontSize:18,fontWeight:800,color:s.color}}>{s.value}</div>
                      <div style={{fontSize:10,color:B.sub,marginTop:3}}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px"}}>
                  <div style={{fontSize:12,fontWeight:700,color:B.text,marginBottom:8}}>Per-Equipment Time Savings</div>
                  {EQUIPMENT.map(eq=>(
                    <div key={eq.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{fontSize:11,color:B.sub}}>{eq.icon} {eq.id}</span>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:80,background:"#e2e8f0",borderRadius:3,height:5}}>
                          <div style={{height:5,borderRadius:3,background:eq.color,width:`${parseInt(eq.savings.time)*3}%`}}/>
                        </div>
                        <span style={{fontSize:11,fontWeight:700,color:eq.color,width:40}}>-{eq.savings.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {section==="analytics" && (
          <div>
            <div style={{fontFamily:"Inter,sans-serif",fontSize:18,fontWeight:800,color:B.text,marginBottom:4}}>📊 CIP Analytics — 30 Day Trend</div>
            <div style={{fontSize:13,color:B.sub,marginBottom:20}}>Cycle duration · Resource consumption · Soiling patterns</div>
            <div className="g4" style={{marginBottom:20}}>
              {[
                {icon:"⏱",label:"Avg Cycle Duration",value:"54 min",sub:"↓ 8 min vs manual schedule",color:B.blue},
                {icon:"💧",label:"Water Per Cycle",value:"1,840 L",sub:"↓ 18% vs baseline",color:B.teal},
                {icon:"⚗️",label:"Chemical Per Cycle",value:"1.74 kg",sub:"↓ 22% with AI dosing",color:B.purple},
                {icon:"✅",label:"Compliance Rate",value:"98.7%",sub:"Last 30 days",color:B.green},
              ].map((k,i)=>(
                <div key={i} style={{background:"#fff",border:`2px solid ${k.color}25`,borderRadius:12,padding:"16px 18px",borderTop:`4px solid ${k.color}`,boxShadow:"0 2px 6px rgba(0,0,0,0.05)"}}>
                  <div style={{fontSize:20,marginBottom:5}}>{k.icon}</div>
                  <div style={{fontFamily:"Inter,sans-serif",fontSize:24,fontWeight:800,color:k.color}}>{k.value}</div>
                  <div style={{fontSize:12,fontWeight:700,color:"#334155",marginTop:3}}>{k.label}</div>
                  <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{k.sub}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              <div className="card">
                <div style={{fontFamily:"Inter,sans-serif",fontSize:14,fontWeight:800,color:B.text,marginBottom:3}}>CIP Cycle Duration Trend (30 Days)</div>
                <div style={{fontSize:12,color:B.sub,marginBottom:14}}>AI-optimised cycles shorten over time as soiling patterns are learned</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={CYCLE_HISTORY} margin={{top:4,right:16,bottom:4,left:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                    <XAxis dataKey="day" stroke="#e2e8f0" tick={{fill:"#94a3b8",fontSize:10}} interval={4}/>
                    <YAxis stroke="#e2e8f0" tick={{fill:"#94a3b8",fontSize:10}} width={36} unit=" min"/>
                    <Tooltip content={<CTooltip/>}/>
                    <ReferenceLine y={62} stroke="#d97706" strokeDasharray="4 3" label={{value:"Baseline",fill:"#d97706",fontSize:10}}/>
                    <Line type="monotone" dataKey="duration" stroke={B.blue} strokeWidth={2.5} dot={false} name="Duration (min)"/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="g2">
                <div className="card">
                  <div style={{fontFamily:"Inter,sans-serif",fontSize:14,fontWeight:800,color:B.text,marginBottom:14}}>Water & Chemical Usage (30 Days)</div>
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={CYCLE_HISTORY.filter((_,i)=>i%3===0)} margin={{top:4,right:10,bottom:4,left:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                      <XAxis dataKey="day" stroke="#e2e8f0" tick={{fill:"#94a3b8",fontSize:10}} interval={2}/>
                      <YAxis stroke="#e2e8f0" tick={{fill:"#94a3b8",fontSize:10}} width={38}/>
                      <Tooltip content={<CTooltip/>}/>
                      <Legend wrapperStyle={{fontSize:11}}/>
                      <Bar dataKey="water" fill={B.teal} name="Water (L)" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="card">
                  <div style={{fontFamily:"Inter,sans-serif",fontSize:14,fontWeight:800,color:B.text,marginBottom:14}}>Soiling Index at CIP Start</div>
                  <ResponsiveContainer width="100%" height={190}>
                    <AreaChart data={CYCLE_HISTORY} margin={{top:4,right:10,bottom:4,left:0}}>
                      <defs><linearGradient id="soilg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={B.orange} stopOpacity={0.25}/><stop offset="95%" stopColor={B.orange} stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                      <XAxis dataKey="day" stroke="#e2e8f0" tick={{fill:"#94a3b8",fontSize:10}} interval={4}/>
                      <YAxis stroke="#e2e8f0" tick={{fill:"#94a3b8",fontSize:10}} width={34} domain={[0,1]}/>
                      <Tooltip content={<CTooltip/>}/>
                      <ReferenceLine y={0.65} stroke="#dc2626" strokeDasharray="4 3" label={{value:"Threshold",fill:"#dc2626",fontSize:10}}/>
                      <Area type="monotone" dataKey="soilingAtCIP" stroke={B.orange} fill="url(#soilg)" strokeWidth={2} dot={false} name="Soiling Index"/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── COMPLIANCE LOG ── */}
        {section==="compliance" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{fontFamily:"Inter,sans-serif",fontSize:18,fontWeight:800,color:B.text}}>📋 CIP Compliance & Audit Log</div>
                <div style={{fontSize:13,color:B.sub,marginTop:2}}>Full traceability · Every cycle recorded · FDA/FSMA ready</div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button style={{background:B.blue,color:"#fff",border:"none",borderRadius:7,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>⬇ Export CSV</button>
                <button style={{background:"#f8fafc",color:B.sub,border:"1px solid #e2e8f0",borderRadius:7,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>🔍 Filter</button>
              </div>
            </div>
            <div className="g4" style={{marginBottom:20}}>
              {[
                {label:"Total CIP Cycles",value:"247",sub:"Last 30 days",color:B.blue},
                {label:"Pass Rate",value:"98.7%",sub:"243 of 247 passed",color:B.green},
                {label:"Conditional Pass",value:"3",sub:"Extended monitoring",color:B.orange},
                {label:"Auto-Triggered",value:"89%",sub:"AI-scheduled cycles",color:B.purple},
              ].map((k,i)=>(
                <div key={i} style={{background:"#fff",border:`2px solid ${k.color}25`,borderRadius:10,padding:"14px 16px",borderTop:`3px solid ${k.color}`}}>
                  <div style={{fontFamily:"Inter,sans-serif",fontSize:22,fontWeight:800,color:k.color}}>{k.value}</div>
                  <div style={{fontSize:12,fontWeight:700,color:"#334155",marginTop:3}}>{k.label}</div>
                  <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{k.sub}</div>
                </div>
              ))}
            </div>
            <div className="card">
              <div style={{fontFamily:"Inter,sans-serif",fontSize:14,fontWeight:800,color:B.text,marginBottom:14}}>Recent CIP Cycles</div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:640}}>
                  <thead>
                    <tr style={{background:"#f8fafc"}}>
                      {["Audit ID","Equipment","Date / Time","Operator","Phases","Duration","Result","Action"].map(h=>(
                        <th key={h} style={{padding:"8px 12px",textAlign:"left",color:"#475569",fontWeight:700,borderBottom:"2px solid #e2e8f0",whiteSpace:"nowrap",fontSize:11}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPLIANCE_LOG.map((r,i)=>{
                      const rc = r.result==="PASS"?B.green:r.result==="RUNNING"?B.blue:B.orange;
                      return (
                        <tr key={r.id} style={{borderBottom:"1px solid #f1f5f9",background:i%2===0?"#fff":"#fafafa"}}>
                          <td style={{padding:"8px 12px",fontWeight:700,color:B.blue,fontFamily:"mono",fontSize:11}}>{r.id}</td>
                          <td style={{padding:"8px 12px",fontWeight:600,color:B.text}}>{r.eq}</td>
                          <td style={{padding:"8px 12px",color:B.sub,whiteSpace:"nowrap"}}>{r.date}</td>
                          <td style={{padding:"8px 12px",color:B.sub}}>{r.operator}</td>
                          <td style={{padding:"8px 12px",color:B.sub,textAlign:"center"}}>{r.phases}/5</td>
                          <td style={{padding:"8px 12px",color:B.sub}}>{r.duration}</td>
                          <td style={{padding:"8px 12px"}}>
                            <span style={{background:`${rc}15`,color:rc,border:`1px solid ${rc}40`,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:700,letterSpacing:0.8}}>
                              {r.result}
                            </span>
                          </td>
                          <td style={{padding:"8px 12px"}}>
                            <button style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:5,padding:"3px 9px",fontSize:10,fontWeight:600,color:B.blue,cursor:"pointer"}}>📄 View</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {scheduleModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setScheduleModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:16,padding:"28px 28px",width:"100%",maxWidth:440,boxShadow:"0 24px 64px rgba(0,0,0,0.25)",fontFamily:"Inter,sans-serif"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
              <div><div style={{fontFamily:"Inter,sans-serif",fontSize:16,fontWeight:800,color:B.text}}>📅 Schedule CIP — {scheduleModal.id}</div>
              <div style={{fontSize:12,color:B.sub,marginTop:2}}>{scheduleModal.name}</div></div>
              <button onClick={()=>setScheduleModal(null)} style={{background:"#f1f5f9",border:"none",borderRadius:7,padding:"5px 10px",cursor:"pointer",color:B.sub}}>✕</button>
            </div>
            <div style={{background:`${scheduleModal.cipStatus==="overdue"?"#fff5f5":"#fffbeb"}`,border:`1px solid ${scheduleModal.cipStatus==="overdue"?"#fecaca":"#fde68a"}`,borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12}}>
              <strong style={{color:scheduleModal.cipStatus==="overdue"?B.red:B.orange}}>🤖 AI Recommendation: </strong>
              <span style={{color:B.text}}>{scheduleModal.aiRecommended === "IMMEDIATE" || scheduleModal.aiRecommended === "Now" ? "Start CIP immediately" : `Start CIP in ${scheduleModal.aiRecommended}`}</span>
            </div>
            {[{label:"Currently Scheduled",val:scheduleModal.nextScheduled},{label:"AI Recommended",val:scheduleModal.aiRecommended},{label:"Soiling Index",val:scheduleModal.soilingIndex},{label:"Biofilm Risk",val:scheduleModal.biofilmRisk}].map((f,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f1f5f9",fontSize:13}}>
                <span style={{color:B.sub}}>{f.label}</span>
                <strong style={{color:B.text}}>{f.val}</strong>
              </div>
            ))}
            <div style={{display:"flex",gap:10,marginTop:20}}>
              <button onClick={()=>{setSelectedEq(scheduleModal);setSection("live");setScheduleModal(null);}} style={{flex:1,padding:"12px",background:`linear-gradient(135deg,${B.blue},${B.teal})`,color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>▶ Start CIP Now</button>
              <button onClick={()=>setScheduleModal(null)} style={{padding:"12px 16px",background:"#f8fafc",color:B.sub,border:"1px solid #e2e8f0",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="fw">
        <div style={{fontSize:12,color:B.light}}>
          <span style={{color:B.green,animation:"pulse 2s infinite"}}>●</span> AriLinc CIP Intelligence · Dairy Operations · Powered by AriPrus
        </div>
        <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
          <a href="mailto:info@ariprus.com" style={{fontSize:12,color:B.sub,textDecoration:"none"}}>✉ info@ariprus.com</a>
          <a href="https://arilinc.ariprus.com" target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:B.blue,fontWeight:700,textDecoration:"none"}}>Explore AriLinc Platform →</a>
        </div>
      </div>
    </div>
  );
}
