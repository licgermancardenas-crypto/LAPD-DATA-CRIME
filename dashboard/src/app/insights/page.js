'use client';

import { useState, useEffect, useMemo } from 'react';
import Shell from '@/components/Shell';

const C = {
  bg:'#07080f', surface:'#0d1020', card:'#111525', border:'#1e2235',
  accent:'#4f8ef7', red:'#f87171', green:'#34d399', yellow:'#fbbf24',
  purple:'#a78bfa', cyan:'#67e8f9', text:'#e8eaf0', muted:'#8a90a8',
  dim:'#4a5070', dimmer:'#252840',
};
const DOW    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const CHAPTERS = [
  {id:'scale',         n:'01', label:'Scope & Scale'},
  {id:'clearance',     n:'02', label:'Clearance Crisis'},
  {id:'geography',     n:'03', label:'Geography'},
  {id:'categories',    n:'04', label:'Crime Categories'},
  {id:'temporal',      n:'05', label:'Temporal Patterns'},
  {id:'victims',       n:'06', label:'Who Bears the Burden'},
  {id:'neighborhoods', n:'07', label:'Neighborhood Risk'},
  {id:'findings',      n:'08', label:'Key Findings'},
];


function n2(n){ if(n>=1e6) return (n/1e6).toFixed(2)+'M'; if(n>=1e3) return (n/1e3).toFixed(1)+'k'; return String(n); }
function clrColor(r){ return r>=25?C.green:r>=15?C.yellow:C.red; }

/* ── TOC ────────────────────────────────────────────────────────────────── */
function StickyTOC({ active }){
  return(
    <nav className="insights-toc" style={{
      width:172, flexShrink:0, position:'sticky', top:0,
      height:'100vh', overflowY:'auto', scrollbarWidth:'none',
      padding:'40px 0', borderRight:`1px solid ${C.border}`,
      display:'flex', flexDirection:'column',
    }}>
      <div style={{fontSize:9,fontWeight:800,color:C.dim,letterSpacing:'.16em',
        textTransform:'uppercase',padding:'0 20px 12px',borderBottom:`1px solid ${C.border}`,marginBottom:8}}>
        Contents
      </div>
      {CHAPTERS.map(ch=>{
        const on=active===ch.id;
        return(
          <a key={ch.id} href={`#${ch.id}`} style={{
            display:'block', padding:'7px 20px',
            fontSize:11, fontWeight:on?700:400,
            color:on?C.accent:C.dim,
            textDecoration:'none',
            borderLeft:`2px solid ${on?C.accent:'transparent'}`,
            background:on?'rgba(79,142,247,.06)':'transparent',
            transition:'all .12s', lineHeight:1.35,
          }}
          onMouseEnter={e=>{if(!on){e.currentTarget.style.color=C.muted;}}}
          onMouseLeave={e=>{if(!on){e.currentTarget.style.color=C.dim;}}}>
            <span style={{fontSize:8,color:on?C.accent:C.dimmer,marginRight:5}}>{ch.n}</span>
            {ch.label}
          </a>
        );
      })}
      <div style={{flex:1}}/>
      <button
        onClick={()=>window.print()}
        className="no-print"
        style={{
          margin:'16px 12px 0',padding:'8px 12px',borderRadius:6,
          background:'rgba(79,142,247,.08)',border:'1px solid rgba(79,142,247,.22)',
          color:C.accent,fontSize:11,fontWeight:600,cursor:'pointer',
          fontFamily:'inherit',letterSpacing:'.02em',transition:'all .15s',
        }}
        onMouseEnter={e=>{e.currentTarget.style.background='rgba(79,142,247,.18)';}}
        onMouseLeave={e=>{e.currentTarget.style.background='rgba(79,142,247,.08)';}}
      >⬇ Print / PDF</button>
    </nav>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */
function ChapterBanner({n,title,thesis}){
  return(
    <div style={{marginBottom:36,paddingBottom:20,borderBottom:`1px solid ${C.border}`}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
        <span style={{fontSize:10,fontWeight:800,letterSpacing:'.18em',color:C.accent,
          background:'rgba(79,142,247,.08)',border:'1px solid rgba(79,142,247,.2)',
          borderRadius:4,padding:'3px 10px'}}>CHAPTER {n}</span>
        <span style={{fontSize:10,color:C.dim,letterSpacing:'.1em',textTransform:'uppercase'}}>LA Crime Intelligence · 2020–2024</span>
      </div>
      <h2 style={{fontSize:30,fontWeight:900,color:'#fff',lineHeight:1.08,letterSpacing:'-0.02em',marginBottom:10}}>{title}</h2>
      {thesis&&<p style={{fontSize:14,color:C.muted,lineHeight:1.65,maxWidth:660,margin:0}}>{thesis}</p>}
    </div>
  );
}

function BigStat({value,label,sub,color=C.accent,note}){
  return(
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'18px 22px',borderTop:`2px solid ${color}`}}>
      <div style={{fontSize:10,fontWeight:700,color:C.dim,letterSpacing:'.12em',textTransform:'uppercase',marginBottom:7}}>{label}</div>
      <div style={{fontSize:32,fontWeight:900,color,lineHeight:1,fontVariantNumeric:'tabular-nums'}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:C.muted,marginTop:6}}>{sub}</div>}
      {note&&<div style={{fontSize:10,color:C.dim,marginTop:3,fontStyle:'italic'}}>{note}</div>}
    </div>
  );
}

function Prose({children,accent}){
  return<p style={{fontSize:14,color:accent?'#c8ccdc':C.muted,lineHeight:1.78,margin:'0 0 10px',maxWidth:800}}>{children}</p>;
}

function Finding({text,color=C.accent,icon='▸'}){
  return(
    <div style={{padding:'13px 18px',borderRadius:8,background:`${color}0a`,
      border:`1px solid ${color}28`,borderLeft:`3px solid ${color}`}}>
      <span style={{fontSize:13,color,lineHeight:1.6}}><strong style={{marginRight:8}}>{icon}</strong>{text}</span>
    </div>
  );
}

