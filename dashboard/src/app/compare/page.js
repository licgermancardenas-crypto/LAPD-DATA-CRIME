'use client';

import { useState, useEffect, useMemo } from 'react';
import Shell from '@/components/Shell';

const C = {
  bg:'#07080f', card:'#111525', border:'#1e2235',
  accent:'#4f8ef7', red:'#f87171', green:'#34d399', yellow:'#fbbf24',
  purple:'#a78bfa', text:'#e8eaf0', muted:'#8a90a8', dim:'#4a5070',
};

function clrColor(r){ return r>=25?C.green:r>=15?C.yellow:C.red; }

function StatCard({ label, vA, vB, higherIsBetter=false, fmt=(v)=>v }){
  const numA = parseFloat(vA);
  const numB = parseFloat(vB);
  const diff  = numA - numB;
  const aWins = higherIsBetter ? diff > 0 : diff < 0;
  const bWins = higherIsBetter ? diff < 0 : diff > 0;
  return(
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:'14px 18px',display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:10,alignItems:'center'}}>
      <div style={{textAlign:'right'}}>
        <div style={{fontSize:22,fontWeight:900,color:aWins?C.green:bWins?C.red:'#fff',fontVariantNumeric:'tabular-nums'}}>{fmt(vA)}</div>
        {aWins&&<div style={{fontSize:9,color:C.green,fontWeight:700,letterSpacing:'.06em'}}>BETTER ▲</div>}
        {bWins&&<div style={{fontSize:9,color:C.red,fontWeight:700,letterSpacing:'.06em'}}>WORSE ▼</div>}
      </div>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:9,fontWeight:700,color:C.dim,letterSpacing:'.1em',textTransform:'uppercase',whiteSpace:'nowrap'}}>{label}</div>
        {!isNaN(diff)&&diff!==0&&(
          <div style={{fontSize:10,color:Math.abs(diff)>5?C.yellow:C.dim,marginTop:3,fontWeight:600}}>
            Δ {diff>0?'+':''}{typeof vA==='number'?diff.toFixed(1):'—'}
          </div>
        )}
      </div>
      <div style={{textAlign:'left'}}>
        <div style={{fontSize:22,fontWeight:900,color:bWins?C.green:aWins?C.red:'#fff',fontVariantNumeric:'tabular-nums'}}>{fmt(vB)}</div>
        {bWins&&<div style={{fontSize:9,color:C.green,fontWeight:700,letterSpacing:'.06em'}}>BETTER ▲</div>}
        {aWins&&<div style={{fontSize:9,color:C.red,fontWeight:700,letterSpacing:'.06em'}}>WORSE ▼</div>}
      </div>
    </div>
  );
}

function DivLabel({ name, color }){
  return(
    <div style={{textAlign:'center',padding:'16px 20px',background:C.card,border:`1px solid ${C.border}`,
      borderRadius:8,borderTop:`3px solid ${color}`}}>
      <div style={{fontSize:16,fontWeight:800,color:'#fff'}}>{name||'—'}</div>
      <div style={{fontSize:10,color:C.dim,marginTop:4,letterSpacing:'.08em',textTransform:'uppercase'}}>LAPD Division</div>
    </div>
  );
}

