'use client';

import { useState, useMemo, useEffect } from 'react';
import Shell from '@/components/Shell';
import { Search, BookOpen, Clock, Users, AlertTriangle, Building2 } from 'lucide-react';

// ── Palette ──────────────────────────────────────────────────────────────────
const CATS = [
  { id: 'all',          label: 'All Terms',              color: '#7b82a0',  bg: 'rgba(123,130,160,.1)' },
  { id: 'temporal',     label: 'Temporal Metrics',       color: '#00f3ff',  bg: 'rgba(0,243,255,.08)'  },
  { id: 'demographic',  label: 'Demographic Variables',  color: '#d946ef',  bg: 'rgba(217,70,239,.08)' },
  { id: 'crime-code',   label: 'Crime Codes',            color: '#fbbf24',  bg: 'rgba(251,191,36,.08)' },
  { id: 'lapd-concept', label: 'LAPD Concepts',          color: '#4f8ef7',  bg: 'rgba(79,142,247,.08)' },
];

const CAT_MAP = Object.fromEntries(CATS.map(c => [c.id, c]));

// ── Glossary dataset ─────────────────────────────────────────────────────────
const TERMS = [
  // ── Métricas Temporales ──────────────────────────────────────────────────
  {
    id: 'reporting-lag',
    term: 'Reporting Lag',
    native: 'Retraso de Denuncia',
    category: 'temporal',
    field: 'date_rptd − date_occ',
    definition: 'Gap in days between when the crime occurred and when it was formally logged in the LAPD system. A key indicator of institutional trust and the operational efficiency of each station.',
    example: 'Robbery occurred Monday the 3rd, reported Friday the 7th → Lag = 4 days. If a division\'s average Reporting Lag rises from 12 to 31 days over a year, it may indicate declining community trust or report processing bottlenecks.',
  },
  {
    id: 'date-occ',
    term: 'DATE OCC',
    native: 'Fecha de Ocurrencia',
    category: 'temporal',
    field: 'date_occ',
    definition: 'The date the crime actually occurred, per the victim\'s account or physical/forensic evidence. This is the true temporal anchor of each incident. All seasonality analyses in this dashboard are computed on DATE OCC, not DATE RPTD.',
    example: 'If a car was stolen the night of March 15, DATE OCC = 2023-03-15. Using DATE RPTD instead would artificially inflate crime counts in the months when late reports are filed — distorting trend analysis.',
  },
  {
    id: 'date-rptd',
    term: 'DATE RPTD',
    native: 'Fecha de Denuncia',
    category: 'temporal',
    field: 'date_rptd',
    definition: 'The date the incident was formally reported to police and entered into the RMS (Records Management System). Always equal to or later than DATE OCC. Used for operational tracking; not suitable as the temporal axis for crime trend analysis.',
    example: 'A bank fraud occurring in January may not be reported until March when the bank notifies the victim. The resulting Reporting Lag is ~60 days — if DATE RPTD were used as the time axis, January would appear artificially quiet and March inflated.',
  },
  {
    id: 'time-occ',
    term: 'TIME OCC',
    native: 'Hora del Hecho',
    category: 'temporal',
    field: 'time_occ (HHMM)',
    definition: 'Estimated time the crime occurred, expressed in 4-digit military format (0000–2359). This is the source for the dashboard\'s hourly heatmap. Round block values (0000, 1200) typically indicate an unknown time rather than a true midnight or noon incident.',
    example: 'TIME OCC = 0230 → 2:30 AM. The 22:00–04:00 window concentrates assaults and vandalism. Commercial robberies peak 14:00–18:00 (peak foot traffic). Hour 0000 is overrepresented due to records filed without a precise time.',
  },
  // ── Variables Demográficas ────────────────────────────────────────────────
  {
    id: 'vict-age',
    term: 'VICT AGE',
    native: 'Edad de la Víctima',
    category: 'demographic',
    field: 'vict_age',
    definition: 'Age in full years of the victim at the time of the incident. May contain outliers: 0 (legal entity), negative values (data entry error), or extreme ages. Requires cleaning before demographic analysis to avoid distorting age-group statistics.',
    example: 'The modal distribution in LAPD 2020–2024 concentrates in the 25–34 age bracket. Victims recorded as under 12 automatically trigger mandatory reporting protocols to DCFS (Department of Children and Family Services).',
  },
  {
    id: 'vict-age-zero',
    term: 'VICT AGE = 0',
    native: 'Persona Jurídica / Negocio',
    category: 'demographic',
    field: 'vict_age = 0',
    definition: 'When the victim is not a physical person but a legal entity (business, institutional vehicle, bank, government agency), the system records age 0 by default. This does not represent newborns or children under 1 year old.',
    example: 'A robbery at a Hollywood pharmacy → VICT AGE = 0. Approximately 12% of the total dataset corresponds to this case. Excluding these records from demographic analysis raises the real mean age of human victims by +4.2 years.',
  },
  {
    id: 'vict-sex',
    term: 'VICT SEX',
    native: 'Sexo de la Víctima',
    category: 'demographic',
    field: 'vict_sex',
    definition: 'Recorded gender of the victim using LAPD codes: M (Male), F (Female), X (Unspecified / Non-binary / Not applicable). Historical codes H and N are now deprecated. The X code is disproportionately assigned when no individual victim is present.',
    example: 'Violent crimes (Part 1) show 64% male victims. Domestic violence incidents invert that ratio: 71% female. The X code (~3%) primarily covers cases where the victim was a business or entity (VICT AGE = 0).',
  },
  {
    id: 'vict-descent',
    term: 'VICT DESCENT',
    native: 'Etnia de la Víctima',
    category: 'demographic',
    field: 'vict_descent',
    definition: 'Single-letter code representing the self-declared or estimated ethnicity of the victim, per California Department of Justice classification. When the victim is not present, reflects the responding officer\'s observation — introducing potential classification bias.',
    example: 'H = Hispanic/Latino · W = White · B = Black · A = Asian · O = Other · X = Unknown · I = American Indian · Z = Asian Indian. Code B shows disproportionate violent crime incidence in divisions like 77th Street and Southeast.',
  },
  // ── Códigos de Crimen ─────────────────────────────────────────────────────
  {
    id: 'part-1',
    term: 'Part 1 Crimes',
    native: 'Delitos Graves (FBI)',
    category: 'crime-code',
    field: 'part_1_2 = 1',
    definition: 'FBI classification grouping the 8 most serious crimes in the UCR program: Homicide, Rape, Robbery, Aggravated Assault, Burglary, Vehicle Theft, Larceny-Theft, and Arson. These are the most closely monitored public safety indicators at the federal level.',
    example: 'If a division has 200 Part 1 and 500 Part 2 incidents, 71% of its crime is minor. A Part 1 increase without a Part 2 increase signals actual violence escalation — not just broader reporting or administrative reclassification.',
  },
  {
    id: 'part-2',
    term: 'Part 2 Crimes',
    native: 'Delitos Menores (FBI)',
    category: 'crime-code',
    field: 'part_1_2 = 2',
    definition: 'Residual UCR category covering fraud, vandalism, weapons possession, disturbances, public intoxication, prostitution, and other lower-severity offenses. Higher in frequency than Part 1 but lower individual impact.',
    example: 'A December Part 2 spike typically correlates with holiday fraud and identity theft. It does not reflect violence, but serves as a leading indicator of social fabric deterioration — particularly in commercial corridors.',
  },
  {
    id: 'crm-cd',
    term: 'CRM CD',
    native: 'Código de Crimen LAPD',
    category: 'crime-code',
    field: 'crm_cd / crm_cd_1…4',
    definition: '3-digit numeric code assigned by the LAPD to the specific crime type. The primary code (CRM CD) always represents the most serious offense in the incident. Up to 4 additional codes can be attached to a single event.',
    example: 'CRM CD 510 = Vehicle Theft · 330 = Burglary · 624 = Simple Assault · 210 = Robbery. An incident involving both robbery and assault records both: 210 as primary, 624 as secondary. Only the primary code drives Part 1/2 classification.',
  },
  {
    id: 'ucr-class',
    term: 'UCR Classification',
    native: 'Clasificación Uniforme de Delitos',
    category: 'crime-code',
    field: 'crm_cd_desc',
    definition: 'The FBI\'s Uniform Crime Reporting program, which standardizes crime classification across ~18,000 U.S. law enforcement agencies. Enables direct national and cross-jurisdictional comparisons without methodological adjustment.',
    example: 'Using UCR standards, LAPD\'s Vehicle Theft Clearance Rate (≈13%) can be directly compared to the FBI national average (≈13.8%) or NYPD (≈11.4%) — because all three agencies use identical classification rules.',
  },
  // ── Conceptos de la LAPD ─────────────────────────────────────────────────
  {
    id: 'clearance-rate',
    term: 'Clearance Rate',
    native: 'Tasa de Esclarecimiento',
    category: 'lapd-concept',
    field: 'status IN (AA, JA, JO, IC)',
    definition: 'Percentage of cases the LAPD considers "closed" via adult arrest (AA), juvenile arrest (JA/JO), or exceptional closure (suspect deceased, extradition denied, etc.). Clearance does NOT equal conviction — a case can be cleared without prosecution.',
    example: 'Clearance Rate = 15% for Vehicle Theft → only 15 of every 100 auto thefts led to any arrest. LAPD\'s overall rate dropped from 24.0% in 2020 to 12.1% in 2024 — a 50% relative collapse in investigative effectiveness.',
  },
  {
    id: 'status',
    term: 'STATUS',
    native: 'Estado Procesal del Caso',
    category: 'lapd-concept',
    field: 'status',
    definition: '2-letter code reflecting the current procedural status of the case: IC (Investigation Continuing), AA (Adult Arrested), JA (Juvenile Arrested), JO (Juvenile Other), AO (Adult Other). IC cases remain open and unsolved.',
    example: 'IC = the case is still open with no resolution → it does not count toward the Clearance Rate. A case filed as IC in 2020 and still IC in 2024 remains in the unresolved denominator — compounding the historical efficiency decline visible in trend analysis.',
  },
  {
    id: 'premis-desc',
    term: 'PREMIS DESC',
    native: 'Escenario del Hecho',
    category: 'lapd-concept',
    field: 'premis_cd / premis_desc',
    definition: 'Description of the property type or physical setting where the incident was executed. The LAPD records 80+ granular premise categories, which this dashboard consolidates into 5 macro-groups for analytical clarity.',
    example: 'Street/Sidewalk → Public space · Single Family Dwelling → Residential · Commercial/Business → Retail · Parking Lot → Parking. 72% of serious (Part 1) crimes occur in public spaces — making street-level patrol the primary prevention lever.',
  },
  {
    id: 'area-name',
    term: 'AREA NAME',
    native: 'División Policial',
    category: 'lapd-concept',
    field: 'area / area_name',
    definition: 'Name of one of the 21 LAPD police divisions that received and processed the crime report. Each division operates with tactical autonomy and has its own captain, patrol resources, and published performance statistics.',
    example: '"77th Street" covers South LA with historically the highest violence indices in the city. "West LA" concentrates property crime in premium residential zones. "Foothill" (North San Fernando Valley) has the lowest crime density per resident of any division.',
  },
  {
    id: 'weapon-used',
    term: 'WEAPON USED CD',
    native: 'Arma Utilizada',
    category: 'lapd-concept',
    field: 'weapon_used_cd',
    definition: 'Numeric code identifying the weapon or method of force used in the crime. An empty or null field indicates no weapon was used or the type was not determined. Critical for calculating the lethal violence index.',
    example: 'Code 400 = Hands/Fists (no weapon) · 101–109 = Firearms (various types) · 504 = Knife/Blade. 58% of homicides in the dataset involve firearms (200+ series), consistent with the California state average.',
  },
  // ── Additional Temporal ──────────────────────────────────────────────────
  {
    id: 'dow',
    term: 'DOW',
    native: 'Day of Week',
    category: 'temporal',
    field: 'dow (0=Mon … 6=Sun)',
    definition: 'Integer encoding of the weekday on which the crime occurred, following Python/pandas convention (0 = Monday, 6 = Sunday). Used to construct the hourly heatmap grid (168 hour×dow cells). Note: this differs from JavaScript\'s convention where 0 = Sunday.',
    example: 'DOW=4 (Friday) combined with hour 20–23 represents the peak crime window. Weekend nights (DOW 4–6, hours 22–02) account for a disproportionate share of violent crime relative to their share of total hours.',
  },
  {
    id: 'rolling3',
    term: 'Rolling 3-Month Average',
    native: '3-Month Smoothed Trend',
    category: 'temporal',
    field: 'rolling3 / rolling3_daily',
    definition: 'Moving average of crime counts over a 3-month window. Smooths out month-to-month noise from reporting lag spikes, holidays, and short-term anomalies. The daily version divides by days in the period to allow fair cross-period comparisons.',
    example: 'January 2022 raw: 21,847 crimes. Rolling 3-month (Nov–Jan): 20,914. The smoothed value reveals the underlying trend without the December dip or January catch-up effects that inflate raw monthly comparisons.',
  },
  {
    id: 'unemp-rate',
    term: 'Unemployment Rate',
    native: 'External Correlate — BLS',
    category: 'temporal',
    field: 'unemp_rate',
    definition: 'Los Angeles County monthly unemployment rate sourced from the U.S. Bureau of Labor Statistics (BLS). Included as a socioeconomic correlate for crime trends. Not used as a causal variable — correlation direction varies by crime type.',
    example: 'April 2020: unemployment spiked to 19.4% during COVID lockdowns. Property crime dipped simultaneously due to reduced foot traffic, not reduced unemployment per se — illustrating why correlation analysis requires crime-type segmentation.',
  },
  // ── Additional LAPD Concepts ─────────────────────────────────────────────
  {
    id: 'beat',
    term: 'Beat',
    native: 'Police Beat / Patrol Sector',
    category: 'lapd-concept',
    field: 'rpt_dist_no',
    definition: 'The smallest geographic unit of LAPD patrol operations. Each division is subdivided into ~6–12 reporting districts (RDs), each covering a few city blocks to several square miles. Crimes are logged to a specific RD, which maps to a beat. Granular enough to enable block-level deployment decisions.',
    example: 'Division 77th Street has 20+ reporting districts. RD 7701 covers the intersection of Florence & Normandie — historically significant as the epicenter of the 1992 civil unrest. Beat-level data can reveal crime hot-spots invisible at division level.',
  },
  {
    id: 'mo-codes',
    term: 'MO Codes',
    native: 'Modus Operandi Codes',
    category: 'lapd-concept',
    field: 'mocodes',
    definition: 'Free-form list of numeric codes describing the offender\'s method of operation — entry techniques, victim selection, tools used, behavioral patterns. Multiple MO codes can apply to a single incident. Valuable for linking serial crimes across different geographic areas.',
    example: 'MO Code 0300 = Suspect used a screwdriver as a prying tool · MO Code 1501 = Victim was elderly. If the same MO combination (e.g., 0300+1400) appears in 15 burglaries across three divisions, investigators can hypothesize a single offender or crew.',
  },
  {
    id: 'rms',
    term: 'RMS',
    native: 'Records Management System',
    category: 'lapd-concept',
    field: 'Internal LAPD system',
    definition: 'The LAPD\'s digital case management platform into which all crime reports are entered. The public dataset is a filtered export from RMS, excluding PII (personally identifiable information), ongoing investigations flagged as sensitive, and juvenile victim details per California law.',
    example: 'When an officer files a report on a vehicle theft, it enters the RMS within 24–72 hours of the incident. The public CSV dataset represents the anonymized, aggregated output — DATE RPTD reflects when the report cleared RMS review, not when the officer submitted it.',
  },
  {
    id: 'crimes-per-1000',
    term: 'Crimes per 1,000 Residents',
    native: 'Crime Rate (Population-Normalized)',
    category: 'lapd-concept',
    field: 'crimes_per_1000',
    definition: 'Total crime count divided by residential population × 1,000. The preferred metric for comparing crime intensity across neighborhoods of vastly different population sizes. Raw counts favor dense neighborhoods; rate normalizes for population exposure.',
    example: 'Downtown LA: 71,808 crimes · ~70,678 residents → 1,016 crimes per 1,000. El Sereno: 3,200 crimes · ~42,000 residents → 76 crimes per 1,000. By raw count Downtown looks 22× worse; by rate it\'s 13× — both significant, but rate is the fairer comparison for resource allocation.',
  },
  {
    id: 'vulnerability-score',
    term: 'Vulnerability Score',
    native: 'Composite Risk Index',
    category: 'lapd-concept',
    field: 'vulnerability_score / vulnerability_label',
    definition: 'A composite index combining poverty rate, crime rate, educational attainment proxies, and demographic concentration to rank neighborhood vulnerability. Computed from Census ACS data and LAPD crime counts. Labels: Low / Medium / High / Very High.',
    example: 'Skid Row (Downtown) scores Very High vulnerability: 38% poverty rate, 1,016 crimes per 1,000, limited social infrastructure. Brentwood scores Low: 4% poverty rate, 22 crimes per 1,000, dense educational/healthcare infrastructure. Vulnerability is the denominator behind crime impact — the same crime hits differently in each neighborhood.',
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function CategoryBadge({ category }) {
  const c = CAT_MAP[category] ?? CAT_MAP['all'];
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
      color: c.color, background: c.bg,
      border: `1px solid ${c.color}28`,
      borderRadius: 4, padding: '2px 7px',
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>{CATS.find(x => x.id === category)?.label ?? category}</span>
  );
}

function TermCard({ term: t, visible }) {
  const cat = CAT_MAP[t.category] ?? CAT_MAP['all'];
  return (
    <div style={{
      position: 'relative',
      background: 'rgba(30,34,48,.42)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      border: '1px solid rgba(255,255,255,.055)',
      borderRadius: 10,
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(8px)',
      transition: 'opacity .35s ease, transform .35s ease',
    }}>
      {/* Category color strip */}
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, width: 3,
        background: cat.color,
        boxShadow: `2px 0 12px ${cat.color}44`,
      }} />

      {/* Card body */}
      <div style={{ padding: '18px 18px 14px 22px', flex: 1 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#e8eaf0', margin: 0, lineHeight: 1.3 }}>{t.term}</p>
            <p style={{ fontSize: 12, color: '#5a6080', margin: '3px 0 0', fontStyle: 'italic' }}>{t.native}</p>
          </div>
          <CategoryBadge category={t.category} />
        </div>

        {/* Field pill */}
        <div style={{ marginBottom: 11 }}>
          <code style={{
            fontSize: 10, color: cat.color, background: cat.bg,
            border: `1px solid ${cat.color}22`,
            borderRadius: 4, padding: '2px 8px',
            fontFamily: '"JetBrains Mono","Fira Code","Cascadia Code",monospace',
            opacity: .9,
          }}>{t.field}</code>
        </div>

        {/* Definition */}
        <p style={{ fontSize: 12.5, color: '#8d93ab', lineHeight: 1.75, margin: 0 }}>{t.definition}</p>
      </div>

      {/* Example footer */}
      <div style={{
        padding: '12px 18px 14px 22px',
        background: 'rgba(9,11,22,.4)',
        borderTop: '1px solid rgba(255,255,255,.04)',
      }}>
        <p style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
          color: cat.color, margin: '0 0 5px',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{ display: 'inline-block', width: 3, height: 3, borderRadius: '50%', background: cat.color, boxShadow: `0 0 5px ${cat.color}` }} />
          Practical Example
        </p>
        <p style={{ fontSize: 11.5, color: '#636880', lineHeight: 1.7, margin: 0 }}>{t.example}</p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GlossaryPage() {
  const [query,      setQuery]      = useState('');
  const [activeCat,  setActiveCat]  = useState('all');
  const [mounted,    setMounted]    = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TERMS.filter(t => {
      const matchCat = activeCat === 'all' || t.category === activeCat;
      const matchQ   = !q || [t.term, t.native, t.field, t.definition, t.example]
        .some(s => s.toLowerCase().includes(q));
      return matchCat && matchQ;
    });
  }, [query, activeCat]);

  return (
    <Shell activeSection={null}>
      <div style={{
        flex: 1, padding: '40px 36px 60px',
        maxWidth: 1280, width: '100%', margin: '0 auto',
        opacity: mounted ? 1 : 0, transition: 'opacity .4s ease',
      }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 11,
              background: 'linear-gradient(135deg,#4f8ef7 0%,#d946ef 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 28px rgba(79,142,247,.22)',
              flexShrink: 0,
            }}>
              <BookOpen size={22} color="#fff" />
            </div>
            <div>
              <h1 style={{
                fontSize: 26, fontWeight: 800, margin: 0,
                background: 'linear-gradient(90deg,#e8eaf0 0%,#98b4f7 60%,#d946ef 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Terminology & Intelligence Reference
              </h1>
              <p style={{ fontSize: 13, color: '#5a6080', margin: '4px 0 0' }}>
                Dictionary of variables, metrics, and operational concepts in the LAPD dataset 2020–2024
              </p>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <span style={{
                fontSize: 11, fontWeight: 700, color: '#4f8ef7',
                background: 'rgba(79,142,247,.1)', border: '1px solid rgba(79,142,247,.2)',
                borderRadius: 6, padding: '4px 12px',
              }}>{TERMS.length} términos</span>
            </div>
          </div>
          {/* Gradient separator */}
          <div style={{
            height: 1,
            background: 'linear-gradient(90deg, #d946ef22, #4f8ef744, #00f3ff22, transparent)',
          }} />
        </div>

        {/* ── Search ──────────────────────────────────────────────────── */}
        <div style={{
          position: 'relative', marginBottom: 20, maxWidth: 540,
        }}>
          <Search size={15} style={{
            position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
            color: '#454a65', pointerEvents: 'none',
          }} />
          <input
            type="text"
            placeholder="Search term, field, definition…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '11px 14px 11px 38px',
              background: '#161923', border: '1px solid rgba(255,255,255,.07)',
              borderRadius: 8, color: '#e8eaf0', fontSize: 13,
              outline: 'none', transition: 'border-color .15s',
              fontFamily: 'inherit',
            }}
            onFocus={e  => { e.target.style.borderColor = 'rgba(79,142,247,.5)'; }}
            onBlur={e   => { e.target.style.borderColor = 'rgba(255,255,255,.07)'; }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: '#454a65', cursor: 'pointer',
                fontSize: 16, lineHeight: 1, padding: 2,
              }}
            >×</button>
          )}
        </div>

        {/* ── Category filters ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
          {CATS.map(cat => {
            const active = activeCat === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                style={{
                  padding: '7px 16px', borderRadius: 20,
                  border: active ? `1px solid ${cat.color}` : '1px solid rgba(255,255,255,.08)',
                  background: active ? cat.bg : 'transparent',
                  color: active ? cat.color : '#5a6080',
                  fontSize: 12, fontWeight: active ? 700 : 400,
                  cursor: 'pointer', transition: 'all .15s ease',
                  letterSpacing: active ? '.01em' : 0,
                  boxShadow: active ? `0 0 14px ${cat.color}18` : 'none',
                  fontFamily: 'inherit',
                }}
              >{cat.label}
                {cat.id !== 'all' && (
                  <span style={{
                    marginLeft: 7, fontSize: 10, opacity: .65,
                    background: 'rgba(255,255,255,.06)', borderRadius: 10, padding: '1px 5px',
                  }}>
                    {TERMS.filter(t => t.category === cat.id).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Results count ───────────────────────────────────────────── */}
        {(query || activeCat !== 'all') && (
          <p style={{ fontSize: 11.5, color: '#3d4255', marginBottom: 20 }}>
            {filtered.length === 0
              ? 'No results — try a different search'
              : `${filtered.length} term${filtered.length > 1 ? 's' : ''} found`
            }
          </p>
        )}

        {/* ── Cards grid ──────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '80px 0', color: '#2d3147',
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
            <p style={{ fontSize: 14, color: '#3d4255' }}>No results for &ldquo;{query}&rdquo;</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 18,
          }}>
            {filtered.map((t, i) => (
              <div
                key={t.id}
                style={{
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? 'translateY(0)' : 'translateY(12px)',
                  transition: `opacity .4s ease ${i * 40}ms, transform .4s ease ${i * 40}ms`,
                }}
              >
                <TermCard term={t} visible={mounted} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
