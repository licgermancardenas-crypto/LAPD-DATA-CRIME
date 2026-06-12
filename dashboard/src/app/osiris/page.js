'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const LaMapGoogle = dynamic(
  () => import('../../components/LaMapGoogle'),
  { ssr: false, loading: () => null }
);
import BizCrimeCorrelation from '../../components/BizCrimeCorrelation';
import {
  ChevronLeft, ChevronRight, Shield, Activity,
  Radio, Users, Eye, EyeOff, Target, Zap, Filter, Layers,
  Play, Pause, ArrowLeft, TrendingUp,
} from 'lucide-react';

// ── Color palette ──────────────────────────────────────────────────────────
const C = {
  bg:      '#010d1f',
  glass:   'rgba(1,10,26,.90)',
  border:  'rgba(56,189,248,.25)',
  accent:  '#38bdf8',
  accent2: '#67e8f9',
  accent3: '#93c5fd',
  dim:     '#7dd3fc',
  dimmer:  '#38bdf8',
  muted:   '#bae6fd',
  text:    '#ffffff',
  glow:    'rgba(103,232,249,.30)',
};

// ── Map registry ───────────────────────────────────────────────────────────
const MAPS = [
  { id:'heat',          label:'HEATMAP',      short:'HEAT',   src:'/osint-map.html?layer=heat',           group:'osint', icon:'🔥' },
  { id:'cluster',       label:'CLUSTERS',     short:'CLUST',  src:'/osint-map.html?layer=cluster',        group:'osint', icon:'◉'  },
  { id:'choropleth',    label:'CHOROPLETH',   short:'CHORO',  src:'/osint-map.html?layer=choropleth',     group:'osint', icon:'◈'  },
  { id:'divisions',     label:'DIVISIONES',   short:'DIV',    src:'/lapd-map.html',                       group:'lapd',  icon:'🏛' },
  { id:'lapd-heat',     label:'CALOR LAPD',   short:'CALOR',  src:'/maps/heatmap.html',                   group:'lapd',  icon:'🌡' },
  { id:'per1k',         label:'POR 1.000',    short:'1K',     src:'/maps/tract-choropleth.html',          group:'lapd',  icon:'👥' },
  { id:'vulnerability', label:'VULNERABILID', short:'VULN',   src:'/maps/vulnerability-choropleth.html', group:'lapd',  icon:'⚠'  },
  { id:'barrios',       label:'BARRIOS',      short:'BAR',    src:'/maps/neighborhood-choropleth.html',  group:'lapd',  icon:'🏘' },
  { id:'negocios',      label:'NEGOCIOS',     short:'NEG',    src:'/maps/business-choropleth.html',      group:'lapd',  icon:'🏪' },
  { id:'tactical',      label:'L.A. MAP',     short:'CIA',    src:'/maps/la-tactical.html',              group:'tactical', icon:'🛰' },
  { id:'mobility',      label:'MOBILITY',     short:'MOB',    src:'/maps/mobility-intelligence.html',    group:'osint',    icon:'🚌' },
  { id:'edu-safety',      label:'EDU SAFETY',     short:'EDU',  src:'/maps/edu-safety.html',         group:'osint', icon:'🎓' },
  { id:'jurisdicciones',  label:'JURISDICCIONES', short:'JUR',  src:'/maps/jurisdicciones.html',     group:'osint', icon:'🗺' },
];

const OSINT_IDS = new Set(['heat','cluster','choropleth','mobility']);
const YEARS     = [null, 2020, 2021, 2022, 2023, 2024];

const MAP_LABELS = {
  heat:'HEATMAP OSINT', cluster:'CLUSTER OSINT', choropleth:'CHOROPLETH OSINT',
  divisions:'DIVISIONES LAPD', 'lapd-heat':'CALOR LAPD', per1k:'CRIMEN/1K HAB',
  vulnerability:'VULNERABILIDAD', barrios:'BARRIOS', negocios:'NEGOCIOS',
  tactical:'L.A. MAP TACTICAL',
  mobility:'OSINT // MOBILITY',
  'edu-safety':'EDU & PUBLIC SAFETY',
  jurisdicciones:'JURISDICCIONES LA',
};

const CLICK_WHAT_IS = {
  division:           'Una División del LAPD es el distrito policial que patrulla esta zona. Cada división cubre un área geográfica específica de Los Ángeles y reporta sus estadísticas de crimen de forma independiente.',
  cluster:            'Este clúster agrupa múltiples incidentes criminales ocurridos en proximidad geográfica. El número indica la cantidad de delitos registrados en esa zona. Expandilo para ver incidentes individuales.',
  incident:           'Un incidente criminal individual registrado por el LAPD. Cada punto representa un delito específico con hora, tipo de crimen y ubicación exacta dentro de Los Ángeles.',
  location:           'Punto geográfico seleccionado en el mapa de densidad de calor. La intensidad del color refleja la concentración de incidentes criminales registrados en el área inmediata.',
  neighborhood:       'Un barrio oficial de Los Ángeles (Neighborhood Council Area). Agrupa estadísticas de crimen, demografía y vulnerabilidad social a nivel de comunidad.',
  tract:              'Un Census Tract (radio censal) del US Census Bureau — la unidad estadística más granular disponible, con datos de población, densidad de crimen y nivel de riesgo.',
  vulnerability_tract:'Radio censal clasificado por un índice de vulnerabilidad socioeconómica que combina tasa de pobreza, ingreso mediano y concentración de crimen.',
  business:           'Distrito analizado por densidad de negocios vs. concentración de crimen. Muestra la relación entre actividad comercial y delitos en la zona.',
  edu_school:         'Institución educativa de Los Ángeles clasificada por nivel de cobertura policial. La distancia a la estación más cercana determina si está en zona Segura (<1km), Alerta (1-3km) o Vulnerable (>3km). Los datos de crimen corresponden a incidentes en radio 300m durante horarios de entrada (7-9h) y salida (14-16h).',
  edu_station:        'Estación de seguridad pública con cobertura sobre establecimientos educativos cercanos. El número de escuelas asignadas indica la carga jurisdiccional de la estación en el análisis de cobertura escolar.',
  jurisdiction:       'Unidad geográfica político-administrativa del condado o ciudad de Los Ángeles. Las ciudades incorporadas tienen gobierno propio; las comunidades no incorporadas dependen del condado; los Neighborhood Councils son órganos civiles; los HPOZ son distritos de preservación histórica regulados por la ciudad.',
};

// ── Feed helpers ──────────────────────────────────────────────────────────
const DIV_CODE = {
  'Central':'CTL','77Th Street':'77S','Pacific':'PAC','Southwest':'SW','Newton':'NTN',
  'Hollywood':'HWD','Olympic':'OLY','Rampart':'RMP','Hollenbeck':'HLB','Northeast':'NE',
  'Wilshire':'WIL','West La':'WLA','Southeast':'SE','Harbor':'HBR','N Hollywood':'NHD',
  'Topanga':'TOP','Devonshire':'DEV','Van Nuys':'VAN','Mission':'MSN','West Valley':'WVL','Foothill':'FOT',
};
const CRM_CODE = {
  'Vehicle Crime':'510','Property – Theft':'330','Property – Burglary':'210',
  'Violent – Assault & Battery':'624','Property – Vandalism':'740','Identity / Fraud':'660',
  'Domestic Violence':'626','Violent – Robbery':'211','Violent – Aggravated Assault':'245',
  'Sex Offense':'647','Other':'999','Violent – Homicide':'187',
};

function sr(seed,n){return Math.abs(Math.sin(seed*9973+n*4127+1))%1;}

// forcedHour pins the hour for slider-driven filtering
function makeFeedEntry(seed, divisions, categories, partFilter, forcedHour = null){
  const cats = partFilter==='all' ? categories : categories.filter(c=>c.part===partFilter);
  if(!cats.length||!divisions.length) return null;
  const div = divisions[Math.floor(sr(seed,1)*divisions.length)];
  const cat = cats[Math.floor(sr(seed,2)*cats.length)] ?? categories[0];
  const h   = forcedHour !== null ? forcedHour : Math.floor(sr(seed,3)*24);
  const m   = Math.floor(sr(seed,4)*60);
  const age = Math.floor(sr(seed,5)*54)+18;
  const isClr = sr(seed,6)<(cat.clearance_rate/100);
  return{
    id: seed,
    time:`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`,
    divCode: DIV_CODE[div.name]??div.name.slice(0,3).toUpperCase(),
    area: div.name.toUpperCase(),
    crmCode: CRM_CODE[cat.category]??'500',
    desc: cat.category.toUpperCase().replace(/[–—]/g,'-').slice(0,18),
    age, status: isClr?'CLR':'OPN', part: cat.part,
  };
}

