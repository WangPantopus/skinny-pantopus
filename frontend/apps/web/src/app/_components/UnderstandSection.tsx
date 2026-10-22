'use client';

// 07:10 — the place lifted into four layers. Picking a layer's card lifts
// its plate; every fact shows its source and the scale it describes.
// The facts are a labeled example (county- and area-level, so they are
// true of any home there); a missing source stays visibly empty.

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import ScaleGlyph, { type GlyphScale } from './ScaleGlyph';
import TimeMark from './TimeMark';
import styles from './home.module.css';

type Fact = { scale: GlyphScale; name: string; value: ReactNode; source: string };
type Layer = { key: string; name: string; hint: string; color: string; facts: Fact[] };

const LAYERS: Layer[] = [
  {
    key: 'sky',
    name: 'Sky',
    hint: 'right now',
    color: '#0A5C8C',
    facts: [
      { scale: 'area', name: 'Air quality', value: 'Moderate, AQI 80', source: 'AirNow' },
      { scale: 'area', name: 'Weather', value: '52°, clear', source: 'National Weather Service' },
      { scale: 'area', name: 'Daylight', value: '7:36 AM to 6:12 PM', source: 'Sunrise and sunset' },
      { scale: 'area', name: 'Alerts', value: '1 active', source: 'National Weather Service' },
    ],
  },
  {
    key: 'ground',
    name: 'Ground',
    hint: 'risk and readiness',
    color: '#8A5A2B',
    facts: [
      { scale: 'county', name: 'Radon', value: 'EPA zone 1, the highest band', source: 'EPA radon zones' },
      { scale: 'area', name: 'Earthquake', value: 'Design category D', source: 'USGS design maps' },
      { scale: 'address', name: 'Flood', value: <span className={styles.placeholder}>[your FEMA flood zone]</span>, source: 'FEMA flood maps' },
    ],
  },
  {
    key: 'water',
    name: 'Water and health',
    hint: 'on record',
    color: '#1F6F69',
    facts: [
      { scale: 'area', name: 'Water', value: 'City of Vancouver, no health-based violations in 5 years', source: 'EPA drinking water records' },
      { scale: 'address', name: 'Lead', value: 'Depends on the year your home was built', source: 'HUD lead rules' },
      { scale: 'missing', name: 'Environment', value: 'Couldn’t load this. Try again.', source: 'left visibly empty' },
    ],
  },
  {
    key: 'civic',
    name: 'Governments',
    hint: 'civic',
    color: '#3F518A',
    facts: [
      { scale: 'address', name: 'Inside 5 governments', value: 'US, Washington, Clark County, Vancouver Public Schools, City of Vancouver', source: 'Census boundaries' },
      { scale: 'address', name: 'Districts', value: '6 voting districts on record', source: 'Census boundaries' },
    ],
  },
];

// One plate of the stack, drawn top-down and turned isometric.
function Plate({ cy, active, top, side, children }: { cy: number; active: boolean; top: [string, string]; side: [string, string]; children: ReactNode }) {
  return (
    <g className={active ? styles.plateActive : styles.plate}>
      <polygon points={`88,${cy} 300,${cy + 106} 300,${cy + 118} 88,${cy + 12}`} fill={side[0]} />
      <polygon points={`300,${cy + 106} 512,${cy} 512,${cy + 12} 300,${cy + 118}`} fill={side[1]} />
      <g transform={`translate(300 ${cy}) matrix(0.7071 -0.3536 0.7071 0.3536 0 0) translate(-150 -150)`}>
        <rect width="300" height="300" rx="10" fill={top[0]} stroke={top[1]} strokeWidth={2} />
        {children}
      </g>
      <circle cx="300" cy={cy} r="5" fill="#0A5C8C" />
    </g>
  );
}