function HBar2({ pct, color, label, maxPct=100 }){
  return(
    <div style={{marginBottom:6}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
        <span style={{fontSize:11,color:C.muted}}>{label}</span>
        <span style={{fontSize:11,color:'#fff',fontWeight:700}}>{pct}%</span>
      </div>
      <div style={{background:'rgba(255,255,255,.05)',borderRadius:3,overflow:'hidden',height:5}}>
        <div style={{height:'100%',width:`${(pct/maxPct)*100}%`,background:color,borderRadius:3}}/>
      </div>
    </div>
  );
}

export default function ComparePage(){
  const [divisions, setDivisions] = useState([]);
  const [catData,   setCatData]   = useState([]);
  const [selA, setSelA] = useState('');
  const [selB, setSelB] = useState('');

  useEffect(()=>{
    fetch('/data/division.json').then(r=>r.json()).then(setDivisions).catch(console.error);
    fetch('/data/categories.json').then(r=>r.json()).then(setCatData).catch(console.error);
  },[]);

  const dA = useMemo(()=>divisions.find(d=>d.name===selA)||null,[divisions,selA]);
  const dB = useMemo(()=>divisions.find(d=>d.name===selB)||null,[divisions,selB]);

  const totalCrimes = useMemo(()=>divisions.reduce((s,d)=>s+d.crimes,0)||1,[divisions]);

  const sortedDivs = useMemo(()=>[...divisions].sort((a,b)=>a.name.localeCompare(b.name)),[divisions]);

  return(
    <Shell>
      <div style={{background:C.bg,minHeight:'100vh',color:C.text,fontFamily:'Inter,system-ui,sans-serif'}}>

        {/* HEADER */}
        <div style={{borderBottom:`1px solid ${C.border}`,padding:'32px 40px 28px',background:'linear-gradient(160deg,#0b0e22 0%,#07080f 80%)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <span style={{fontSize:10,fontWeight:800,letterSpacing:'.2em',color:C.accent,
              background:'rgba(79,142,247,.08)',border:'1px solid rgba(79,142,247,.2)',
              padding:'4px 12px',borderRadius:4}}>DIVISION COMPARE</span>
            <span style={{fontSize:10,color:C.dim,letterSpacing:'.1em'}}>LOS ANGELES · 2020–2024</span>
          </div>
          <h1 style={{fontSize:36,fontWeight:900,color:'#fff',letterSpacing:'-0.02em',marginBottom:8}}>
            Division Comparison Tool
          </h1>
          <p style={{fontSize:14,color:C.muted,maxWidth:560}}>
            Select any two LAPD divisions to compare crime volume, clearance performance, and crime mix side by side.
          </p>
        </div>

        <div style={{padding:'36px 40px',maxWidth:1100,margin:'0 auto'}}>

          {/* SELECTORS */}
          <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:16,alignItems:'center',marginBottom:36}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.dim,letterSpacing:'.12em',textTransform:'uppercase',marginBottom:8}}>Division A</div>
              <select
                value={selA}
                onChange={e=>setSelA(e.target.value)}
                style={{width:'100%',padding:'10px 14px',background:'#161923',border:`1px solid ${selA?C.accent:C.border}`,
                  borderRadius:6,color:selA?'#fff':C.muted,fontSize:13,fontFamily:'inherit',outline:'none',cursor:'pointer'}}
              >
                <option value="">Select division…</option>
                {sortedDivs.filter(d=>d.name!==selB).map(d=>(
                  <option key={d.name} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            <div style={{textAlign:'center',padding:'0 8px'}}>
              <div style={{fontSize:24,color:C.dim,fontWeight:900}}>vs</div>
            </div>

            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.dim,letterSpacing:'.12em',textTransform:'uppercase',marginBottom:8}}>Division B</div>
              <select
                value={selB}
                onChange={e=>setSelB(e.target.value)}
                style={{width:'100%',padding:'10px 14px',background:'#161923',border:`1px solid ${selB?C.purple:C.border}`,
                  borderRadius:6,color:selB?'#fff':C.muted,fontSize:13,fontFamily:'inherit',outline:'none',cursor:'pointer'}}
              >
                <option value="">Select division…</option>
                {sortedDivs.filter(d=>d.name!==selA).map(d=>(
                  <option key={d.name} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {(!dA||!dB)&&(
            <div style={{textAlign:'center',padding:'80px 20px',border:`1px dashed ${C.border}`,borderRadius:12}}>
              <div style={{fontSize:36,marginBottom:16,opacity:.3}}>⚖️</div>
              <div style={{fontSize:15,color:C.dim}}>Select two divisions above to start comparing</div>
              <div style={{fontSize:12,color:C.dim,marginTop:6,opacity:.6}}>21 LAPD divisions · 2020–2024 data</div>
            </div>
          )}

          {dA&&dB&&(
            <>
              {/* Division labels */}
              <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:16,marginBottom:24}}>
                <DivLabel name={dA.name} color={C.accent}/>
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',color:C.dim,fontSize:12,fontWeight:700,padding:'0 8px'}}>VS</div>
                <DivLabel name={dB.name} color={C.purple}/>
              </div>

              {/* Key stats grid */}
              <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:32}}>
                <div style={{fontSize:10,fontWeight:700,color:C.dim,letterSpacing:'.14em',textTransform:'uppercase',marginBottom:4}}>Key Metrics</div>
                <StatCard label="Total Crimes" vA={dA.crimes} vB={dB.crimes} higherIsBetter={false} fmt={v=>Number(v).toLocaleString()}/>
                <StatCard label="City Share %" vA={parseFloat((dA.crimes/totalCrimes*100).toFixed(1))} vB={parseFloat((dB.crimes/totalCrimes*100).toFixed(1))} higherIsBetter={false} fmt={v=>`${v}%`}/>
                <StatCard label="Clearance Rate" vA={dA.clearance_rate} vB={dB.clearance_rate} higherIsBetter={true} fmt={v=>`${v}%`}/>
                <StatCard label="Violent Crime %" vA={dA.violent_pct} vB={dB.violent_pct} higherIsBetter={false} fmt={v=>`${v}%`}/>
                <StatCard label="Part 1 — Serious" vA={dA.crimes_p1} vB={dB.crimes_p1} higherIsBetter={false} fmt={v=>Number(v).toLocaleString()}/>
                <StatCard label="Part 2 — Minor" vA={dA.crimes_p2} vB={dB.crimes_p2} higherIsBetter={false} fmt={v=>Number(v).toLocaleString()}/>
                <StatCard label="P1 Clearance %" vA={dA.clearance_rate_p1||0} vB={dB.clearance_rate_p1||0} higherIsBetter={true} fmt={v=>`${v}%`}/>
                <StatCard label="P2 Clearance %" vA={dA.clearance_rate_p2||0} vB={dB.clearance_rate_p2||0} higherIsBetter={true} fmt={v=>`${v}%`}/>
              </div>

              {/* Bar comparison */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,marginBottom:32}}>
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderTop:`2px solid ${C.accent}`,borderRadius:8,padding:'20px 22px'}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.dim,letterSpacing:'.12em',textTransform:'uppercase',marginBottom:16}}>{dA.name} — Profile</div>
                  <HBar2 pct={parseFloat((dA.crimes/totalCrimes*100).toFixed(1))} color={C.accent} label="City Crime Share" maxPct={15}/>
                  <HBar2 pct={dA.clearance_rate} color={clrColor(dA.clearance_rate)} label="Clearance Rate" maxPct={50}/>
                  <HBar2 pct={dA.violent_pct} color={C.red} label="Violent Crime %" maxPct={50}/>
                  <HBar2 pct={parseFloat((dA.crimes_p1/dA.crimes*100).toFixed(1))} color={C.yellow} label="Part 1 Share" maxPct={80}/>
                </div>
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderTop:`2px solid ${C.purple}`,borderRadius:8,padding:'20px 22px'}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.dim,letterSpacing:'.12em',textTransform:'uppercase',marginBottom:16}}>{dB.name} — Profile</div>
                  <HBar2 pct={parseFloat((dB.crimes/totalCrimes*100).toFixed(1))} color={C.purple} label="City Crime Share" maxPct={15}/>
                  <HBar2 pct={dB.clearance_rate} color={clrColor(dB.clearance_rate)} label="Clearance Rate" maxPct={50}/>
                  <HBar2 pct={dB.violent_pct} color={C.red} label="Violent Crime %" maxPct={50}/>
                  <HBar2 pct={parseFloat((dB.crimes_p1/dB.crimes*100).toFixed(1))} color={C.yellow} label="Part 1 Share" maxPct={80}/>
                </div>
              </div>

              {/* Verdict */}
              <div style={{background:'rgba(79,142,247,.04)',border:`1px solid rgba(79,142,247,.15)`,borderRadius:8,padding:'20px 24px'}}>
                <div style={{fontSize:10,fontWeight:700,color:C.accent,letterSpacing:'.14em',textTransform:'uppercase',marginBottom:12}}>Analysis</div>
                <div style={{display:'flex',flexDirection:'column',gap:8,fontSize:13,color:C.muted,lineHeight:1.72}}>
                  {(()=>{
                    const crimeWinner = dA.crimes < dB.crimes ? dA.name : dA.crimes > dB.crimes ? dB.name : null;
                    const clrWinner   = dA.clearance_rate > dB.clearance_rate ? dA.name : dA.clearance_rate < dB.clearance_rate ? dB.name : null;
                    const pctDiff     = Math.abs(dA.clearance_rate - dB.clearance_rate);
                    const crimeDiff   = Math.abs(dA.crimes - dB.crimes);
                    return(
                      <>
                        {crimeWinner&&<p style={{margin:0}}><strong style={{color:'#fff'}}>{crimeWinner}</strong> has fewer total crimes ({crimeDiff.toLocaleString()} fewer incidents over 5 years — {(crimeDiff/Math.max(dA.crimes,dB.crimes)*100).toFixed(1)}% less).</p>}
                        {clrWinner&&<p style={{margin:0}}><strong style={{color:'#fff'}}>{clrWinner}</strong> solves cases more effectively ({pctDiff.toFixed(1)} percentage point advantage in clearance rate).</p>}
                        {dA.violent_pct !== dB.violent_pct&&<p style={{margin:0}}><strong style={{color:'#fff'}}>{dA.violent_pct > dB.violent_pct ? dA.name : dB.name}</strong> sees higher violent crime concentration ({Math.abs(dA.violent_pct - dB.violent_pct).toFixed(1)}pp gap) — a proxy for resident safety risk beyond raw crime counts.</p>}
                      </>
                    );
                  })()}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}