function HBar({pct,color=C.accent,h=5}){
  return(
    <div style={{background:'rgba(255,255,255,.05)',borderRadius:3,overflow:'hidden',height:h}}>
      <div style={{height:'100%',width:`${Math.min(100,pct)}%`,
        background:`linear-gradient(90deg,${color}60,${color})`,borderRadius:3}}/>
    </div>
  );
}

function DataTable({headers,rows}){
  return(
    <div style={{overflowX:'auto',borderRadius:8,border:`1px solid ${C.border}`}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
        <thead>
          <tr style={{background:'#09091a',borderBottom:`1px solid ${C.border}`}}>
            {headers.map((h,i)=>(
              <th key={i} style={{padding:'9px 14px',textAlign:i===0?'left':'right',
                fontSize:9,fontWeight:700,color:C.dim,letterSpacing:'.1em',
                textTransform:'uppercase',whiteSpace:'nowrap'}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row,ri)=>(
            <tr key={ri} style={{borderBottom:`1px solid ${C.border}`,background:ri%2===0?C.card:'#0e1122'}}>
              {row.map((cell,ci)=>(
                <td key={ci} style={{padding:'8px 14px',textAlign:ci===0?'left':'right',
                  color:typeof cell==='object'?(cell.color||C.text):C.text,
                  fontWeight:ci===0?600:400,fontVariantNumeric:'tabular-nums',
                  whiteSpace:'nowrap',fontSize:12}}>
                  {typeof cell==='object'?cell.v:cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HourChart({totals}){
  if(!totals) return null;
  const max=Math.max(...totals);
  const W=24*14-2, H=72;
  return(
    <svg viewBox={`0 0 ${W} ${H+16}`} style={{width:'100%',display:'block'}}>
      {totals.map((v,h)=>{
        const bh=Math.max(2,(v/max)*H);
        const t=v/max;
        const fill=t>.85?C.red:t>.6?C.yellow:t>.35?C.accent:C.dimmer;
        return(
          <g key={h}>
            <rect x={h*14} y={H-bh} width={12} height={bh} rx={2} fill={fill} opacity={.82}/>
            {h%6===0&&<text x={h*14+6} y={H+13} textAnchor="middle" style={{fontSize:9,fill:C.dim,fontFamily:'monospace'}}>{String(h).padStart(2,'0')}h</text>}
          </g>
        );
      })}
    </svg>
  );
}

function MonthChart({monthly}){
  if(!monthly?.length) return null;
  const byM=new Array(12).fill(0), cnt=new Array(12).fill(0);
  monthly.forEach(r=>{ if(r.month>=1&&r.month<=12){ byM[r.month-1]+=r.crimes; cnt[r.month-1]++; } });
  const avgs=byM.map((s,i)=>cnt[i]?Math.round(s/cnt[i]):0);
  const max=Math.max(...avgs);
  const W=12*34-2, H=60;
  return(
    <svg viewBox={`0 0 ${W} ${H+18}`} style={{width:'100%',display:'block'}}>
      {avgs.map((v,m)=>{
        const bh=Math.max(2,(v/max)*H);
        const t=v/max;
        const fill=t>.85?C.red:t>.6?C.yellow:t>.35?C.accent:C.dimmer;
        return(
          <g key={m}>
            <rect x={m*34+2} y={H-bh} width={28} height={bh} rx={2} fill={fill} opacity={.82}/>
            <text x={m*34+16} y={H+14} textAnchor="middle" style={{fontSize:9,fill:C.dim,fontFamily:'monospace'}}>{MONTHS[m]}</text>
          </g>
        );
      })}
    </svg>
  );
}

function YearChart({byYear}){
  if(!byYear?.length) return null;
  const max=Math.max(...byYear.map(y=>y.crimes));
  const W=byYear.length*90-8, H=80;
  return(
    <svg viewBox={`0 0 ${W} ${H+24}`} style={{width:'100%',maxWidth:520,display:'block'}}>
      {byYear.map((yr,i)=>{
        const partial=yr.year===2024;
        const bh=Math.max(4,(yr.crimes/max)*H);
        const x=i*90;
        const prev=byYear[i-1];
        const pct=prev?((yr.crimes-prev.crimes)/prev.crimes*100):null;
        const isUp=pct>0;
        const fill=partial?C.dimmer:yr.crimes===max?C.red:C.accent;
        return(
          <g key={yr.year}>
            <rect x={x+10} y={H-bh} width={68} height={bh} rx={3} fill={fill} opacity={partial?.4:.82}/>
            <text x={x+44} y={H+13} textAnchor="middle" style={{fontSize:10,fill:C.muted,fontFamily:'monospace',fontWeight:700}}>{yr.year}{partial?'*':''}</text>
            <text x={x+44} y={H-bh-5} textAnchor="middle" style={{fontSize:9,fill:C.muted,fontFamily:'monospace'}}>{n2(yr.crimes)}</text>
            {pct!==null&&!partial&&(
              <text x={x+44} y={H+24} textAnchor="middle" style={{fontSize:8,fill:isUp?C.red:C.green,fontFamily:'monospace',fontWeight:700}}>
                {isUp?'▲':'▼'}{Math.abs(pct).toFixed(1)}%</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function DOWChart({totals}){
  if(!totals) return null;
  const max=Math.max(...totals);
  return(
    <div style={{display:'flex',gap:6,alignItems:'flex-end',height:72,padding:'4px 0'}}>
      {totals.map((v,d)=>{
        const h=Math.max(4,(v/max)*68);
        const t=v/max;
        const fill=t>.9?C.red:t>.7?C.yellow:C.accent;
        return(
          <div key={d} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
            <div style={{width:'100%',height:h,background:fill,borderRadius:'3px 3px 0 0',opacity:.82}}/>
            <span style={{fontSize:9,color:t>.8?fill:C.dim,fontWeight:t>.8?700:400,fontFamily:'monospace'}}>{DOW[d]}</span>
          </div>
        );
      })}
    </div>
  );
}

function Sep(){
  return<div className="chapter-sep" style={{height:1,background:`linear-gradient(90deg,transparent,${C.border},transparent)`,margin:'52px 0'}}/>;
}

const SP={padding:'52px 40px'};

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function InsightsPage(){
  const [data, setData]       = useState(null);
  const [hoods, setHoods]     = useState(null);
  const [activeChapter, setAC]= useState('scale');

  useEffect(()=>{
    Promise.all([
      fetch('/data/summary.json').then(r=>r.json()),
      fetch('/data/division.json').then(r=>r.json()),
      fetch('/data/categories.json').then(r=>r.json()),
      fetch('/data/victims.json').then(r=>r.json()),
      fetch('/data/hourly_dow.json').then(r=>r.json()),
      fetch('/data/monthly.json').then(r=>r.json()),
    ]).then(([summary,division,categories,victims,hourly,monthly])=>{
      setData({summary,division,categories,victims,hourly,monthly});
    }).catch(console.error);
    fetch('/data/neighborhood_mortality.geojson')
      .then(r=>r.json())
      .then(geo=>setHoods(geo.features.map(f=>f.properties)))
      .catch(console.error);
  },[]);

  /* Scroll spy */
  useEffect(()=>{
    const observers=[];
    CHAPTERS.forEach(ch=>{
      const el=document.getElementById(ch.id);
      if(!el) return;
      const obs=new IntersectionObserver(
        ([entry])=>{ if(entry.isIntersecting) setAC(ch.id); },
        {rootMargin:'-20% 0px -60% 0px'}
      );
      obs.observe(el);
      observers.push(obs);
    });
    return()=>observers.forEach(o=>o.disconnect());
  },[]);

  const calc=useMemo(()=>{
    if(!data) return null;
    const hourTotals=new Array(24).fill(0);
    data.hourly.forEach(r=>{ hourTotals[r.hour]+=r.crimes; });
    const peakHour=hourTotals.indexOf(Math.max(...hourTotals));
    const quietHour=hourTotals.indexOf(Math.min(...hourTotals));
    const peakRatio=(hourTotals[peakHour]/hourTotals[quietHour]).toFixed(1);
    const dowTotals=new Array(7).fill(0);
    data.hourly.forEach(r=>{ dowTotals[r.dow]+=r.crimes; });
    const peakDow=dowTotals.indexOf(Math.max(...dowTotals));
    const divSorted=[...data.division].sort((a,b)=>b.crimes-a.crimes);
    const totalCrimes=data.summary.total_crimes;
    const top5crimes=divSorted.slice(0,5).reduce((s,d)=>s+d.crimes,0);
    const top5pct=(top5crimes/totalCrimes*100).toFixed(1);
    const bestClr=[...data.division].sort((a,b)=>b.clearance_rate-a.clearance_rate)[0];
    const worstClr=[...data.division].sort((a,b)=>a.clearance_rate-b.clearance_rate)[0];
    const avgClr=(data.division.reduce((s,d)=>s+d.clearance_rate,0)/data.division.length).toFixed(1);
    const catSorted=[...data.categories].sort((a,b)=>b.crimes-a.crimes);
    const lowestClrCat=[...data.categories].sort((a,b)=>a.clearance_rate-b.clearance_rate)[0];
    const highestClrCat=[...data.categories].sort((a,b)=>b.clearance_rate-a.clearance_rate)[0];
    const years=data.summary.by_year;
    const peakYear=years.reduce((p,c)=>c.crimes>p.crimes?c:p);
    const clearanceDrop=(years[0].clearance_rate-years[years.length-1].clearance_rate).toFixed(1);
    const clearanceDropPct=((years[0].clearance_rate-years[years.length-1].clearance_rate)/years[0].clearance_rate*100).toFixed(0);
    const unsolvedTotal=Math.round(totalCrimes*(1-data.summary.clearance_rate/100));
    const byMonth=new Array(12).fill(0), mCnt=new Array(12).fill(0);
    data.monthly.forEach(r=>{ if(r.month>=1&&r.month<=12){ byMonth[r.month-1]+=r.crimes; mCnt[r.month-1]++; } });
    const monthAvgs=byMonth.map((s,i)=>mCnt[i]?Math.round(s/mCnt[i]):0);
    const peakMonth=monthAvgs.indexOf(Math.max(...monthAvgs));
    const quietMonth=monthAvgs.indexOf(Math.min(...monthAvgs));
    const sexKnown=data.victims.by_sex.filter(s=>s.sex!=='Unknown');
    const femaleViolentPct=sexKnown.find(s=>s.sex==='Female')?.violent_pct??0;
    const maleViolentPct=sexKnown.find(s=>s.sex==='Male')?.violent_pct??0;
    return{hourTotals,peakHour,quietHour,peakRatio,dowTotals,peakDow,divSorted,top5pct,bestClr,worstClr,avgClr,totalCrimes,catSorted,lowestClrCat,highestClrCat,years,peakYear,clearanceDrop,clearanceDropPct,unsolvedTotal,monthAvgs,peakMonth,quietMonth,sexKnown,femaleViolentPct,maleViolentPct};
  },[data]);

  const hoodsTop=useMemo(()=>{
    if(!hoods) return null;
    return[...hoods].filter(h=>h.population>1000).sort((a,b)=>b.crimes_per_1000-a.crimes_per_1000).slice(0,12);
  },[hoods]);

  const hoodsSafe=useMemo(()=>{
    if(!hoods) return null;
    return[...hoods].filter(h=>h.population>1000).sort((a,b)=>a.crimes_per_1000-b.crimes_per_1000).slice(0,6);
  },[hoods]);

  const ok=!!(data&&calc);

  return(
    <Shell>
      <div style={{background:C.bg,minHeight:'100vh',color:C.text,fontFamily:'Inter,system-ui,sans-serif'}}>

        {/* HERO */}
        <div className="no-print" style={{background:'linear-gradient(160deg,#0b0e22 0%,#07080f 65%)',borderBottom:`1px solid ${C.border}`,padding:'48px 40px 36px'}}>
          <div style={{maxWidth:1080,margin:'0 auto'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,flexWrap:'wrap'}}>
              <span style={{fontSize:10,fontWeight:800,letterSpacing:'.2em',color:C.accent,
                background:'rgba(79,142,247,.08)',border:'1px solid rgba(79,142,247,.2)',
                padding:'4px 12px',borderRadius:4}}>CRIME INTELLIGENCE REPORT</span>
              <span style={{fontSize:10,color:C.dim,letterSpacing:'.1em'}}>LOS ANGELES · 2020–2024</span>
              <button
                onClick={()=>window.print()}
                style={{marginLeft:'auto',padding:'7px 16px',borderRadius:6,
                  background:'rgba(79,142,247,.08)',border:'1px solid rgba(79,142,247,.22)',
                  color:C.accent,fontSize:12,fontWeight:600,cursor:'pointer',
                  fontFamily:'inherit',transition:'all .15s',letterSpacing:'.02em'}}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(79,142,247,.18)';}}
                onMouseLeave={e=>{e.currentTarget.style.background='rgba(79,142,247,.08)';}}
              >⬇ Download PDF</button>
            </div>
            <h1 style={{fontSize:44,fontWeight:900,lineHeight:1.06,letterSpacing:'-0.03em',color:'#fff',marginBottom:12}}>
              One Million Crimes.<br/>
              <span style={{color:C.accent}}>The Numbers Behind LA&rsquo;s Safety Crisis.</span>
            </h1>
            <p style={{fontSize:14,color:C.muted,lineHeight:1.72,maxWidth:620,marginBottom:32}}>
              A deep analysis of 1,004,894 criminal incidents logged by the LAPD between January 2020 and December 2024 — covering geography, time patterns, victim demographics, crime categories, and the systemic collapse in case resolution.
            </p>
            <div style={{display:'flex',flexWrap:'wrap',gap:1}}>
              {[
                {v:'1,004,894',l:'Total Incidents',c:C.accent},
                {v:'20.1%',l:'Clearance Rate',c:C.yellow},
                {v:'26.2%',l:'Violent Crime',c:C.red},
                {v:'550/day',l:'Avg Daily Rate',c:C.purple},
                {v:'21',l:'LAPD Divisions',c:C.cyan},
              ].map((s,i,a)=>(
                <div key={i} style={{flex:'1 1 120px',padding:'13px 18px',
                  background:'rgba(255,255,255,.025)',border:`1px solid ${C.border}`,borderTop:`2px solid ${s.c}`,
                  borderRadius:i===0?'8px 0 0 8px':i===a.length-1?'0 8px 8px 0':0}}>
                  <div style={{fontSize:22,fontWeight:900,color:s.c,lineHeight:1}}>{s.v}</div>
                  <div style={{fontSize:10,color:C.dim,marginTop:5,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase'}}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TWO-COLUMN: TOC + CONTENT */}
        <div style={{display:'flex'}}>
          <StickyTOC active={activeChapter}/>

          <div style={{flex:1,minWidth:0}}>

            {/* CH 01 */}
            <div style={SP} id="scale">
              <ChapterBanner n="01" title="The Scale of the Problem"
                thesis="Los Angeles averaged 550 crimes every day for five consecutive years — one incident every 2.6 minutes, around the clock, every day of the week."/>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:14,marginBottom:28}}>
                <BigStat value="1,004,894" label="Total Crimes 2020–2024" sub="Cumulative 5-year figure" color={C.accent}/>
                <BigStat value="803k+" label="Unsolved Cases" sub="80% of all incidents remain open" color={C.red}/>
                <BigStat value="556,669" label="Part 1 — Serious" sub="Homicide · robbery · assault · rape · burglary" color={C.yellow}/>
                <BigStat value="263,218" label="Violent Crimes" sub="26.2% of all incidents involve violence" color={C.purple}/>
              </div>
              {ok&&(
                <div style={{marginBottom:24}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.dim,letterSpacing:'.12em',marginBottom:12,textTransform:'uppercase'}}>Crime Volume — Year by Year</div>
                  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:'20px 16px'}}>
                    <YearChart byYear={calc.years}/>
                  </div>
                  <div style={{fontSize:10,color:C.dim,marginTop:7,fontStyle:'italic'}}>* 2024 partial — avg 7-day reporting lag means recent cases are still being filed.</div>
                </div>
              )}
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <Prose accent>Crime in Los Angeles reached its five-year peak in <strong style={{color:'#fff'}}>2022 with 235,259 incidents</strong> — an 18% surge from 2020 levels that erased whatever lockdown-era relief the city experienced. The COVID dip of March 2020 proved short-lived; by mid-2021 crime had fully recovered.</Prose>
                <Prose>Reframed as human cost: across 2020–2023 (the four complete years), Los Angeles averaged <strong style={{color:'#fff'}}>over 600 crimes per day</strong>. Every 24 hours saw roughly 157 vehicle thefts, 57 assaults, 45 burglaries, and 39 robberies — before any morning news cycle.</Prose>
              </div>
              {ok&&(
                <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:16}}>
                  <Finding text="2022 was the peak year: 235,259 crimes — 18% above the 2020 baseline. The post-COVID rebound drove two consecutive years of growth before a marginal correction in 2023." color={C.red}/>
                  <Finding text="Part 1 crimes (FBI felony classification) represent 55.4% of total caseload — meaning most LAPD work involves serious offenses, not minor infractions." color={C.accent}/>
                </div>
              )}
            </div>

            <Sep/>

            {/* CH 02 */}
            <div style={SP} id="clearance">
              <ChapterBanner n="02" title="The Clearance Crisis"
                thesis="Of every five crimes reported to the LAPD, only one gets solved. And that ratio is getting worse every year — fast."/>
              {ok&&(
                <>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:14,marginBottom:28}}>
                    <BigStat value="20.1%" label="Overall Clearance Rate" sub="1 in 5 crimes resolved" color={C.yellow}/>
                    <BigStat value={calc.unsolvedTotal.toLocaleString()} label="Open Cases" sub="Incidents without any closure" color={C.red}/>
                    <BigStat value={`${calc.clearanceDrop}pp`} label="Clearance Decline" sub="2020 (24.0%) → 2024 (12.1%)" color={C.red} note={`${calc.clearanceDropPct}% relative collapse`}/>
                    <BigStat value="12.1%" label="2024 Clearance Rate" sub="Lowest single year on record" color={C.red}/>
                  </div>
                  <div style={{marginBottom:24}}>
                    <div style={{fontSize:10,fontWeight:700,color:C.dim,letterSpacing:'.12em',marginBottom:12,textTransform:'uppercase'}}>Clearance Rate — Year by Year</div>
                    <DataTable
                      headers={['Year','Total Crimes','Est. Solved','Unsolved','Clearance %','Violent %']}
                      rows={calc.years.map(yr=>{
                        const solved=Math.round(yr.crimes*yr.clearance_rate/100);
                        return[
                          {v:yr.year===2024?`${yr.year} *`:String(yr.year),color:yr.year===calc.peakYear.year?C.red:C.text},
                          {v:yr.crimes.toLocaleString(),color:yr.year===calc.peakYear.year?C.red:C.text},
                          {v:solved.toLocaleString(),color:C.green},
                          {v:(yr.crimes-solved).toLocaleString(),color:C.red},
                          {v:`${yr.clearance_rate}%`,color:clrColor(yr.clearance_rate)},
                          {v:`${yr.violent_pct}%`,color:C.purple},
                        ];
                      })}
                    />
                    <div style={{fontSize:10,color:C.dim,marginTop:6,fontStyle:'italic'}}>* 2024 partial year.</div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    <Prose accent>The LAPD's solve rate went from <strong style={{color:'#fff'}}>24.0% in 2020 to 12.1% in 2024</strong> — a 50% reduction in just four years. If this trend continues linearly, fewer than 1 in 10 crimes will be resolved by 2026.</Prose>
                    <Prose>Of the 803,916 cases that went unsolved over five years, each represents a victim with no legal recourse, no offender held accountable, and no deterrence signal sent. Property crime clearance hovers under 10% — making vehicle theft, burglary, and vandalism virtually risk-free for perpetrators.</Prose>
                  </div>
                  <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:16}}>
                    <Finding text={`If 2020's clearance rate (24%) had been maintained through 2024, an estimated ${Math.round((0.24-0.201)*1004894).toLocaleString()} additional cases would have been resolved.`} color={C.yellow} icon="⚡"/>
                    <Finding text="2024's 12.1% rate is likely understated — reporting lag means crimes committed in late 2024 still appear as 'unsolved' while investigations are ongoing." color={C.dim} icon="ℹ"/>
                  </div>
                </>
              )}
            </div>

            <Sep/>

            {/* CH 03 */}
            <div style={SP} id="geography">
              <ChapterBanner n="03" title="The Geography of Crime"
                thesis="Crime is not evenly spread across Los Angeles. Five of twenty-one divisions account for a disproportionate share of all incidents — and clearance performance varies by 3× across the city."/>
              {ok&&(
                <>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:14,marginBottom:28}}>
                    <BigStat value={`${calc.top5pct}%`} label="Top 5 Divisions — Crime Share" sub={`of ${calc.totalCrimes.toLocaleString()} total`} color={C.red}/>
                    <BigStat value={`${calc.bestClr.clearance_rate}%`} label={`Best: ${calc.bestClr.name}`} sub="Highest solve rate" color={C.green}/>
                    <BigStat value={`${calc.worstClr.clearance_rate}%`} label={`Worst: ${calc.worstClr.name}`} sub="Lowest solve rate" color={C.red}/>
                    <BigStat value={`${(calc.bestClr.clearance_rate/calc.worstClr.clearance_rate).toFixed(1)}×`} label="Clearance Gap" sub="Best vs worst division" color={C.yellow}/>
                  </div>
                  <div style={{marginBottom:24}}>
                    <div style={{fontSize:10,fontWeight:700,color:C.dim,letterSpacing:'.12em',marginBottom:12,textTransform:'uppercase'}}>All 21 LAPD Divisions — Ranked by Volume</div>
                    <DataTable
                      headers={['Rank','Division','Total','Share','P1','P2','Clearance','Violent %']}
                      rows={calc.divSorted.map((d,i)=>[
                        {v:`#${i+1}`,color:i<3?C.red:i>=18?C.green:C.muted},
                        {v:d.name,color:i<5?'#fff':C.text},
                        {v:d.crimes.toLocaleString(),color:i<3?C.red:C.text},
                        {v:`${(d.crimes/calc.totalCrimes*100).toFixed(1)}%`,color:C.muted},
                        {v:d.crimes_p1.toLocaleString(),color:C.yellow},
                        {v:d.crimes_p2.toLocaleString(),color:C.dim},
                        {v:`${d.clearance_rate}%`,color:clrColor(d.clearance_rate)},
                        {v:`${d.violent_pct}%`,color:d.violent_pct>30?C.red:C.muted},
                      ])}
                    />
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    <Prose accent><strong style={{color:'#fff'}}>{calc.divSorted[0].name}</strong> leads with {calc.divSorted[0].crimes.toLocaleString()} crimes and {calc.divSorted[0].clearance_rate}% clearance — {(parseFloat(calc.avgClr)-calc.divSorted[0].clearance_rate).toFixed(1)}pp below city average. The top five divisions alone account for {calc.top5pct}% of all incidents.</Prose>
                    <Prose><strong style={{color:'#fff'}}>{calc.bestClr.name}</strong> closes {calc.bestClr.clearance_rate}% of cases — {(calc.bestClr.clearance_rate/calc.worstClr.clearance_rate).toFixed(1)}× more than {calc.worstClr.name} at {calc.worstClr.clearance_rate}%. Best practices in high-performing divisions are not being systematically transferred citywide.</Prose>
                  </div>
                  <div style={{marginTop:16}}>
                    <Finding text={`Concentrating investigative resources in the top 5 divisions could address ${calc.top5pct}% of LAPD crime with targeted deployment — without expanding total headcount.`} color={C.red}/>
                  </div>
                </>
              )}
            </div>

            <Sep/>

            {/* CH 04 */}
            <div style={SP} id="categories">
              <ChapterBanner n="04" title="What Crimes Are Being Committed"
                thesis="Vehicle crime dominates LA's criminal landscape — and is the least likely to be solved. Property offenses outnumber violent ones 3-to-1, but violent crimes carry disproportionate human cost."/>
              {ok&&(
                <>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:14,marginBottom:28}}>
                    <BigStat value={`${calc.catSorted[0].share_pct}%`} label={`#1 Crime: ${calc.catSorted[0].category}`} sub={`${calc.catSorted[0].crimes.toLocaleString()} incidents · ${calc.catSorted[0].clearance_rate}% solved`} color={C.red}/>
                    <BigStat value={`${calc.lowestClrCat.clearance_rate}%`} label="Lowest Clearance Category" sub={calc.lowestClrCat.category} color={C.red} note="Virtually no accountability"/>
                    <BigStat value={`${calc.highestClrCat.clearance_rate}%`} label="Highest Clearance Category" sub={calc.highestClrCat.category} color={C.green}/>
                    <BigStat value="18" label="Categories Tracked" sub={`${data.categories.filter(c=>c.is_violent).length} violent · ${data.categories.filter(c=>!c.is_violent).length} property/other`} color={C.purple}/>
                  </div>
                  <div style={{marginBottom:24}}>
                    <div style={{fontSize:10,fontWeight:700,color:C.dim,letterSpacing:'.12em',marginBottom:12,textTransform:'uppercase'}}>All Crime Categories — Ranked by Volume</div>
                    <DataTable
                      headers={['Category','Type','Crimes','Share %','Clearance','Volume Bar']}
                      rows={calc.catSorted.map((c,i)=>[
                        {v:c.category,color:i===0?C.red:C.text},
                        {v:c.is_violent?'🔴 Violent':'🔵 Property',color:c.is_violent?C.red:C.accent},
                        {v:c.crimes.toLocaleString(),color:i<3?'#fff':C.text},
                        {v:`${c.share_pct}%`,color:C.muted},
                        {v:`${c.clearance_rate}%`,color:clrColor(c.clearance_rate)},
                        {v:'█'.repeat(Math.max(1,Math.round(c.share_pct/1.8)))+`  ${c.share_pct}%`,color:i===0?C.red:i<4?C.yellow:C.dim},
                      ])}
                    />
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    <Prose accent>Vehicle crime — spanning theft of vehicles, parts, and accessories — is LA's defining criminal challenge. With <strong style={{color:'#fff'}}>19.3% of all incidents and a 4.4% clearance rate</strong>, it represents the worst possible combination: maximum volume, minimal accountability. Stealing a car in LA carries almost no risk of arrest.</Prose>
                    <Prose><strong style={{color:'#fff'}}>{calc.highestClrCat.category}</strong> closes at {calc.highestClrCat.clearance_rate}% — driven by witness availability, forensic evidence, and investigative priority. The lesson: clearance rates reflect investigative investment as much as criminal difficulty.</Prose>
                  </div>
                  <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:16}}>
                    <Finding text="Vehicle crime alone: ~194,000 incidents, 4.4% clearance. Boosting this single category's resolution rate would have the largest absolute impact on total LAPD clearance performance." color={C.red}/>
                    <Finding text="Property crimes make up ~73.8% of all incidents but receive fewer investigative resources per case — creating a self-reinforcing cycle of low clearance." color={C.accent}/>
                  </div>
                </>
              )}
            </div>

            <Sep/>

            {/* CH 05 */}
            <div style={SP} id="temporal">
              <ChapterBanner n="05" title="When Crime Strikes"
                thesis="Crime in Los Angeles follows a precise daily rhythm. It bottoms out before dawn, peaks in the evening, and clusters on weekends. Summer is measurably more dangerous than winter."/>
              {ok&&(
                <>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:14,marginBottom:32}}>
                    <BigStat value={`${String(calc.peakHour).padStart(2,'0')}:00h`} label="Peak Crime Hour" sub="Highest daily concentration" color={C.red}/>
                    <BigStat value={`${String(calc.quietHour).padStart(2,'0')}:00h`} label="Quietest Hour" sub="Lowest daily concentration" color={C.green}/>
                    <BigStat value={`${calc.peakRatio}×`} label="Peak vs Trough Ratio" sub="Danger differential" color={C.yellow}/>
                    <BigStat value={DOW[calc.peakDow]} label="Busiest Day" sub="Highest cumulative volume" color={C.red}/>
                    <BigStat value={MONTHS[calc.peakMonth]} label="Peak Month" sub={`Quietest: ${MONTHS[calc.quietMonth]}`} color={C.yellow}/>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,marginBottom:24}}>
                    <div>
                      <div style={{fontSize:10,fontWeight:700,color:C.dim,letterSpacing:'.12em',marginBottom:10,textTransform:'uppercase'}}>Crime by Hour of Day</div>
                      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:'16px 12px'}}>
                        <HourChart totals={calc.hourTotals}/>
                      </div>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:700,color:C.dim,letterSpacing:'.12em',marginBottom:10,textTransform:'uppercase'}}>Avg Monthly Crime</div>
                      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:'16px 12px'}}>
                        <MonthChart monthly={data.monthly}/>
                      </div>
                    </div>
                  </div>
                  <div style={{marginBottom:24}}>
                    <div style={{fontSize:10,fontWeight:700,color:C.dim,letterSpacing:'.12em',marginBottom:10,textTransform:'uppercase'}}>Crime Volume by Day of Week</div>
                    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:'20px 24px 14px'}}>
                      <DOWChart totals={calc.dowTotals}/>
                    </div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    <Prose accent>The daily crime curve peaks at <strong style={{color:'#fff'}}>{String(calc.peakHour).padStart(2,'0')}:00</strong> and falls to its minimum around <strong style={{color:'#fff'}}>{String(calc.quietHour).padStart(2,'0')}:00</strong> — a {calc.peakRatio}× difference consistent across all five years. The evening peak reflects nightlife, reduced ambient foot traffic, and alcohol-fueled encounters.</Prose>
                    <Prose><strong style={{color:'#fff'}}>{MONTHS[calc.peakMonth]}</strong> consistently registers the highest average monthly crime — driven by longer daylight and outdoor activity. <strong style={{color:'#fff'}}>{MONTHS[calc.quietMonth]}</strong> is the safest month by a significant margin.</Prose>
                  </div>
                  <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:16}}>
                    <Finding text="The 18:00–23:00 window concentrates violent crime — particularly robbery and assault. A targeted patrol surge during these five hours on Fri/Sat would address a disproportionate share of serious incidents." color={C.red}/>
                    <Finding text="Vehicle theft peaks midday (10:00–14:00). The optimal patrol strategy differs sharply by crime category — one-size patrol doesn't fit all." color={C.accent}/>
                  </div>
                </>
              )}
            </div>

            <Sep/>

            {/* CH 06 */}
            <div style={SP} id="victims">
              <ChapterBanner n="06" title="Who Bears the Burden"
                thesis="Victimization in Los Angeles is not distributed equally. Hispanic and Latino residents account for 39.6% of all victims. Women face a higher proportion of violent crime than men."/>
              {ok&&(
                <>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:14,marginBottom:28}}>
                    <BigStat value="39.6%" label="Hispanic / Latino Victims" sub="Largest single demographic group" color={C.yellow}/>
                    <BigStat value="18.3%" label="Black Victims" sub="42.3% of their crimes are violent — highest rate" color={C.red}/>
                    <BigStat value={`${calc.femaleViolentPct}%`} label="Female — Violent Crime %" sub={`vs. ${calc.maleViolentPct}% for male victims`} color={C.purple} note="Women face proportionally more violence"/>
                    <BigStat value="26.8%" label="No Identified Victim" sub="Property crimes, commercial incidents" color={C.dim}/>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:24}}>
                    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:'20px 22px'}}>
                      <div style={{fontSize:10,fontWeight:700,color:C.dim,letterSpacing:'.12em',marginBottom:16,textTransform:'uppercase'}}>Victims by Sex</div>
                      {calc.sexKnown.map(s=>(
                        <div key={s.sex} style={{marginBottom:16}}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                            <span style={{fontSize:14,color:'#fff',fontWeight:700}}>{s.sex}</span>
                            <span style={{fontSize:12,color:C.muted}}>{s.crimes.toLocaleString()} · {s.share_pct}%</span>
                          </div>
                          <HBar pct={s.share_pct*2} color={s.sex==='Female'?C.purple:C.accent} h={6}/>
                          <div style={{fontSize:11,color:C.dim,marginTop:5}}>
                            <span style={{color:s.violent_pct>34?C.red:C.yellow,fontWeight:600}}>{s.violent_pct}%</span> violent
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:'20px 22px'}}>
                      <div style={{fontSize:10,fontWeight:700,color:C.dim,letterSpacing:'.12em',marginBottom:16,textTransform:'uppercase'}}>Victims by Ethnicity</div>
                      {data.victims.by_descent.map(d=>(
                        <div key={d.descent} style={{marginBottom:14}}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                            <span style={{fontSize:13,color:'#fff',fontWeight:600}}>{d.descent}</span>
                            <span style={{fontSize:11,color:C.muted}}>{d.share_pct}% · {d.crimes.toLocaleString()}</span>
                          </div>
                          <HBar pct={d.share_pct*2.5} color={d.descent==='Hispanic/Latino'?C.yellow:d.descent==='Black'?C.red:C.accent} h={5}/>
                          <div style={{fontSize:10,color:C.dim,marginTop:3}}>
                            <span style={{color:d.violent_pct>35?C.red:C.muted,fontWeight:600}}>{d.violent_pct}%</span> violent
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    <Prose accent>Hispanic and Latino residents account for <strong style={{color:'#fff'}}>39.6% of all victims</strong>. More acute is the situation for Black residents: representing roughly 9% of LA's population, they account for 18.3% of victims, and <strong style={{color:'#fff'}}>42.3% of their incidents are violent</strong> — the highest rate across all major groups tracked.</Prose>
                    <Prose><strong style={{color:'#fff'}}>Female victims face violent crime at {calc.femaleViolentPct}% — {(calc.femaleViolentPct-calc.maleViolentPct).toFixed(1)} percentage points higher than male victims</strong>. This gap is driven by domestic violence and sex offenses where women are the disproportionate targets.</Prose>
                  </div>
                </>
              )}
            </div>

            <Sep/>

            {/* CH 07 */}
            <div style={SP} id="neighborhoods">
              <ChapterBanner n="07" title="The Neighborhood Risk Index"
                thesis="The divide between LA's safest and most dangerous neighborhoods is extreme. Downtown sees 1,016 crimes per 1,000 residents. The safest neighborhoods see fewer than 10. Same city, radically different realities."/>
              {hoodsTop&&hoodsSafe&&(
                <>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,marginBottom:24}}>
                    <div>
                      <div style={{fontSize:10,fontWeight:700,color:C.red,letterSpacing:'.12em',marginBottom:10,textTransform:'uppercase'}}>⚠ Highest Risk — Top 12</div>
                      <DataTable
                        headers={['Neighborhood','Crimes/1k','Poverty %','Vulnerability']}
                        rows={hoodsTop.map((h,i)=>[
                          {v:h.name,color:i<3?C.red:C.text},
                          {v:parseFloat(h.crimes_per_1000).toFixed(0),color:parseFloat(h.crimes_per_1000)>500?C.red:C.yellow},
                          {v:`${parseFloat(h.poverty_rate).toFixed(1)}%`,color:parseFloat(h.poverty_rate)>20?C.red:C.muted},
                          {v:h.vulnerability_label||'—',color:h.vulnerability_label==='High'||h.vulnerability_label==='Very High'?C.red:C.yellow},
                        ])}
                      />
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:700,color:C.green,letterSpacing:'.12em',marginBottom:10,textTransform:'uppercase'}}>✓ Safest — Bottom 6</div>
                      <DataTable
                        headers={['Neighborhood','Crimes/1k','Poverty %','Vulnerability']}
                        rows={hoodsSafe.map(h=>[
                          {v:h.name,color:C.green},
                          {v:parseFloat(h.crimes_per_1000).toFixed(0),color:C.green},
                          {v:`${parseFloat(h.poverty_rate).toFixed(1)}%`,color:C.muted},
                          {v:h.vulnerability_label||'—',color:C.green},
                        ])}
                      />
                      <div style={{marginTop:14}}>
                        <Finding text={`${hoodsSafe[0].name} is ${(parseFloat(hoodsTop[0].crimes_per_1000)/parseFloat(hoodsSafe[0].crimes_per_1000)).toFixed(0)}× safer than ${hoodsTop[0].name}. Same city. Same budget. Radically different outcomes.`} color={C.green} icon="✓"/>
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    <Prose accent><strong style={{color:'#fff'}}>Downtown LA leads all neighborhoods</strong> with 71,808 crimes over five years — 1,016 per 1,000 residents. In these neighborhoods, the average resident is statistically affected by crime roughly once per year.</Prose>
                    <Prose>The relationship between poverty and crime rate is strong but not deterministic. Neighborhoods above 20% poverty rate consistently appear in the highest-risk quartile — but low-poverty commercial corridors also rank high due to property crime concentration around businesses.</Prose>
                  </div>
                </>
              )}
            </div>

            <Sep/>

            {/* CH 08 */}
            <div style={{...SP,paddingBottom:60}} id="findings">
              <ChapterBanner n="08" title="Key Findings"
                thesis="Eight concrete, data-backed conclusions from 1,004,894 incidents — ranked by operational and policy significance."/>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {[
                  {n:'01',c:C.red,title:'The Clearance Rate Has Collapsed',
                   body:'The LAPD\'s solve rate fell from 24.0% (2020) to 12.1% (2024) — a 50% relative decline in four years. If this trajectory continues, fewer than 1 in 10 crimes will be resolved by 2026. This is the dataset\'s most alarming systemic trend.'},
                  {n:'02',c:C.red,title:'Vehicle Crime Is an Epidemic Without Accountability',
                   body:'194,292 vehicle crimes. 4.4% clearance rate. Stealing a car in Los Angeles carries virtually no risk of arrest. This single category — 19.3% of all crime — represents a structural failure in deterrence that compounds every year the solve rate stays under 5%.'},
                  {n:'03',c:C.yellow,title:`Five Divisions Drive ${ok?calc.top5pct:'~35'}% of All Crime`,
                   body:`${ok?calc.divSorted.slice(0,5).map(d=>d.name).join(', '):'The top five divisions'} generate a disproportionate share of total LAPD incidents. Geographically targeted resource allocation would address a large fraction of city crime without proportional budget increases.`},
                  {n:'04',c:C.purple,title:'Women Face Disproportionate Violent Crime',
                   body:`Female victims experience violent crime at ${ok?calc.femaleViolentPct+'%':'a higher rate'} — versus ${ok?calc.maleViolentPct+'%':'lower'} for men. Domestic violence and sex offenses are primary drivers. Targeted enforcement and victim support would materially reduce this disparity.`},
                  {n:'05',c:C.accent,title:'The 18:00–23:00 Window Is the Danger Zone',
                   body:'Crime peaks in the early evening and remains elevated through midnight. A concentrated patrol surge during this 5-hour window — especially on Fri/Sat — would address the highest-density crime period without around-the-clock expansion.'},
                  {n:'06',c:C.yellow,title:'Black Residents Face the Highest Violent Crime Rate',
                   body:'Black residents represent 18.3% of victims — roughly 2× their population share — with 42.3% of incidents being violent. This reflects historical resource inequities and geographic concentration in high-crime divisions.'},
                  {n:'07',c:C.green,title:'The Safest Hour Is 04:00–06:00',
                   body:'Crime reaches its statistical minimum in the pre-dawn hours. Patrol redistribution — shifting density from low-risk overnight slots to the 18:00–23:00 peak — could improve crime response without adding total deployment hours.'},
                  {n:'08',c:C.dim,title:"Don't Read 2024's Drop as Recovery",
                   body:"The 2024 count of 127,567 implies a 45% year-over-year decline. It does not reflect an actual crime reduction — it reflects partial-year data and a 7-day average reporting lag. Full-year trend analysis must use 2020–2023 only."},
                ].map(f=>(
                  <div key={f.n} style={{display:'flex',gap:18,padding:'18px 22px',
                    background:C.card,border:`1px solid ${C.border}`,
                    borderLeft:`3px solid ${f.c}`,borderRadius:8}}>
                    <div style={{fontSize:20,fontWeight:900,color:`${f.c}35`,flexShrink:0,lineHeight:1,marginTop:3,fontVariantNumeric:'tabular-nums'}}>{f.n}</div>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:'#fff',marginBottom:7}}>{f.title}</div>
                      <p style={{fontSize:13,color:C.muted,lineHeight:1.72,margin:0}}>{f.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* FOOTER */}
            <div style={{borderTop:`1px solid ${C.border}`,padding:'20px 40px',
              display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
              <span style={{fontSize:11,color:C.dim}}>Sources: LAPD Open Data 2020–2024 · US Census ACS · LA Times Neighborhood Boundaries · Open-Meteo · BLS</span>
              <span style={{fontSize:11,color:C.dim}}>1,004,894 incidents · {new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</span>
            </div>

          </div>{/* /main content */}
        </div>{/* /two-column */}
      </div>
    </Shell>
  );
}