export default function UnderstandSection({ ballot }: { ballot: ReactNode }) {
  const [active, setActive] = useState(1);

  return (
    <section id="how-it-works" className={styles.understand} aria-labelledby="understand-title">
      <div className={styles.wrap} style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(36px, 4vw, 56px)' }}>
        <div className={styles.head}>
          <TimeMark time="07:10 · Morning" topic="Understand your place" icon="dawn" />
          <h2 id="understand-title" className={styles.h2}>There’s more to your address than a pin.</h2>
          <p className={styles.lede}>
            Air and weather right now. Flood, wildfire, earthquake and radon. Who supplies your water, and its record. The
            governments you live inside. Every fact names its source and its scale.
          </p>
        </div>

        <div className={styles.understandGrid}>
          <div className={styles.stack}>
            <svg viewBox="0 0 600 560" role="img" aria-label="Your place lifted into four layers: sky, ground, water and health, and governments. A line marks your address through every layer.">
              <line x1="300" y1="6" x2="300" y2="548" stroke="#0A5C8C" strokeWidth={1.2} strokeDasharray="3 5" opacity={0.55} />
              <Plate cy={432} active={active === 3} top={['#ECEFF8', '#B9C3DD']} side={['#9AA6C6', '#B4BED8']}>
                {[14, 42, 70, 96].map((inset, i) => (
                  <rect key={inset} x={inset} y={inset} width={300 - inset * 2} height={300 - inset * 2} rx={22 - i * 2} fill="none" stroke="#5A6FA8" strokeWidth={2} opacity={0.35 + i * 0.15} />
                ))}
                <rect x="120" y="120" width="60" height="60" rx="12" fill="#5A6FA8" opacity={0.16} />
              </Plate>
              <Plate cy={328} active={active === 2} top={['#D6EEEA', '#9FD0C7']} side={['#7FB3AC', '#9CCAC3']}>
                <path d="M0 150H300M150 0V300M60 150V60H240M240 150V250H90M30 60H60M240 30V60" fill="none" stroke="#2E8C84" strokeWidth={4} opacity={0.6} />
                {[[60, 60], [240, 60], [240, 250], [90, 250]].map(([x, y]) => (
                  <circle key={`${x}-${y}`} cx={x} cy={y} r="7" fill="#2E8C84" />
                ))}
                <rect x="190" y="180" width="70" height="44" rx="6" fill="none" stroke="#2E8C84" strokeWidth={2} strokeDasharray="5 5" opacity={0.7} />
              </Plate>
              <Plate cy={224} active={active === 1} top={['#EADFCD', '#CDBB9F']} side={['#B9A280', '#D0BC9C']}>
                <rect width="300" height="300" rx="10" fill="#B7895B" opacity={0.12} />
                <path d="M40 120C60 70 140 50 190 80S260 170 210 200 70 190 40 120Z" fill="none" stroke="#B0946C" strokeWidth={2} />
                <path d="M75 125C90 95 140 85 170 102S215 160 185 175 95 170 75 125Z" fill="none" stroke="#B0946C" strokeWidth={2} />
                <path d="M110 128C118 115 140 112 152 120S166 145 152 150 115 145 110 128Z" fill="none" stroke="#B0946C" strokeWidth={2} />
                <path d="M0 222C60 200 120 240 180 224S270 198 300 212V300H0Z" fill="#7FB0D8" opacity={0.6} />
                <line x1="18" y1="30" x2="290" y2="128" stroke="#A45B3B" strokeWidth={3} strokeDasharray="9 7" />
              </Plate>
              <Plate cy={120} active={active === 0} top={['#D3E8F8', '#9CC6E6']} side={['#86AFD3', '#A6C7E4']}>
                <circle cx="150" cy="150" r="48" fill="none" stroke="#5C9CCF" strokeWidth={2} strokeDasharray="4 6" />
                <circle cx="150" cy="150" r="92" fill="none" stroke="#5C9CCF" strokeWidth={2} strokeDasharray="4 6" opacity={0.6} />
                <circle cx="236" cy="66" r="24" fill="#FFE2A0" />
                <ellipse cx="78" cy="88" rx="38" ry="16" fill="#FFFFFF" opacity={0.9} />
                <ellipse cx="200" cy="232" rx="44" ry="17" fill="#FFFFFF" opacity={0.85} />
              </Plate>
              <path d="M300 34C292 24 287 18 287 11A13 13 0 1 1 313 11C313 18 308 24 300 34Z" fill="#0A5C8C" />
              <circle cx="300" cy="11" r="4.5" fill="#FFFFFF" />
            </svg>
          </div>

          <div className={styles.readouts}>
            {LAYERS.map((layer, i) => (
              <button
                key={layer.key}
                type="button"
                aria-pressed={active === i}
                onClick={() => setActive(i)}
                className={active === i ? styles.layerCardActive : styles.layerCard}
              >
                <span className={styles.layerHead}>
                  <span className={styles.layerName} style={{ color: layer.color }}>{layer.name}</span>
                  <span className={styles.layerHint}>{layer.hint}</span>
                </span>
                <span className={styles.factRows}>
                  {layer.facts.map((f) => (
                    <FactRow key={f.name} fact={f} />
                  ))}
                </span>
              </button>
            ))}
            <div className={styles.legend}>
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>Drawn at its scale</span>
              <span><ScaleGlyph scale="county" size={16} color="#0A5C8C" />county or state</span>
              <span><ScaleGlyph scale="area" size={16} color="#0A5C8C" />area</span>
              <span><ScaleGlyph scale="address" size={16} color="#0A5C8C" />this address</span>
              <span><ScaleGlyph scale="missing" size={16} color="#7A8696" />not available</span>
            </div>
            <span className={styles.label} style={{ color: '#5B6878', paddingLeft: 4 }}>Example · Clark County, WA</span>
          </div>
        </div>

        {ballot}

        <div className={styles.ctaRow}>
          <Link href="/start" className={styles.btn}>See what’s true about your address</Link>
          <span className={styles.note}>Free · no account · coverage varies by location</span>
        </div>
      </div>
    </section>
  );
}

function FactRow({ fact }: { fact: Fact }) {
  const missing = fact.scale === 'missing';
  return (
    <>
      <ScaleGlyph scale={fact.scale} color={missing ? '#7A8696' : '#0A5C8C'} />
      <span className={missing ? styles.factRowMissing : styles.factRow}>
        <span>
          <b style={{ fontWeight: 600 }}>{fact.name}</b> · {fact.value}
        </span>
        <span className={styles.factRowSource}>{fact.source}</span>
      </span>
    </>
  );
}
