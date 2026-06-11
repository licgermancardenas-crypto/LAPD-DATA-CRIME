'use client';

import { useState, useMemo, useEffect } from 'react';
import Shell from '@/components/Shell';
import { Search, BookOpen, Clock, Users, AlertTriangle, Building2 } from 'lucide-react';

// ── Palette ──────────────────────────────────────────────────────────────────
const CATS = [
  { id: 'all',          label: 'Todos',                  color: '#7b82a0',  bg: 'rgba(123,130,160,.1)' },
  { id: 'temporal',     label: 'Métricas Temporales',    color: '#00f3ff',  bg: 'rgba(0,243,255,.08)'  },
  { id: 'demographic',  label: 'Variables Demográficas', color: '#d946ef',  bg: 'rgba(217,70,239,.08)' },
  { id: 'crime-code',   label: 'Códigos de Crimen',      color: '#fbbf24',  bg: 'rgba(251,191,36,.08)' },
  { id: 'lapd-concept', label: 'Conceptos LAPD',         color: '#4f8ef7',  bg: 'rgba(79,142,247,.08)' },
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
    definition: 'Brecha en días entre el momento en que ocurrió el delito y la fecha en que fue registrado formalmente en el sistema LAPD. Indicador clave de confianza institucional y eficiencia operativa de cada comisaría.',
    example: 'Robo ocurrido el lunes 3, denunciado el viernes 7 → Lag = 4 días. Si el Reporting Lag promedio de una división sube de 12 a 31 días en un año, puede indicar pérdida de confianza ciudadana o saturación de la guardia.',
  },
  {
    id: 'date-occ',
    term: 'DATE OCC',
    native: 'Fecha de Ocurrencia',
    category: 'temporal',
    field: 'date_occ',
    definition: 'Fecha en que el delito realmente ocurrió según el relato de la víctima o evidencia física/forense. Es la referencia real del incidente. Todos los análisis de estacionalidad del dashboard se calculan sobre esta fecha.',
    example: 'Si un auto fue robado la noche del 15 de marzo, DATE OCC = 2023-03-15. Usar DATE RPTD en su lugar inflaría artificialmente los delitos del mes en que llegan las denuncias tardías.',
  },
  {
    id: 'date-rptd',
    term: 'DATE RPTD',
    native: 'Fecha de Denuncia',
    category: 'temporal',
    field: 'date_rptd',
    definition: 'Fecha en que el incidente fue formalmente reportado a la policía e ingresado al RMS (Records Management System). Siempre es igual o posterior a DATE OCC.',
    example: 'Un fraude bancario ocurrido en enero puede denunciarse en marzo cuando el banco notifica al cliente. El Reporting Lag resultante es ~60 días, distorsionando las cifras si se usa DATE RPTD como eje temporal.',
  },
  {
    id: 'time-occ',
    term: 'TIME OCC',
    native: 'Hora del Hecho',
    category: 'temporal',
    field: 'time_occ (HHMM)',
    definition: 'Hora estimada en que ocurrió el delito, expresada en formato militar de 4 dígitos (0000–2359). Es la fuente del heatmap horario del dashboard. Valores en bloques redondos (0000, 1200) suelen indicar hora desconocida.',
    example: 'TIME OCC = 0230 → 2:30 AM. La franja 2200–0400 concentra asaltos y vandalismo. Los robos a comercios pican entre 1400–1800 (máximo tráfico peatonal). La hora 0000 tiene sobreconteo por registros sin hora precisa.',
  },
  // ── Variables Demográficas ────────────────────────────────────────────────
  {
    id: 'vict-age',
    term: 'VICT AGE',
    native: 'Edad de la Víctima',
    category: 'demographic',
    field: 'vict_age',
    definition: 'Edad en años completos de la víctima al momento del hecho. Puede contener valores atípicos: 0 (persona jurídica), negativos (error de carga) o valores extremos. Requiere limpieza antes del análisis demográfico.',
    example: 'La distribución modal en LAPD 2020-2024 se concentra en 25–34 años. Víctimas registradas menores de 12 años activan automáticamente protocolos de reporte al DCFS (Departamento de Servicios Infantiles).',
  },
  {
    id: 'vict-age-zero',
    term: 'VICT AGE = 0',
    native: 'Persona Jurídica / Negocio',
    category: 'demographic',
    field: 'vict_age = 0',
    definition: 'Cuando la víctima no es una persona física sino una entidad legal (comercio, vehículo institucional, banco, gobierno), el sistema registra edad 0 por defecto. No representa recién nacidos ni menores de 1 año.',
    example: 'Un robo a una farmacia de Hollywood tiene VICT AGE = 0. El 12% del dataset total corresponde a este caso. Excluir estos registros del análisis demográfico eleva la edad media real de víctimas humanas en +4.2 años.',
  },
  {
    id: 'vict-sex',
    term: 'VICT SEX',
    native: 'Sexo de la Víctima',
    category: 'demographic',
    field: 'vict_sex',
    definition: 'Género registrado de la víctima según los códigos LAPD: M (Masculino), F (Femenino), X (No especificado / No binario / No aplica). Históricamente se usaron códigos H y N que hoy están deprecados.',
    example: 'Los delitos violentos (Part 1) muestran 64% de víctimas masculinas. Los delitos domésticos invierten ese ratio: 71% femeninas. El código X (~3%) concentra en su mayoría casos donde la víctima era un negocio (VICT AGE = 0).',
  },
  {
    id: 'vict-descent',
    term: 'VICT DESCENT',
    native: 'Etnia de la Víctima',
    category: 'demographic',
    field: 'vict_descent',
    definition: 'Código de una letra que representa la etnia auto-declarada o estimada de la víctima según la clasificación del Departamento de Justicia de California. Refleja percepción del oficial respondiente cuando la víctima no está presente.',
    example: 'H = Hispanic/Latino · W = White · B = Black · A = Asian · O = Other · X = Unknown · I = American Indian · Z = Asian Indian. El código B concentra incidencia de violencia desproporcionada en divisiones como 77th Street y Southeast.',
  },
  // ── Códigos de Crimen ─────────────────────────────────────────────────────
  {
    id: 'part-1',
    term: 'Part 1 Crimes',
    native: 'Delitos Graves (FBI)',
    category: 'crime-code',
    field: 'part_1_2 = 1',
    definition: 'Clasificación del FBI que agrupa los 8 delitos más graves del Programa UCR: Homicidio, Violación, Robo con violencia, Agresión grave, Robo a domicilio, Robo de auto, Hurto mayor y Arson. Son los indicadores de seguridad pública más monitoreados.',
    example: 'Si una división tiene 200 incidentes Part 1 y 500 Part 2, el 71% de su crimen es menor. Una suba del Part 1 sin suba del Part 2 indica agravamiento real de la violencia, no simplemente mayor registro administrativo.',
  },
  {
    id: 'part-2',
    term: 'Part 2 Crimes',
    native: 'Delitos Menores (FBI)',
    category: 'crime-code',
    field: 'part_1_2 = 2',
    definition: 'Categoría residual del UCR que incluye fraudes, vandalismo, posesión de armas, disturbios, embriaguez pública, prostitución y otras infracciones de menor gravedad pero mayor frecuencia estadística.',
    example: 'Un pico de Part 2 en diciembre suele correlacionar con fraudes navideños y delitos de identidad. No refleja violencia, pero es un indicador anticipado de deterioro del tejido social en una zona.',
  },
  {
    id: 'crm-cd',
    term: 'CRM CD',
    native: 'Código de Crimen LAPD',
    category: 'crime-code',
    field: 'crm_cd / crm_cd_1…4',
    definition: 'Código numérico de 3 dígitos asignado por el LAPD al tipo específico de delito. El código primario (CRM CD) es siempre el más grave del incidente. Pueden existir hasta 4 códigos adicionales por evento.',
    example: 'CRM CD 510 = Robo de Vehículo · 330 = Allanamiento · 624 = Agresión simple · 210 = Robo con violencia. Un incidente con robo Y agresión registra ambos: 210 como primario, 624 como secundario.',
  },
  {
    id: 'ucr-class',
    term: 'UCR Classification',
    native: 'Clasificación Uniforme de Delitos',
    category: 'crime-code',
    field: 'crm_cd_desc',
    definition: 'Sistema de reportes del FBI (Uniform Crime Reporting) que estandariza la clasificación delictiva entre los ~18.000 departamentos de policía de EE.UU. Permite comparaciones nacionales y temporales.',
    example: 'Gracias al UCR, el Clearance Rate de Vehicle Theft en LAPD (≈13%) puede compararse directamente con el promedio nacional del FBI (≈13.8%) o con NYPD (≈11.4%) sin ajustes metodológicos.',
  },
  // ── Conceptos de la LAPD ─────────────────────────────────────────────────
  {
    id: 'clearance-rate',
    term: 'Clearance Rate',
    native: 'Tasa de Esclarecimiento',
    category: 'lapd-concept',
    field: 'status IN (AA, JA, JO, IC)',
    definition: 'Porcentaje de casos que la LAPD considera "cerrados" mediante arresto de adulto (AA), arresto juvenil (JA/JO) o cierre excepcional (muerte del sospechoso, extradición negada, etc.). No equivale a condena judicial.',
    example: 'Clearance Rate = 15% en Vehicle Theft → solo 15 de cada 100 robos de autos derivaron en detención. La LAPD pasa de 17.8% en 2020 a 12.3% en 2024: pérdida del 31% de eficacia investigativa en 5 años.',
  },
  {
    id: 'status',
    term: 'STATUS',
    native: 'Estado Procesal del Caso',
    category: 'lapd-concept',
    field: 'status',
    definition: 'Código de 2 letras que refleja el estado procesal actual del caso: IC (Investigación Continua), AA (Adulto Arrestado), JA (Juvenil Arrestado), JO (Juvenil Derivado a Otras Agencias), AO (Adulto Derivado).',
    example: 'IC = el caso sigue abierto, sin resolución → no suma al Clearance Rate. Un expediente IC abierto en 2020 que sigue IC en 2024 presiona el denominador acumulado, hundiendo el ratio de eficacia histórico de la división.',
  },
  {
    id: 'premis-desc',
    term: 'PREMIS DESC',
    native: 'Escenario del Hecho',
    category: 'lapd-concept',
    field: 'premis_cd / premis_desc',
    definition: 'Descripción del tipo de propiedad o entorno físico donde se ejecutó el incidente. El LAPD registra más de 80 categorías granulares que el dashboard consolida en 5 macro-grupos para el análisis.',
    example: 'Street/Sidewalk → Vía Pública · Single Family Dwelling → Residencial · Commercial/Business → Comercio · Parking Lot → Estacionamiento. El 72% de los delitos graves (Part 1) ocurren en Vía Pública.',
  },
  {
    id: 'area-name',
    term: 'AREA NAME',
    native: 'División Policial',
    category: 'lapd-concept',
    field: 'area / area_name',
    definition: 'Nombre de una de las 21 divisiones policiales de Los Ángeles que recibió y tramitó el reporte del incidente. Cada división opera con autonomía táctica y tiene su propio capitán y estadísticas de desempeño.',
    example: '"77th Street" cubre South LA con los índices históricos más altos de violencia. "West LA" concentra delitos de propiedad en zonas residenciales premium. La división de menor densidad delictiva por habitante es "Foothill" (San Fernando Valley Norte).',
  },
  {
    id: 'weapon-used',
    term: 'WEAPON USED CD',
    native: 'Arma Utilizada',
    category: 'lapd-concept',
    field: 'weapon_used_cd',
    definition: 'Código numérico que identifica el arma o método de fuerza empleado en el delito. Campo vacío o nulo indica que no hubo arma o que no se determinó. Es crítico para calcular el índice de violencia letal.',
    example: 'Código 400 = Manos/Puños (pelea sin arma) · 101–109 = Armas de fuego (distintos tipos) · 504 = Cuchillo/Navaja. El 58% de los homicidios en el dataset involucran armas de fuego (serie 200+), tasa consistente con el promedio de California.',
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
          Caso Práctico
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
                Centro de Terminología e Inteligencia
              </h1>
              <p style={{ fontSize: 13, color: '#5a6080', margin: '4px 0 0' }}>
                Diccionario de variables, métricas y conceptos operativos del sistema LAPD 2020–2024
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
            placeholder="Buscar término, campo, definición…"
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
              ? 'Sin resultados — probá otra búsqueda'
              : `${filtered.length} término${filtered.length > 1 ? 's' : ''} encontrado${filtered.length > 1 ? 's' : ''}`
            }
          </p>
        )}

        {/* ── Cards grid ──────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '80px 0', color: '#2d3147',
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
            <p style={{ fontSize: 14, color: '#3d4255' }}>Sin resultados para &ldquo;{query}&rdquo;</p>
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