function fmt(n){
  if(n>=1e6) return (n/1e6).toFixed(2)+'M';
  if(n>=1e3) return (n/1e3).toFixed(1)+'k';
  return String(n);
}

function generateInsights(info){
  const bullets=[];
  if(info.clickType==='division'){
    const rank=info.rank,clr=parseFloat(info.clearance)||0,totalDivs=info.totalDivs||21;
    bullets.push(`Ocupa el puesto #${rank} de ${totalDivs} divisiones por volumen de crimen total.`);
    bullets.push(`Tasa de resolución de ${clr}%${clr>=50?' — por encima del promedio LAPD':clr>=30?' — en la media':' — requiere atención urgente'}.`);
    if(info.topCategory) bullets.push(`Categoría dominante: ${info.topCategory}. Orienta el despliegue de unidades especializadas.`);
  } else if(info.clickType==='cluster'){
    const count=info.count||0;
    bullets.push(`Concentración de ${count} incidentes en radio reducido — zona de alta reincidencia espacial.`);
    bullets.push(`Clusters de +10 casos sugieren patrón sistémico o puntos ciegos de patrullaje.`);
    bullets.push('Usá el mapa CHORO para verificar si pertenece a la división de mayor crimen.');
  } else if(info.clickType==='incident'){
    bullets.push(`Incidente a las ${String(info.hour||0).padStart(2,'0')}:00 hs. Los delitos violentos se concentran entre las 18h y las 02h.`);
    bullets.push('Cada punto representa un registro único del LAPD Crime Dataset 2020-2024.');
    bullets.push('Activá el filtro P1 en el header para aislar solo crímenes de mayor gravedad.');
  } else if(info.clickType==='location'){
    bullets.push('La intensidad del calor es proporcional al número de incidentes en el radio inmediato.');
    bullets.push('Zonas de alta temperatura en HEAT correlacionan con divisiones top-5 en el mapa CHORO.');
    bullets.push('Compará con VULN para detectar si el crimen coincide con vulnerabilidad socioeconómica.');
  } else if(info.clickType==='neighborhood'){
    const rank=info.rank,totalN=info.totalNeighborhoods||114;
    bullets.push(`Posición #${rank} de ${totalN} barrios — ${rank<=23?'zona de alto riesgo (top 20%)':rank<=57?'riesgo intermedio':'bajo crimen relativo'}.`);
    if(info.crimes_per_1000) bullets.push(`Con ${info.crimes_per_1000} crím/1k hab., ${parseFloat(info.crimes_per_1000)>50?'supera ampliamente la media de la ciudad':'se mantiene por debajo de la media'}.`);
    if(info.division) bullets.push(`Pertenece a la División ${info.division}. Cruzá con el mapa DIV para ver el contexto policial.`);
  } else if(info.clickType==='tract'){
    const risk=info.risk||'';
    bullets.push(`Clasificación "${risk}" basada en crímenes por 1.000 habitantes — métrica estandarizada que permite comparar tracts con distinta densidad.`);
    if(info.crimes_per_1000) bullets.push(`${info.crimes_per_1000} crím/1k hab. Los tracts Very High superan 5× la mediana de Los Ángeles.`);
    bullets.push('Cruzá con VULN para ver si el alto crimen coincide con vulnerabilidad socioeconómica estructural.');
  } else if(info.clickType==='vulnerability_tract'){
    const score=parseFloat(info.vulnerability_score)||0;
    bullets.push(`Score ${score.toFixed(2)} — combina pobreza (${info.poverty_rate||0}%), ingreso mediano y concentración de crimen en un índice único.`);
    if(info.crimes_per_1000) bullets.push(`Con ${info.crimes_per_1000} crím/1k hab., ${parseFloat(info.crimes_per_1000)>60?'la criminalidad confirma la vulnerabilidad estructural':'el crimen no refleja toda la fragilidad social del área'}.`);
    bullets.push('Tracts muy vulnerables con bajo crimen actual son zonas de riesgo latente: priorizarlos en prevención.');
  } else if(info.clickType==='business'){
    const cpb=parseFloat(info.crimes_per_biz)||0;
    bullets.push(`${cpb.toFixed(2)} crímenes por negocio — ${cpb>2?'ratio elevado: la actividad comercial atrae delitos oportunistas':'ratio bajo, baja exposición comercial a la criminalidad'}.`);
    if(info.biz_count) bullets.push(`Con ${info.biz_count} negocios, densidad ${info.biz_count>200?'alta':'moderada'} — más negocios elevan la exposición al crimen de oportunidad.`);
    bullets.push('Si crime_rank << biz_rank, el crimen es desproporcionado respecto al tejido comercial.');
  } else if(info.clickType==='edu_school'){
    const riskMap={safe:'ZONA SEGURA (<1km)',alert:'ALERTA (1-3km)',vuln:'VULNERABLE (>3km)'};
    const riskLabel=riskMap[info.risk]||info.risk||'desconocido';
    bullets.push(`Clasificación ${riskLabel} — distancia a estación más cercana: ${info.distKm||'—'} km (${info.nearestAgency||'—'}).`);
    if(info.minLAPD&&info.minLAPD!=='—') bullets.push(`LAPD más cercano: ${info.minLAPD} km · LASD más cercano: ${info.minLASD||'—'} km. La jurisdicción efectiva depende de acuerdos interagenciales.`);
    const cc=parseInt(info.crimeCount)||0;
    if(cc>0) bullets.push(`⚠ ${cc} incidentes registrados en radio 300m durante horarios escolares (07-09h y 14-16h). Priorizar patrullaje en esas ventanas.`);
    else     bullets.push('Sin incidentes registrados en horario escolar en radio 300m — entorno de bajo conflicto en horas críticas.');
  } else if(info.clickType==='edu_station'){
    const n=parseInt(info.schoolsAssigned)||0;
    bullets.push(`Estación ${info.agency||'LAPD'} con ${n} escuelas asignadas jurisdiccionalmente — ${n>30?'carga alta: recurso crítico para seguridad escolar':n>15?'carga moderada':'cobertura holgada en su área'}.`);
    bullets.push('Las ventanas de mayor riesgo son 07:00-09:00 (entrada) y 14:00-16:00 (salida). Reforzar presencia en esos horarios en escuelas vulnerables del área.');
    bullets.push('Cruzar con mapa VULN para ver si las escuelas asignadas se ubican en tracts de alta vulnerabilidad socioeconómica.');
  } else if(info.clickType==='jurisdiction'){
    const typeMap={cities:'ciudad incorporada',uninc:'comunidad no incorporada',councils:'Neighborhood Council',hpoz:'zona histórica HPOZ'};
    const tl=typeMap[info.jurisType]||'área geográfica';
    bullets.push(`${info.name||'Esta área'} es una ${tl} ubicada en la región ${info.region||'—'} del condado/ciudad de Los Ángeles.`);
    if(info.jurisType==='cities') bullets.push('Las ciudades incorporadas tienen su propio gobierno municipal, impuestos y policía local (o contrato con el Sheriff del condado).');
    if(info.jurisType==='uninc')  bullets.push('Las comunidades no incorporadas reciben servicios de la Sheriffʼs Department y del condado en lugar de un municipio propio.');
    if(info.jurisType==='councils') bullets.push('Los Neighborhood Councils son órganos civiles de participación comunitaria certificados por la Ciudad de Los Ángeles — no tienen poder ejecutivo pero tienen voz en decisiones de planeación urbana.');
    if(info.jurisType==='hpoz')  bullets.push(`Fase ${info.phase||'—'} · Área de Planificación Comunitaria ${info.cpa||'—'}. Los HPOZ restringen demoliciones y cambios de fachada para preservar el carácter histórico.`);
    bullets.push('Usá el filtro ÁREA para ver qué División LAPD cubre esta zona y cruzar con crimen/vulnerabilidad.');
  }
  return bullets;
}

// ── Sub-components ────────────────────────────────────────────────────────

function KpiBlock({label,value,sub,color}){
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start',padding:'0 14px',borderLeft:`1px solid ${color}30`}}>
      <span style={{fontSize:10,color:C.dim,letterSpacing:'.11em',fontWeight:700,textTransform:'uppercase'}}>{label}</span>
      <span style={{fontSize:22,fontWeight:800,color:'#fff',lineHeight:1.1,marginTop:2,textShadow:`0 0 18px ${color}`}}>{value}</span>
      {sub&&<span style={{fontSize:10,color:C.muted,marginTop:1,fontWeight:500}}>{sub}</span>}
    </div>
  );
}

function AlertBadge({label}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 11px',borderRadius:5,background:'rgba(220,38,38,.10)',border:'1px solid rgba(220,38,38,.40)'}}>
      <span className="osiris-pulse" style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:'#ef4444'}}/>
      <span style={{fontSize:10,fontWeight:800,color:'#fca5a5',letterSpacing:'.07em'}}>{label}</span>
    </div>
  );
}

function HourlyBars({hourlyTotals, activeHour}){
  if(!hourlyTotals) return <div style={{height:64,background:'rgba(29,78,216,.05)',borderRadius:4}}/>;
  const max = Math.max(...hourlyTotals);
  const W=24*11-1, H=64;
  return(
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:'block'}}>
      {hourlyTotals.map((v,h)=>{
        const bh   = Math.max(2,(v/max)*(H-12));
        const x    = h*11;
        const t    = v/max;
        const isAct= h===activeHour;
        const fill = isAct ? '#67e8f9' : (t>.8?'#38bdf8':t>.5?'#0ea5e9':t>.3?'#1d4ed8':'#1e3a8a');
        return(
          <g key={h}>
            {isAct&&<rect x={x-1} y={0} width={11} height={H-10} rx={2} fill='rgba(103,232,249,.07)'/>}
            <rect x={x} y={H-bh-10} width={9} height={bh} rx={2} fill={fill} opacity={isAct?1:.65}/>
            {isAct&&<rect x={x} y={H-9} width={9} height={2} rx={1} fill='#67e8f9'/>}
            {h%6===0&&(
              <text x={x+4.5} y={H-1} textAnchor="middle"
                style={{fontSize:7,fill:isAct?'#67e8f9':C.dim,fontFamily:'monospace',fontWeight:isAct?700:400}}>
                {String(h).padStart(2,'0')}h
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function ProgBar({label,value,max,color}){
  const pct=Math.round((value/max)*100);
  return(
    <div style={{marginBottom:9}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
        <span style={{fontSize:11,color:'#e0f2fe',fontWeight:600}} title={label}>{label.length>22?label.slice(0,22)+'…':label}</span>
        <span style={{fontSize:11,color:'#fff',fontWeight:800,textShadow:`0 0 8px ${color}`}}>{fmt(value)}</span>
      </div>
      <div style={{height:3,background:'rgba(255,255,255,.07)',borderRadius:2,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,borderRadius:2,background:`linear-gradient(90deg,${color}60,${color})`,transition:'width .5s ease'}}/>
      </div>
    </div>
  );
}

function DemoBars({items,valueKey,labelKey}){
  if(!items?.length) return null;
  const max=Math.max(...items.map(d=>d[valueKey]));
  return(
    <div>
      {items.map((d,i)=>(
        <div key={i} style={{marginBottom:7}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
            <span style={{fontSize:11,color:'#e0f2fe',fontWeight:600}}>{d[labelKey]}</span>
            <span style={{fontSize:11,color:'#fff',fontWeight:700}}>{d.share_pct?.toFixed(1)}%</span>
          </div>
          <div style={{height:3,background:'rgba(255,255,255,.06)',borderRadius:1,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${(d[valueKey]/max)*100}%`,borderRadius:1,background:'linear-gradient(90deg,#0ea5e9,#67e8f9)',opacity:.8}}/>
          </div>
        </div>
      ))}
    </div>
  );
}

function ClickIntelPanel({info,data,onDismiss}){
  const mapLabel=MAP_LABELS[info.mapId]??info.mapId?.toUpperCase()??'MAPA';
  const whatIsIt=CLICK_WHAT_IS[info.clickType]??'Elemento interactivo del mapa seleccionado.';
  const insights=generateInsights(info);

  const rows=[];
  if(info.clickType==='division'){
    if(info.name)        rows.push(['División',info.name]);
    if(info.total)       rows.push(['Total crímenes',Number(info.total).toLocaleString()]);
    if(info.clearance)   rows.push(['Clearance Rate',info.clearance+'%']);
    if(info.topCategory) rows.push(['Top categoría',info.topCategory]);
    if(info.rank)        rows.push(['Ranking',`#${info.rank} de ${info.totalDivs||21}`]);
  } else if(info.clickType==='cluster'){
    if(info.count)  rows.push(['Incidentes',info.count]);
    if(info.lat!=null) rows.push(['Lat',String(info.lat)]);
    if(info.lng!=null) rows.push(['Lng',String(info.lng)]);
  } else if(info.clickType==='incident'){
    rows.push(['Tipo','Incidente individual']);
    if(info.hour!==undefined) rows.push(['Hora',String(info.hour).padStart(2,'0')+':XX hs']);
    if(info.lat!=null) rows.push(['Lat',String(info.lat)]);
    if(info.lng!=null) rows.push(['Lng',String(info.lng)]);
  } else if(info.clickType==='location'){
    rows.push(['Tipo','Punto heatmap']);
    if(info.lat!=null) rows.push(['Lat',String(info.lat)]);
    if(info.lng!=null) rows.push(['Lng',String(info.lng)]);
  } else if(info.clickType==='neighborhood'){
    if(info.name)           rows.push(['Barrio',info.name]);
    if(info.total)          rows.push(['Total crímenes',Number(info.total).toLocaleString()]);
    if(info.crimes_per_1000) rows.push(['Crím / 1k hab',info.crimes_per_1000]);
    if(info.population)     rows.push(['Población',Number(info.population).toLocaleString()]);
    if(info.division)       rows.push(['División LAPD',info.division]);
    if(info.clearance)      rows.push(['Clearance',info.clearance+'%']);
    if(info.rank)           rows.push(['Ranking',`#${info.rank} / ${info.totalNeighborhoods||114}`]);
  } else if(info.clickType==='tract'){
    if(info.tract)          rows.push(['Tract',info.tract]);
    if(info.total)          rows.push(['Total crímenes',Number(info.total).toLocaleString()]);
    if(info.crimes_per_1000) rows.push(['Crím / 1k hab',info.crimes_per_1000]);
    if(info.risk)           rows.push(['Nivel riesgo',info.risk]);
    if(info.population)     rows.push(['Población',Number(info.population).toLocaleString()]);
  } else if(info.clickType==='vulnerability_tract'){
    if(info.tract)           rows.push(['Tract',info.tract]);
    if(info.vulnerability)   rows.push(['Vulnerabilidad',info.vulnerability]);
    if(info.vulnerability_score) rows.push(['Score',parseFloat(info.vulnerability_score).toFixed(2)]);
    if(info.crimes_per_1000) rows.push(['Crím / 1k hab',info.crimes_per_1000]);
    if(info.poverty_rate)    rows.push(['Tasa pobreza',info.poverty_rate+'%']);
    if(info.median_income)   rows.push(['Ingreso mediano','$'+Number(info.median_income).toLocaleString()]);
    if(info.population)      rows.push(['Población',Number(info.population).toLocaleString()]);
  } else if(info.clickType==='business'){
    if(info.name)           rows.push(['Distrito',info.name]);
    if(info.biz_count)      rows.push(['Negocios',Number(info.biz_count).toLocaleString()]);
    if(info.crimes_per_biz) rows.push(['Crím / negocio',parseFloat(info.crimes_per_biz).toFixed(2)]);
    if(info.total)          rows.push(['Total crímenes',Number(info.total).toLocaleString()]);
    if(info.crimes_per_1000) rows.push(['Crím / 1k hab',info.crimes_per_1000]);
    if(info.biz_rank)       rows.push(['Rank negocios',`#${info.biz_rank}`]);
    if(info.crime_rank)     rows.push(['Rank crimen',`#${info.crime_rank}`]);
  } else if(info.clickType==='edu_school'){
    const riskColors={safe:'#34d399',alert:'#fbbf24',vuln:'#ef4444'};
    const riskLabels={safe:'ZONA SEGURA',alert:'ALERTA',vuln:'VULNERABLE'};
    if(info.name)           rows.push(['Institución',info.name]);
    if(info.cat2)           rows.push(['Categoría',info.cat2]);
    if(info.city)           rows.push(['Ciudad',info.city]);
    if(info.risk)           rows.push(['Cobertura',riskLabels[info.risk]||info.risk]);
    if(info.distKm)         rows.push(['Dist. estación',info.distKm+' km']);
    if(info.nearestStation&&info.nearestStation!=='—') rows.push(['Estación cercana',info.nearestStation.replace('Los Angeles Police Department - ','').replace(' Community Police Station','').slice(0,28)]);
    if(info.nearestAgency)  rows.push(['Agencia',info.nearestAgency]);
    if(info.minLAPD&&info.minLAPD!=='—') rows.push(['Dist. LAPD',info.minLAPD+' km']);
    if(info.minLASD&&info.minLASD!=='—') rows.push(['Dist. LASD',info.minLASD+' km']);
    rows.push(['Incidentes HE',String(info.crimeCount||0)]);
  } else if(info.clickType==='edu_station'){
    if(info.name)            rows.push(['Estación',info.name.replace('Los Angeles Police Department - ','').replace(' Community Police Station','')]);
    if(info.agency)          rows.push(['Agencia',info.agency]);
    if(info.addr&&info.addr!=='—') rows.push(['Dirección',info.addr]);
    if(info.city&&info.city!=='—') rows.push(['Ciudad',info.city]);
    rows.push(['Escuelas asignadas',String(info.schoolsAssigned||0)]);
  } else if(info.clickType==='jurisdiction'){
    const typeLabels={cities:'Ciudad Incorporada',uninc:'Comunidad No Incorp.',councils:'Neighborhood Council',hpoz:'Zona Histórica (HPOZ)'};
    if(info.name)     rows.push(['Nombre',info.name]);
    if(info.jurisType) rows.push(['Tipo',typeLabels[info.jurisType]||info.jurisType]);
    if(info.region)   rows.push(['Región',info.region]);
    if(info.lat)      rows.push(['Lat',info.lat]);
    if(info.lng)      rows.push(['Lng',info.lng]);
    if(info.phase&&info.phase!=='—') rows.push(['Fase HPOZ',info.phase]);
    if(info.cpa&&info.cpa!=='—')     rows.push(['CPA',info.cpa]);
    if(info.nc_id&&info.nc_id!=='—') rows.push(['NC ID',info.nc_id]);
  }

  return(
    <div style={{marginBottom:14,borderRadius:8,overflow:'hidden',border:'1px solid rgba(103,232,249,.4)',background:'rgba(0,15,40,.65)',boxShadow:'0 0 28px rgba(103,232,249,.10)'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 11px',background:'rgba(103,232,249,.08)',borderBottom:'1px solid rgba(103,232,249,.18)'}}>
        <div style={{display:'flex',alignItems:'center',gap:7}}>
          <span style={{fontSize:9,fontWeight:800,color:'#67e8f9',letterSpacing:'.14em'}}>⚡ INTEL CLICK</span>
          <span style={{fontSize:8,color:'#38bdf8',background:'rgba(56,189,248,.10)',border:'1px solid rgba(56,189,248,.22)',borderRadius:3,padding:'1px 6px',letterSpacing:'.07em'}}>{mapLabel}</span>
        </div>
        <button onClick={onDismiss} style={{background:'transparent',border:'none',color:'#7dd3fc',cursor:'pointer',fontSize:14,lineHeight:1,padding:'0 2px',transition:'color .12s'}}
          onMouseEnter={e=>e.currentTarget.style.color='#ef4444'}
          onMouseLeave={e=>e.currentTarget.style.color='#7dd3fc'}
        >✕</button>
      </div>

      <div style={{padding:'10px 11px'}}>
        {/* What is it */}
        <div style={{marginBottom:10}}>
          <div style={{fontSize:9,fontWeight:800,color:'#38bdf8',letterSpacing:'.11em',marginBottom:5,textTransform:'uppercase'}}>¿Qué es esto?</div>
          <p style={{fontSize:10,color:'#bae6fd',lineHeight:1.55,margin:0}}>{whatIsIt}</p>
        </div>

        {/* Data */}
        {rows.length>0&&(
          <div style={{marginBottom:10}}>
            <div style={{fontSize:9,fontWeight:800,color:'#38bdf8',letterSpacing:'.11em',marginBottom:6,textTransform:'uppercase'}}>Data</div>
            <div>
              {rows.map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:4,gap:8}}>
                  <span style={{fontSize:9,color:'#7dd3fc',fontWeight:600,flexShrink:0}}>{k}</span>
                  <span style={{fontSize:10,color:'#ffffff',fontWeight:800,textAlign:'right'}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Insights */}
        {insights.length>0&&(
          <div>
            <div style={{fontSize:9,fontWeight:800,color:'#38bdf8',letterSpacing:'.11em',marginBottom:6,textTransform:'uppercase'}}>Insights</div>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              {insights.map((b,i)=>(
                <div key={i} style={{display:'flex',gap:6,alignItems:'flex-start'}}>
                  <span style={{color:'#67e8f9',fontSize:9,flexShrink:0,marginTop:2}}>▸</span>
                  <span style={{fontSize:10,color:'#e0f2fe',lineHeight:1.5}}>{b}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FeedEntry({entry,index,isMobile}){
  const p1=entry.part==='p1';
  const fs=isMobile?9:11;
  return(
    <div className="osiris-fadein" style={{
      marginBottom:7,borderLeft:`2px solid ${p1?'rgba(103,232,249,.8)':'rgba(56,189,248,.45)'}`,
      paddingLeft:8,animationDelay:`${index*25}ms`,
    }}>
      <div style={{fontSize:fs,color:p1?'#67e8f9':'#38bdf8',fontWeight:800,marginBottom:2,textShadow:p1?'0 0 8px #67e8f960':'none'}}>
        [{entry.time}] {entry.divCode} · {entry.crmCode}
      </div>
      <div style={{fontSize:fs-1,color:'#bae6fd',lineHeight:1.5,letterSpacing:'.02em'}}>
        DIV:{entry.area} | CRM:{entry.desc} | AGE:{entry.age}
      </div>
      <div style={{fontSize:fs-1,color:'#93c5fd',marginTop:2}}>
        STATUS: <span style={{color:entry.status==='CLR'?'#34d399':'#f87171',fontWeight:800}}>{entry.status}</span>
      </div>
    </div>
  );
}

function PanelSection({icon:Icon,title,color=C.accent,children}){
  return(
    <div style={{marginBottom:14}}>
      <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:9,paddingBottom:6,borderBottom:'1px solid rgba(56,189,248,.12)'}}>
        <Icon size={12} color={color}/>
        <span style={{fontSize:11,fontWeight:800,color:'#fff',letterSpacing:'.12em',textTransform:'uppercase',textShadow:`0 0 10px ${color}70`}}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function TactSelect({label,value,options,onChange}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <span style={{fontSize:10,color:'#7dd3fc',fontWeight:700,letterSpacing:'.1em',whiteSpace:'nowrap'}}>{label}</span>
      <select value={value??''} onChange={e=>onChange(e.target.value||null)} style={{
        background:'rgba(1,13,31,.9)',border:'1px solid rgba(56,189,248,.35)',borderRadius:4,
        color:'#fff',fontSize:10,fontFamily:'monospace',padding:'3px 20px 3px 7px',
        cursor:'pointer',outline:'none',WebkitAppearance:'none',appearance:'none',
        backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%230c2461'/%3E%3C/svg%3E")`,
        backgroundRepeat:'no-repeat',backgroundPosition:'right 5px center',
      }}>
        {options.map(o=><option key={o.value??'null'} value={o.value??''}>{o.label}</option>)}
      </select>
    </div>
  );
}

function TactBtn({map:m,active,onClick}){
  const isActive=active===m.id;
  return(
    <button onClick={onClick} style={{
      display:'flex',alignItems:'center',gap:5,padding:'5px 14px',borderRadius:6,flexShrink:0,cursor:'pointer',
      fontFamily:'monospace',fontSize:10,fontWeight:isActive?800:500,letterSpacing:'.07em',whiteSpace:'nowrap',
      border:`1px solid ${isActive?'rgba(0,255,90,.65)':'rgba(0,255,90,.22)'}`,
      background:isActive?'rgba(0,255,90,.10)':'transparent',
      color:isActive?'#00ff80':'rgba(0,255,90,.5)',
      boxShadow:isActive?'0 0 20px rgba(0,255,90,.35),0 0 0 1px rgba(0,255,90,.1)':'none',
      transition:'all .12s',
    }}
      onMouseEnter={e=>{if(!isActive){e.currentTarget.style.color='rgba(0,255,90,.85)';e.currentTarget.style.borderColor='rgba(0,255,90,.4)';}}}
      onMouseLeave={e=>{if(!isActive){e.currentTarget.style.color='rgba(0,255,90,.5)';e.currentTarget.style.borderColor='rgba(0,255,90,.22)';}}}
    >
      <span style={{fontSize:13}}>{m.icon}</span>
      {m.short}
    </button>
  );
}

function MapBtn({map:m,active,onClick}){
  const isActive=active===m.id;
  const isOsint=OSINT_IDS.has(m.id);
  return(
    <button onClick={onClick} style={{
      display:'flex',alignItems:'center',gap:5,padding:'5px 11px',borderRadius:6,flexShrink:0,cursor:'pointer',
      fontFamily:'monospace',fontSize:10,fontWeight:isActive?700:500,letterSpacing:'.05em',whiteSpace:'nowrap',
      border:`1px solid ${isActive?(isOsint?'rgba(103,232,249,.65)':'rgba(147,197,253,.5)'):'rgba(56,189,248,.18)'}`,
      background:isActive?(isOsint?'rgba(103,232,249,.15)':'rgba(147,197,253,.12)'):'transparent',
      color:isActive?'#fff':'#7dd3fc',
      boxShadow:isActive?`0 0 14px ${isOsint?'rgba(103,232,249,.35)':'rgba(147,197,253,.2)'}`:'none',
      transition:'all .12s',
    }}
      onMouseEnter={e=>{if(!isActive){e.currentTarget.style.color='#bae6fd';e.currentTarget.style.borderColor='rgba(56,189,248,.35)';}}}
      onMouseLeave={e=>{if(!isActive){e.currentTarget.style.color='#7dd3fc';e.currentTarget.style.borderColor='rgba(56,189,248,.18)';}}}
    >
      <span style={{fontSize:12}}>{m.icon}</span>
      {m.short}
    </button>
  );
}

// ── Slider step button ─────────────────────────────────────────────────────
const SBTN={
  padding:'3px 8px',borderRadius:4,border:'1px solid rgba(56,189,248,.25)',
  background:'rgba(1,13,31,.7)',color:'#38bdf8',cursor:'pointer',
  fontSize:10,fontFamily:'monospace',lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center',
};

// ── Main ──────────────────────────────────────────────────────────────────
export default function OsintPage(){
  const [data,       setData]       = useState(null);
  const [activeMap,  setActiveMap]  = useState('choropleth');
  const [filterYear, setFilterYear] = useState(null);
  const [filterArea, setFilterArea] = useState(null);
  const [filterPart, setFilterPart] = useState('all');
  const [leftOpen,   setLeftOpen]   = useState(true);
  const [rightOpen,  setRightOpen]  = useState(true);
  const [feedLog,    setFeedLog]    = useState([]);
  const [simHour,    setSimHour]    = useState(12);
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [isMobile,   setIsMobile]   = useState(false);
  const [clickInfo,  setClickInfo]  = useState(null);

  const iframeRef = useRef(null);
  const seedRef   = useRef(Math.floor(Math.random()*50000));

  // ── Mobile detection — collapse panels on small screens
  useEffect(()=>{
    const check=()=>{
      const mobile=window.innerWidth<768;
      setIsMobile(mobile);
      if(mobile){ setLeftOpen(false); setRightOpen(false); }
    };
    check();
    window.addEventListener('resize',check);
    return()=>window.removeEventListener('resize',check);
  },[]);

  // ── Block body scroll
  useEffect(()=>{
    document.body.style.overflow='hidden';
    document.documentElement.style.overflow='hidden';
    return()=>{document.body.style.overflow='';document.documentElement.style.overflow='';};
  },[]);

  // ── Load data
  useEffect(()=>{
    const b='/data';
    Promise.all([
      fetch(`${b}/summary.json`).then(r=>r.json()),
      fetch(`${b}/division.json`).then(r=>r.json()),
      fetch(`${b}/categories.json`).then(r=>r.json()),
      fetch(`${b}/victims.json`).then(r=>r.json()),
      fetch(`${b}/hourly_dow.json`).then(r=>r.json()),
    ]).then(([summary,division,categories,victims,hourly])=>{
      setData({summary,division,categories,victims,hourly});
    }).catch(console.error);
  },[]);

  // ── Auto-play: advance simHour every 1.5s
  useEffect(()=>{
    if(!isPlaying) return;
    const t=setInterval(()=>setSimHour(h=>(h+1)%24),1500);
    return()=>clearInterval(t);
  },[isPlaying]);

  // ── Regenerate feed instantly when simHour, data, or filterPart changes
  useEffect(()=>{
    if(!data) return;
    const entries=[];
    for(let i=0;i<12;i++){
      const seed=simHour*1117+i*89+3333;
      const e=makeFeedEntry(seed,data.division,data.categories,filterPart,simHour);
      if(e) entries.push(e);
    }
    setFeedLog(entries);
  },[simHour,data,filterPart]);

  // ── Ticker — appends a new entry every 2.8s (paused during auto-play)
  useEffect(()=>{
    if(!data||isPlaying) return;
    const t=setInterval(()=>{
      seedRef.current+=1;
      const e=makeFeedEntry(seedRef.current,data.division,data.categories,filterPart,simHour);
      if(e) setFeedLog(p=>[e,...p].slice(0,15));
    },2800);
    return()=>clearInterval(t);
  },[data,filterPart,simHour,isPlaying]);

  // ── Sync filters to OSINT iframes (tactical handled via React props)
  useEffect(()=>{
    if(OSINT_IDS.has(activeMap)){
      iframeRef.current?.contentWindow?.postMessage(
        {type:'OSINT_FILTER',year:filterYear,area:filterArea,part:filterPart},'*'
      );
    }
    if(activeMap==='edu-safety'){
      iframeRef.current?.contentWindow?.postMessage(
        {type:'EDU_DIVISION',division:filterArea?filterArea.toUpperCase():''},'*'
      );
    }
    if(activeMap==='jurisdicciones'){
      iframeRef.current?.contentWindow?.postMessage(
        {type:'JURISD_DIVISION',division:filterArea?filterArea.toUpperCase():''},'*'
      );
    }
  },[filterYear,filterArea,filterPart,activeMap]);

  // ── Receive postMessage events from all map iframes
  useEffect(()=>{
    const h=(e)=>{
      if(!e.data) return;
      if(e.data.type==='OSINT_CLICK_INFO'){
        setClickInfo(e.data);
        setRightOpen(true);
      }
      if(e.data.type==='OSINT_AREA_CLICK'){
        if(!data) return;
        const match=data.division.find(d=>d.name.toUpperCase()===e.data.area.toUpperCase());
        setFilterArea(prev=>(match&&prev!==match.name)?match.name:null);
      }
    };
    window.addEventListener('message',h);
    return()=>window.removeEventListener('message',h);
  },[data]);

  // ── Map switch
  const switchMap=(id)=>{
    const isNewOsint=OSINT_IDS.has(id);
    const isCurrOsint=OSINT_IDS.has(activeMap);
    setActiveMap(id);
    if(isNewOsint&&isCurrOsint){
      iframeRef.current?.contentWindow?.postMessage({type:'OSINT_SET_LAYER',layer:id},'*');
    }
  };

  const iframeSrc=useMemo(()=>{
    return MAPS.find(m=>m.id===activeMap)?.src??'/osint-map.html?layer=choropleth';
  },[activeMap]);

  const handleIframeLoad=()=>{
    if(OSINT_IDS.has(activeMap)){
      iframeRef.current?.contentWindow?.postMessage(
        {type:'OSINT_FILTER',year:filterYear,area:filterArea,part:filterPart},'*'
      );
    }
    if(activeMap==='edu-safety'){
      iframeRef.current?.contentWindow?.postMessage(
        {type:'EDU_DIVISION',division:filterArea?filterArea.toUpperCase():''},'*'
      );
    }
    if(activeMap==='jurisdicciones'){
      iframeRef.current?.contentWindow?.postMessage(
        {type:'JURISD_DIVISION',division:filterArea?filterArea.toUpperCase():''},'*'
      );
    }
  };

  // ── HUD Master Toggle
  const anyOpen=leftOpen||rightOpen;
  const toggleHUD=()=>{
    if(anyOpen){ setLeftOpen(false); setRightOpen(false); }
    else       { setLeftOpen(true);  setRightOpen(true);  }
  };

  // ── KPIs
  const kpi=useMemo(()=>{
    if(!data) return{total:'…',clr:'…',topCat:'VEHICLE CRIME'};
    const s=data.summary;
    let total=s.total_crimes, clr=s.clearance_rate;
    if(filterYear){const yr=s.by_year.find(y=>y.year===filterYear);if(yr){total=yr.crimes;clr=yr.clearance_rate;}}
    if(filterArea){
      const div=data.division.find(d=>d.name===filterArea);
      if(div){
        const key=filterPart==='p1'?'crimes_p1':filterPart==='p2'?'crimes_p2':'crimes';
        total=div[key]??div.crimes;
        clr=filterPart==='p1'?div.clearance_rate_p1:filterPart==='p2'?div.clearance_rate_p2:div.clearance_rate;
      }
    }
    if(!filterArea&&filterPart!=='all'){total=filterPart==='p1'?s.crimes_p1:s.crimes_p2;}
    const cats=filterPart==='all'?data.categories:data.categories.filter(c=>c.part===filterPart);
    const topCat=cats[0]?.category?.split('–').pop()?.trim().toUpperCase()??'VEHICLE CRIME';
    return{total,clr:parseFloat(clr).toFixed(1),topCat};
  },[data,filterYear,filterArea,filterPart]);

  const hourlyTotals=useMemo(()=>{
    if(!data) return null;
    const arr=new Array(24).fill(0);
    data.hourly.forEach(r=>{arr[r.hour]+=r.crimes;});
    return arr;
  },[data]);

  const topCats=useMemo(()=>{
    if(!data) return[];
    const src=filterPart==='all'?data.categories:data.categories.filter(c=>c.part===filterPart);
    return src.slice(0,5);
  },[data,filterPart]);

  const divOptions=useMemo(()=>{
    if(!data) return[{value:null,label:'ALL AREAS'}];
    return[{value:null,label:'ALL AREAS'},...data.division.map(d=>({value:d.name,label:d.name.toUpperCase()}))];
  },[data]);

  // ── Layout
  const HEADER_H  = 58;
  const MAPBAR_H  = 44;
  const TOTAL_TOP = HEADER_H+MAPBAR_H+8;

  const PANEL={
    position:'absolute',top:TOTAL_TOP,bottom:12,width:isMobile?'calc(100vw - 24px)':286,
    background:C.glass,backdropFilter:'blur(18px)',
    border:`1px solid ${C.border}`,borderRadius:10,zIndex:10,
    display:'flex',flexDirection:'column',
    boxShadow:'0 0 40px rgba(0,0,0,.6),0 0 60px rgba(14,165,233,.03)',
    transition:'transform .28s cubic-bezier(.4,0,.2,1)',overflow:'hidden',
  };

  const CBTN={
    position:'absolute',top:16,zIndex:11,width:20,height:38,borderRadius:5,
    background:'rgba(1,10,26,.9)',border:`1px solid ${C.border}`,
    color:C.dim,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
    transition:'all .2s',backdropFilter:'blur(8px)',
  };

  const sliderPct=((simHour/23)*100).toFixed(1);

  return(
    <div style={{position:'fixed',inset:0,overflow:'hidden',background:C.bg,fontFamily:"'JetBrains Mono','Courier New',monospace",color:C.text}}>

      {/* MAP DISPLAY — React component for tactical, iframe for all others */}
      {activeMap === 'tactical' ? (
        <LaMapGoogle
          simHour={simHour}
          filterYear={filterYear}
          filterArea={filterArea}
          filterPart={filterPart}
          data={data}
          onClickInfo={(info) => {
            setClickInfo({ type:'OSINT_CLICK_INFO', mapId:'tactical', ...info });
            setRightOpen(true);
          }}
        />
      ) : (
        <iframe
          ref={iframeRef}
          key={iframeSrc}
          src={iframeSrc}
          title="OSINT Map"
          style={{position:'absolute',inset:0,width:'100%',height:'100%',border:'none'}}
          onLoad={handleIframeLoad}
        />
      )}

      {/* ── HEADER ROW 1 ─────────────────────────────────────────────── */}
      <header style={{
        position:'absolute',top:0,left:0,right:0,height:HEADER_H,zIndex:20,
        background:'rgba(1,8,22,.90)',backdropFilter:'blur(20px)',
        borderBottom:`1px solid ${C.border}`,
        display:'flex',alignItems:'center',
        boxShadow:'0 4px 40px rgba(0,0,0,.7)',
      }}>

        {/* Back to dashboard */}
        <Link href="/" style={{
          display:'flex',alignItems:'center',gap:5,
          padding:'0 14px',borderRight:`1px solid ${C.border}`,
          textDecoration:'none',color:'#7dd3fc',flexShrink:0,height:'100%',
          transition:'color .15s',
        }}
          onMouseEnter={e=>{e.currentTarget.style.color='#67e8f9';e.currentTarget.style.background='rgba(103,232,249,.05)';}}
          onMouseLeave={e=>{e.currentTarget.style.color='#7dd3fc';e.currentTarget.style.background='transparent';}}
        >
          <ArrowLeft size={14}/>
          {!isMobile&&<span style={{fontSize:9,fontWeight:700,letterSpacing:'.12em'}}>INICIO</span>}
        </Link>

        {/* Logo */}
        <div style={{padding:'0 14px',borderRight:`1px solid ${C.border}`,flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{
              width:30,height:30,borderRadius:7,flexShrink:0,
              background:'linear-gradient(135deg,#1d4ed8,#0ea5e9)',
              display:'flex',alignItems:'center',justifyContent:'center',
              boxShadow:'0 0 18px rgba(14,165,233,.35)',
            }}>
              <Target size={15} color="#fff"/>
            </div>
            {!isMobile&&(
              <div>
                <div className="osiris-glow" style={{fontSize:15,fontWeight:900,color:'#67e8f9',letterSpacing:'.15em',lineHeight:1}}>
                  OSINT
                </div>
                <div style={{fontSize:9,color:'#7dd3fc',letterSpacing:'.12em',marginTop:2,fontWeight:600}}>
                  CRIME MONITOR // LAPD
                </div>
              </div>
            )}
          </div>
        </div>

        {/* KPIs — hide on tiny screens */}
        {!isMobile&&(
          <div style={{display:'flex',alignItems:'center',flex:1,paddingLeft:6,overflow:'hidden'}}>
            <KpiBlock label="Total Incidents" value={fmt(kpi.total)} sub="2020–2024" color={C.accent}/>
            <KpiBlock label="Clearance Rate"  value={`${kpi.clr}%`} sub="resueltos"  color={C.accent3}/>
            <div style={{padding:'0 14px',borderLeft:'1px solid rgba(220,38,38,.15)',flexShrink:0}}>
              <div style={{fontSize:10,color:'#7dd3fc',letterSpacing:'.12em',fontWeight:700,marginBottom:4,textTransform:'uppercase'}}>Alert</div>
              <AlertBadge label={kpi.topCat}/>
            </div>
          </div>
        )}

        {/* Spacer on mobile */}
        {isMobile&&<div style={{flex:1}}/>}

        {/* Filters */}
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'0 12px',borderLeft:`1px solid ${C.border}`,flexShrink:0,flexWrap:'nowrap'}}>
          <Filter size={10} color={C.dim}/>
          {!isMobile&&(
            <>
              <TactSelect label="AÑO" value={filterYear}
                options={YEARS.map(y=>({value:y,label:y?String(y):'ALL'}))}
                onChange={v=>setFilterYear(v?parseInt(v):null)}
              />
              <TactSelect label="ÁREA" value={filterArea} options={divOptions} onChange={setFilterArea}/>
            </>
          )}
          <div style={{display:'flex',gap:2}}>
            {[['all','ALL'],['p1','P1'],['p2','P2']].map(([v,l])=>(
              <button key={v} onClick={()=>setFilterPart(v)} style={{
                padding:'3px 8px',borderRadius:5,fontSize:10,fontWeight:filterPart===v?800:500,
                border:`1px solid ${filterPart===v?'rgba(103,232,249,.6)':'rgba(56,189,248,.2)'}`,
                background:filterPart===v?'rgba(103,232,249,.15)':'transparent',
                color:filterPart===v?'#fff':'#7dd3fc',cursor:'pointer',fontFamily:'monospace',
                transition:'all .12s',textShadow:filterPart===v?'0 0 8px #67e8f9':'none',
              }}>{l}</button>
            ))}
          </div>
          {(filterYear||filterArea||filterPart!=='all')&&(
            <button onClick={()=>{setFilterYear(null);setFilterArea(null);setFilterPart('all');}} style={{
              fontSize:9,color:'#ef4444',background:'rgba(239,68,68,.07)',
              border:'1px solid rgba(239,68,68,.2)',borderRadius:4,padding:'2px 7px',
              cursor:'pointer',fontFamily:'monospace',
            }}>CLR ✕</button>
          )}
        </div>

        {/* Live badge */}
        <div style={{padding:'0 12px',borderLeft:`1px solid ${C.border}`,flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:5}}>
            <span className="osiris-pulse" style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:'#34d399'}}/>
            <span style={{fontSize:10,color:'#34d399',letterSpacing:'.12em',fontWeight:800}}>LIVE</span>
          </div>
          {!isMobile&&<div style={{fontSize:9,color:'#7dd3fc',marginTop:2,fontWeight:600}}>{new Date().toISOString().slice(0,10)}</div>}
        </div>
      </header>

      {/* ── HEADER ROW 2 — MAP SELECTOR ──────────────────────────────── */}
      <div style={{
        position:'absolute',top:HEADER_H,left:0,right:0,height:MAPBAR_H,zIndex:20,
        background:'rgba(1,6,18,.92)',backdropFilter:'blur(16px)',
        borderBottom:`1px solid ${C.border}`,
        display:'flex',alignItems:'center',padding:'0 12px',gap:4,
        overflowX:'auto',scrollbarWidth:'none',
        boxShadow:'0 2px 20px rgba(0,0,0,.5)',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0,marginRight:4}}>
          <Layers size={10} color='#38bdf8'/>
          <span style={{fontSize:10,color:'#38bdf8',fontWeight:800,letterSpacing:'.12em'}}>OSINT</span>
        </div>
        {MAPS.filter(m=>m.group==='osint').map(m=>(
          <MapBtn key={m.id} map={m} active={activeMap} onClick={()=>switchMap(m.id)}/>
        ))}
        <div style={{width:1,height:24,background:'rgba(29,78,216,.25)',margin:'0 8px',flexShrink:0}}/>
        <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0,marginRight:4}}>
          <span style={{fontSize:10,color:'#93c5fd',fontWeight:800,letterSpacing:'.12em'}}>LAPD</span>
        </div>
        {MAPS.filter(m=>m.group==='lapd').map(m=>(
          <MapBtn key={m.id} map={m} active={activeMap} onClick={()=>switchMap(m.id)}/>
        ))}
        <div style={{width:1,height:24,background:'rgba(0,255,90,.15)',margin:'0 8px',flexShrink:0}}/>
        <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0,marginRight:4}}>
          <span style={{fontSize:10,color:'rgba(0,255,90,.7)',fontWeight:800,letterSpacing:'.12em'}}>TACT</span>
        </div>
        {MAPS.filter(m=>m.group==='tactical').map(m=>(
          <TactBtn key={m.id} map={m} active={activeMap} onClick={()=>switchMap(m.id)}/>
        ))}
      </div>

      {/* ── LEFT PANEL ────────────────────────────────────────────────── */}
      <div style={{...PANEL,left:12,transform:leftOpen?'translateX(0)':'translateX(-300px)'}}>
        <div className="osiris-scroll" style={{flex:1,overflow:'auto',padding:'12px 12px 8px'}}>

          <PanelSection icon={Activity} title="Hourly Activity" color={C.accent}>
            <HourlyBars hourlyTotals={hourlyTotals} activeHour={simHour}/>

            {/* ── TIME SLIDER ─── */}
            <div style={{marginTop:10}}>
              {/* Hour label + play controls */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <span style={{fontSize:12,color:'#67e8f9',fontWeight:800,letterSpacing:'.05em'}}>
                  ◷ {String(simHour).padStart(2,'0')}:00 hs
                </span>
                <div style={{display:'flex',gap:4,alignItems:'center'}}>
                  <button style={SBTN} onClick={()=>setSimHour(h=>(h-1+24)%24)}>◂</button>
                  <button
                    onClick={()=>setIsPlaying(p=>!p)}
                    style={{...SBTN,
                      color:isPlaying?'#67e8f9':'#38bdf8',
                      borderColor:isPlaying?'rgba(103,232,249,.5)':'rgba(56,189,248,.25)',
                      background:isPlaying?'rgba(103,232,249,.1)':'rgba(1,13,31,.7)',
                      boxShadow:isPlaying?'0 0 10px rgba(103,232,249,.25)':'none',
                    }}
                  >
                    {isPlaying?<Pause size={10}/>:<Play size={10}/>}
                  </button>
                  <button style={SBTN} onClick={()=>setSimHour(h=>(h+1)%24)}>▸</button>
                </div>
              </div>

              {/* Range slider */}
              <div style={{position:'relative'}}>
                <input
                  type="range"
                  min={0} max={23}
                  value={simHour}
                  onChange={e=>{setIsPlaying(false);setSimHour(parseInt(e.target.value));}}
                  className="osint-slider"
                  style={{width:'100%'}}
                />
              </div>

              {/* Tick marks */}
              <div style={{display:'flex',justifyContent:'space-between',marginTop:3}}>
                {['00h','06h','12h','18h','23h'].map(t=>(
                  <span key={t} style={{fontSize:8,color:'#3b82f6'}}>{t}</span>
                ))}
              </div>

              {/* Activity at current hour */}
              {hourlyTotals&&(
                <div style={{marginTop:6,padding:'4px 8px',borderRadius:4,background:'rgba(56,189,248,.06)',border:'1px solid rgba(56,189,248,.15)'}}>
                  <span style={{fontSize:9,color:'#bae6fd'}}>
                    Incidentes a las {String(simHour).padStart(2,'0')}h:{' '}
                    <strong style={{color:'#67e8f9'}}>{hourlyTotals[simHour].toLocaleString()}</strong>
                    {' '}({((hourlyTotals[simHour]/hourlyTotals.reduce((a,b)=>a+b,0))*100).toFixed(1)}%)
                  </span>
                </div>
              )}
            </div>
          </PanelSection>

          <PanelSection icon={Shield} title="Top Threats" color={C.accent2}>
            {topCats.length>0?topCats.map((c,i)=>(
              <ProgBar key={c.category} label={c.category} value={c.crimes} max={topCats[0].crimes}
                color={i===0?'#38bdf8':i<3?C.accent:C.accent3}/>
            )):<div style={{height:70,display:'flex',alignItems:'center',justifyContent:'center',color:C.dim,fontSize:10}}>LOADING…</div>}
          </PanelSection>

          <PanelSection icon={TrendingUp} title="Correlación Comercial" color="#00bfff">
            <BizCrimeCorrelation simHour={simHour}/>
          </PanelSection>

          {(filterYear||filterArea)&&(
            <div style={{padding:'8px 10px',borderRadius:5,background:'rgba(56,189,248,.08)',border:'1px solid rgba(56,189,248,.3)'}}>
              <div style={{fontSize:10,color:'#67e8f9',letterSpacing:'.1em',marginBottom:4,fontWeight:700}}>ACTIVE FILTER</div>
              {filterYear&&<div style={{fontSize:11,color:'#fff',fontWeight:800}}>AÑO: {filterYear}</div>}
              {filterArea&&<div style={{fontSize:11,color:'#bae6fd',fontWeight:800}}>DIV: {filterArea.toUpperCase()}</div>}
            </div>
          )}
        </div>
        <div style={{padding:'7px 12px',borderTop:'1px solid rgba(56,189,248,.08)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontSize:9,color:'#60a5fa',letterSpacing:'.08em',fontWeight:600}}>SRC: LAPD OPEN DATA 2020-2024</span>
          <Eye size={10} color='#38bdf8'/>
        </div>
      </div>

      {/* Left collapse toggle */}
      <button
        onClick={()=>setLeftOpen(o=>!o)}
        style={{...CBTN,left:leftOpen?300:14,top:TOTAL_TOP+10,transition:'left .28s cubic-bezier(.4,0,.2,1),all .2s'}}
        onMouseEnter={e=>{e.currentTarget.style.color=C.accent2;e.currentTarget.style.borderColor=`${C.accent}50`;}}
        onMouseLeave={e=>{e.currentTarget.style.color=C.dim;e.currentTarget.style.borderColor=C.border;}}
      >
        {leftOpen?<ChevronLeft size={11}/>:<ChevronRight size={11}/>}
      </button>

      {/* ── RIGHT PANEL ───────────────────────────────────────────────── */}
      <div style={{...PANEL,right:12,transform:rightOpen?'translateX(0)':'translateX(300px)'}}>
        <div className="osiris-scroll" style={{flex:1,overflow:'auto',padding:'12px 12px 8px'}}>

          {clickInfo&&<ClickIntelPanel info={clickInfo} data={data} onDismiss={()=>setClickInfo(null)}/>}

          <PanelSection icon={Users} title="Victim Demographics" color={C.accent3}>
            {data?(
              <>
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:10,color:'#67e8f9',letterSpacing:'.1em',marginBottom:6,fontWeight:800}}>BY SEX</div>
                  <DemoBars items={data.victims.by_sex.filter(s=>s.sex!=='Unknown')} valueKey="crimes" labelKey="sex"/>
                </div>
                <div>
                  <div style={{fontSize:10,color:'#67e8f9',letterSpacing:'.1em',marginBottom:6,fontWeight:800}}>BY ETHNICITY</div>
                  <DemoBars items={data.victims.by_descent.slice(0,5)} valueKey="crimes" labelKey="descent"/>
                </div>
                <div style={{marginTop:8,padding:'5px 8px',borderRadius:4,background:'rgba(56,189,248,.05)',border:'1px solid rgba(56,189,248,.08)'}}>
                  <span style={{fontSize:9,color:'#7dd3fc'}}>NOTE: Vict Age=0 excluido · {data.victims.no_victim_pct}% sin víctima</span>
                </div>
              </>
            ):<div style={{height:80,display:'flex',alignItems:'center',justifyContent:'center',color:C.dim,fontSize:10}}>LOADING…</div>}
          </PanelSection>

          {/* Feed — title shows current simHour */}
          <PanelSection icon={Radio} title={`RADIO LOG · ${String(simHour).padStart(2,'0')}:00`} color={C.accent}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <span style={{fontSize:9,color:'#7dd3fc',fontWeight:600}}>SIM · HISTORICAL PATTERNS</span>
              <div style={{display:'flex',alignItems:'center',gap:4}}>
                {isPlaying
                  ? <><span className="osiris-blink" style={{display:'inline-block',width:6,height:6,borderRadius:'50%',background:'#67e8f9'}}/>
                      <span style={{fontSize:9,color:'#67e8f9',letterSpacing:'.1em',fontWeight:800}}>PLAY</span></>
                  : <><span className="osiris-blink" style={{display:'inline-block',width:6,height:6,borderRadius:'50%',background:'#38bdf8'}}/>
                      <span style={{fontSize:9,color:'#38bdf8',letterSpacing:'.1em',fontWeight:800}}>LIVE</span></>
                }
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column'}}>
              {feedLog.map((entry,i)=><FeedEntry key={entry.id} entry={entry} index={i} isMobile={isMobile}/>)}
            </div>
          </PanelSection>
        </div>
        <div style={{padding:'7px 12px',borderTop:'1px solid rgba(56,189,248,.08)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontSize:9,color:'#60a5fa',letterSpacing:'.08em',fontWeight:600}}>OSINT v1.0 // LAPD CRIME INTEL</span>
          <Zap size={10} color='#38bdf8'/>
        </div>
      </div>

      {/* Right collapse toggle */}
      <button
        onClick={()=>setRightOpen(o=>!o)}
        style={{...CBTN,right:rightOpen?300:14,top:TOTAL_TOP+10,transition:'right .28s cubic-bezier(.4,0,.2,1),all .2s'}}
        onMouseEnter={e=>{e.currentTarget.style.color=C.accent2;e.currentTarget.style.borderColor=`${C.accent}50`;}}
        onMouseLeave={e=>{e.currentTarget.style.color=C.dim;e.currentTarget.style.borderColor=C.border;}}
      >
        {rightOpen?<ChevronRight size={11}/>:<ChevronLeft size={11}/>}
      </button>

      {/* ── HUD MASTER TOGGLE (Cinema Mode) ──────────────────────────── */}
      <button
        onClick={toggleHUD}
        title={anyOpen?'Modo Cine — Ocultar HUD':'Mostrar HUD'}
        style={{
          position:'absolute',bottom:20,left:'50%',transform:'translateX(-50%)',
          zIndex:20,padding:'7px 18px',
          background:'rgba(1,8,22,.88)',border:`1px solid ${anyOpen?'rgba(56,189,248,.35)':'rgba(103,232,249,.5)'}`,
          borderRadius:24,backdropFilter:'blur(14px)',
          display:'flex',alignItems:'center',gap:7,
          cursor:'pointer',
          color:anyOpen?'#7dd3fc':'#67e8f9',
          fontSize:10,fontFamily:'monospace',fontWeight:700,letterSpacing:'.12em',
          transition:'all .2s',
          boxShadow:anyOpen?'0 4px 20px rgba(0,0,0,.5)':'0 4px 24px rgba(103,232,249,.2),0 0 0 1px rgba(103,232,249,.15)',
        }}
        onMouseEnter={e=>{e.currentTarget.style.background='rgba(14,30,60,.92)';e.currentTarget.style.color='#fff';}}
        onMouseLeave={e=>{e.currentTarget.style.background='rgba(1,8,22,.88)';e.currentTarget.style.color=anyOpen?'#7dd3fc':'#67e8f9';}}
      >
        {anyOpen?<EyeOff size={13}/>:<Eye size={13}/>}
        {anyOpen?'HIDE HUD':'SHOW HUD'}
      </button>

      {/* Bottom coords */}
      <div style={{
        position:'absolute',bottom:12,left:leftOpen&&!isMobile?300:28,
        fontSize:8,color:C.dimmer,letterSpacing:'.1em',fontFamily:'monospace',
        transition:'left .28s',zIndex:5,pointerEvents:'none',
      }}>34.0522°N · 118.2437°W · LA BASIN</div>

      {/* Bottom-right filter badges */}
      <div style={{position:'absolute',bottom:12,right:rightOpen&&!isMobile?300:28,display:'flex',gap:4,zIndex:5,transition:'right .28s',pointerEvents:'none'}}>
        {filterYear&&<span style={{fontSize:8,color:`${C.accent}80`,background:'rgba(14,165,233,.07)',border:`1px solid ${C.border}`,borderRadius:4,padding:'2px 6px',fontWeight:700}}>Y:{filterYear}</span>}
        {filterArea&&<span style={{fontSize:8,color:`${C.accent2}80`,background:'rgba(56,189,248,.05)',border:`1px solid ${C.border}`,borderRadius:4,padding:'2px 6px',fontWeight:700}}>{filterArea.toUpperCase()}</span>}
        {filterPart!=='all'&&<span style={{fontSize:8,color:`${C.accent3}80`,background:'rgba(96,165,250,.05)',border:`1px solid ${C.border}`,borderRadius:4,padding:'2px 6px',fontWeight:700}}>{filterPart.toUpperCase()}</span>}
        <span style={{fontSize:8,color:'rgba(103,232,249,.6)',background:'rgba(103,232,249,.05)',border:'1px solid rgba(103,232,249,.15)',borderRadius:4,padding:'2px 6px',fontWeight:700}}>
          ◷ {String(simHour).padStart(2,'0')}:00
        </span>
      </div>
    </div>
  );
}
