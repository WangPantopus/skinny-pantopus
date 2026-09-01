// A10.10 — Wallet (src/app/wallet.tsx)
// Archetype: A10 — Detail: Content · variant: earnings_wallet (balance hero + transactions + payout)
// Two frames: populated + payout-on-hold (secondary state)

const WL = {
  primary50:  '#f0f9ff',
  primary100: '#e0f2fe',
  primary200: '#bae6fd',
  primary400: '#38bdf8',
  primary500: '#0ea5e9',
  primary600: '#0284c7',
  primary700: '#0369a1',
  primary800: '#075985',
  primary900: '#0c4a6e',
  bg:      '#f6f7f9',
  surface: '#ffffff',
  sunken:  '#f3f4f6',
  border:  '#e5e7eb',
  borderSub: '#f3f4f6',
  fg1: '#111827',
  fg2: '#374151',
  fg3: '#6b7280',
  fg4: '#9ca3af',
  success600:'#059669',
  success700:'#047857',
  successBg: '#d1fae5',
  successSoft:'#ecfdf5',
  warning600:'#d97706',
  warningBg: '#fef3c7',
  warningRing:'#fcd34d',
  amber:     '#b45309',
  amberDeep: '#92400e',
  errorBg:   '#fee2e2',
  error600:  '#dc2626',
  homeBg:    '#dcfce7',
  home:      '#16a34a',
  homeDeep:  '#15803d',
};

// ─── Phone shell ──────────────────────────────────────────────

function WLStatusBar({ onDark }) {
  const c = onDark ? '#ffffff' : WL.fg1;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 28px 0', height: 44, boxSizing: 'border-box',
      fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 15, color: c,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={c}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={c}/><rect x="9" y="2" width="3" height="9" rx="0.6" fill={c}/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={c}/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={c}/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={c}/><circle cx="7.5" cy="9" r="1.3" fill={c}/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={c} strokeOpacity="0.4" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill={c}/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill={c} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

function WLPhone({ children }) {
  return (
    <div style={{
      width: 360, height: 740, borderRadius: 46, padding: 10,
      background: '#0b0f17',
      boxShadow: '0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }}>
      <div style={{
        width: '100%', height: '100%', background: WL.bg,
        borderRadius: 36, overflow: 'hidden', position: 'relative',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)',
          width: 108, height: 30, borderRadius: 20, background: '#000', zIndex: 50,
        }} />
        <WLStatusBar />
        {children}
        <div style={{
          position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
          width: 120, height: 4, borderRadius: 4, background: 'rgba(0,0,0,0.25)',
          zIndex: 60,
        }} />
      </div>
    </div>
  );
}

function WLTopBar() {
  const Btn = ({ icon }) => (
    <button style={{
      width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'transparent', border: 'none', cursor: 'pointer', color: WL.fg1, padding: 0,
      borderRadius: 8,
    }}>
      <i data-lucide={icon} style={{ width: 20, height: 20 }} />
    </button>
  );
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '4px 8px',
      height: 48, boxSizing: 'border-box',
      background: WL.surface, borderBottom: `1px solid ${WL.border}`,
      flexShrink: 0, zIndex: 5,
    }}>
      <Btn icon="chevron-left" />
      <div style={{
        flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600,
        color: WL.fg1, letterSpacing: -0.15,
      }}>Wallet</div>
      <Btn icon="history" />
    </div>
  );
}

function WLOverline({ children, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      marginTop: 16, marginBottom: 8,
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: 0.08,
        textTransform: 'uppercase', color: WL.fg3,
      }}>{children}</div>
      {action && (
        <button style={{
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
          fontSize: 11.5, color: WL.primary600, fontWeight: 600,
        }}>{action}</button>
      )}
    </div>
  );
}

// ─── Balance hero ─────────────────────────────────────────────

function BalanceHero({ available, pending, holdTone }) {
  return (
    <div style={{
      position: 'relative',
      borderRadius: 18,
      overflow: 'hidden',
      background: `linear-gradient(155deg, ${WL.primary800} 0%, ${WL.primary700} 55%, ${WL.primary600} 100%)`,
      boxShadow: '0 10px 24px rgba(2, 132, 199, 0.28)',
      color: '#fff',
      padding: '16px 18px 14px',
    }}>
      {/* decorative arcs */}
      <svg
        width="200" height="200" viewBox="0 0 200 200"
        style={{
          position: 'absolute', right: -40, top: -50, opacity: 0.18,
          pointerEvents: 'none',
        }}
      >
        <circle cx="100" cy="100" r="90" stroke="#fff" strokeWidth="1" fill="none" />
        <circle cx="100" cy="100" r="60" stroke="#fff" strokeWidth="1" fill="none" />
        <circle cx="100" cy="100" r="30" stroke="#fff" strokeWidth="1" fill="none" />
      </svg>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{
          fontSize: 10.5, fontWeight: 700, letterSpacing: 0.1,
          textTransform: 'uppercase', color: '#bae6fd',
        }}>Available to withdraw</div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px 3px 6px', borderRadius: 9999,
          background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(8px)',
          fontSize: 10, fontWeight: 700, letterSpacing: 0.04, textTransform: 'uppercase',
          color: '#fff',
        }}>
          <i data-lucide="shield-check" style={{ width: 10, height: 10, strokeWidth: 2.5 }} />
          USD
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 4,
        marginTop: 4,
      }}>
        <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4, color: '#bae6fd', alignSelf: 'flex-start', marginTop: 8 }}>$</span>
        <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1.4, color: '#fff', lineHeight: 1 }}>
          {available.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* pending vs available split */}
      <div style={{
        marginTop: 14, padding: '10px 12px',
        background: 'rgba(255,255,255,0.10)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: 12,
        display: 'flex', alignItems: 'stretch', gap: 0,
      }}>
        <div style={{ flex: 1, paddingRight: 12 }}>
          <div style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: 0.06,
            textTransform: 'uppercase', color: '#bae6fd', opacity: 0.85,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <i data-lucide="clock" style={{ width: 10, height: 10, strokeWidth: 2.5 }} />
            Pending
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: -0.25, marginTop: 2 }}>
            ${pending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 10.5, color: '#bae6fd', opacity: 0.8, marginTop: 1 }}>
            3 tasks · clears by Dec 4
          </div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.16)' }} />
        <div style={{ flex: 1, paddingLeft: 12 }}>
          <div style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: 0.06,
            textTransform: 'uppercase', color: '#bae6fd', opacity: 0.85,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <i data-lucide="trending-up" style={{ width: 10, height: 10, strokeWidth: 2.5 }} />
            This month
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: -0.25, marginTop: 2 }}>
            $1,284.50
          </div>
          <div style={{ fontSize: 10.5, color: '#bae6fd', opacity: 0.8, marginTop: 1 }}>
            8 tasks · ▲ 22% vs Oct
          </div>
        </div>
      </div>

      {/* hold notice */}
      {holdTone && (
        <div style={{
          marginTop: 12,
          background: 'rgba(252, 211, 77, 0.18)',
          border: '1px solid rgba(252, 211, 77, 0.45)',
          borderRadius: 10,
          padding: '8px 10px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <i data-lucide="alert-triangle" style={{ width: 14, height: 14, color: '#fde68a', strokeWidth: 2.4 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 11.5, fontWeight: 700, color: '#fef3c7',
              letterSpacing: -0.05,
            }}>Withdrawals paused</div>
            <div style={{ fontSize: 10.5, color: '#fde68a', opacity: 0.9, marginTop: 1 }}>
              Re-verify your bank to release funds.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Transactions ─────────────────────────────────────────────

const TXS = [
  { day: 'Today',     dateLbl: '2:14 pm',  type: 'task',     dir: 'in',  amt: 140.00, who: 'Marcus P.',     desc: 'Patio cleanup · 3 hr', cat: 'cleaning', status: 'available' },
  { day: 'Today',     dateLbl: '10:02 am', type: 'task',     dir: 'in',  amt:  85.00, who: 'Diane K.',      desc: 'Lawn cleanup',         cat: 'cleaning', status: 'pending', clears: 'Dec 4' },
  { day: 'Yesterday', dateLbl: '8:31 pm',  type: 'task',     dir: 'in',  amt:  60.00, who: 'The Hahns',     desc: 'Babysitting · 3 hr',   cat: 'child-care', status: 'pending', clears: 'Dec 3' },
  { day: 'Nov 28',    dateLbl: '11:14 am', type: 'payout',   dir: 'out', amt: 500.00, who: 'Chase ••••7421',desc: 'Withdrawal',           cat: 'bank',     status: 'complete' },
  { day: 'Nov 26',    dateLbl: '5:48 pm',  type: 'task',     dir: 'in',  amt: 120.00, who: 'Reyes household', desc: 'IKEA assembly',      cat: 'handyman', status: 'available' },
  { day: 'Nov 24',    dateLbl: '3:01 pm',  type: 'task',     dir: 'in',  amt:  41.00, who: 'Tom B.',        desc: 'Dog walk · 4 visits',  cat: 'pet-care', status: 'available' },
  { day: 'Nov 22',    dateLbl: '6:14 pm',  type: 'fee',      dir: 'out', amt:   2.40, who: 'Pantopus',      desc: 'Service fee',          cat: 'fee',      status: 'complete' },
];

const CAT_BG = {
  cleaning: '#dcfce7',
  'child-care': '#fef3c7',
  handyman: '#ffedd5',
  'pet-care': '#fee2e2',
  bank: '#e0e7ff',
  fee: '#f3f4f6',
};
const CAT_FG = {
  cleaning: '#15803d',
  'child-care': '#92400e',
  handyman: '#9a3412',
  'pet-care': '#b91c1c',
  bank: '#3730a3',
  fee: '#6b7280',
};
const CAT_ICON = {
  cleaning: 'sparkles',
  'child-care': 'baby',
  handyman: 'wrench',
  'pet-care': 'dog',
  bank: 'building-2',
  fee: 'receipt',
};

function TxRow({ tx, last }) {
  const isOut = tx.dir === 'out';
  const isPending = tx.status === 'pending';
  const isFee = tx.type === 'fee';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 14px',
      borderBottom: last ? 'none' : `1px solid ${WL.borderSub}`,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        background: CAT_BG[tx.cat] || WL.sunken,
        color: CAT_FG[tx.cat] || WL.fg2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <i data-lucide={CAT_ICON[tx.cat] || 'circle'} style={{ width: 16, height: 16, strokeWidth: 2 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12.5, fontWeight: 600, color: WL.fg1, letterSpacing: -0.1,
        }}>
          <span style={{
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{tx.desc}</span>
          {isPending && (
            <span style={{
              padding: '1px 6px', borderRadius: 9999,
              background: WL.warningBg, color: WL.amberDeep,
              fontSize: 9, fontWeight: 700, letterSpacing: 0.04, textTransform: 'uppercase',
            }}>Pending</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: WL.fg3, marginTop: 1 }}>
          {tx.who} · {tx.dateLbl}{isPending ? ` · clears ${tx.clears}` : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 700, letterSpacing: -0.2,
          color: isOut ? WL.fg2 : (isPending ? WL.amberDeep : WL.success700),
        }}>
          {isOut ? '−' : '+'}${tx.amt.toFixed(2)}
        </div>
        <div style={{ fontSize: 10, color: WL.fg4, marginTop: 1 }}>
          {isFee ? 'Fee' : isOut ? 'Payout' : isPending ? 'On hold' : 'Cleared'}
        </div>
      </div>
    </div>
  );
}

function TxList({ items }) {
  return (
    <div style={{
      background: WL.surface, border: `1px solid ${WL.border}`,
      borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
    }}>
      {/* day group header — today */}
      {items.map((tx, i) => (
        <React.Fragment key={i}>
          {(i === 0 || items[i - 1].day !== tx.day) && (
            <div style={{
              padding: '8px 14px 4px',
              background: WL.surface,
              fontSize: 9.5, fontWeight: 700, letterSpacing: 0.08,
              textTransform: 'uppercase', color: WL.fg4,
              borderTop: i === 0 ? 'none' : `1px solid ${WL.borderSub}`,
            }}>{tx.day}</div>
          )}
          <TxRow tx={tx} last={i === items.length - 1} />
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Payout method ───────────────────────────────────────────

function PayoutMethod({ warn }) {
  return (
    <div style={{
      background: WL.surface, border: `1px solid ${warn ? WL.warningRing : WL.border}`,
      borderRadius: 14, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: warn ? '0 1px 3px rgba(217,119,6,0.10)' : '0 1px 3px rgba(0,0,0,0.03)',
    }}>
      <div style={{
        width: 44, height: 30, borderRadius: 6,
        background: warn
          ? `linear-gradient(135deg, ${WL.warningBg}, #fde68a)`
          : 'linear-gradient(135deg, #1e3a8a, #2563eb)',
        color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        position: 'relative',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)',
      }}>
        <div style={{
          fontSize: 8.5, fontWeight: 800, letterSpacing: 0.06,
          color: warn ? WL.amberDeep : '#fff',
        }}>CHASE</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12.5, fontWeight: 700, color: WL.fg1, letterSpacing: -0.1,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          Chase checking
          <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: WL.fg3, fontWeight: 600 }}>•••• 7421</span>
        </div>
        <div style={{
          fontSize: 11, marginTop: 1,
          color: warn ? WL.amberDeep : WL.fg3,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {warn ? (
            <>
              <i data-lucide="alert-circle" style={{ width: 11, height: 11, strokeWidth: 2.3 }} />
              Verification expired Nov 30
            </>
          ) : (
            <>
              <i data-lucide="zap" style={{ width: 11, height: 11, strokeWidth: 2.3, color: WL.home }} />
              Instant payout · 1–3 minutes
            </>
          )}
        </div>
      </div>
      {warn ? (
        <button style={{
          height: 30, padding: '0 10px', borderRadius: 8,
          background: WL.amberDeep, color: '#fff', border: 'none', cursor: 'pointer',
          fontSize: 11.5, fontWeight: 700, letterSpacing: -0.05,
        }}>Re-verify</button>
      ) : (
        <button style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontSize: 11.5, color: WL.primary600, fontWeight: 600, padding: 4,
        }}>Manage</button>
      )}
    </div>
  );
}

// ─── Tax docs row ────────────────────────────────────────────

function TaxDocsRow({ ready }) {
  return (
    <div style={{
      background: WL.surface, border: `1px solid ${WL.border}`,
      borderRadius: 14, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        background: ready ? WL.homeBg : WL.sunken,
        color: ready ? WL.homeDeep : WL.fg2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <i data-lucide="file-text" style={{ width: 17, height: 17, strokeWidth: 2 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12.5, fontWeight: 700, color: WL.fg1, letterSpacing: -0.1,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          Tax documents
          {ready && (
            <span style={{
              padding: '1px 6px', borderRadius: 9999,
              background: WL.homeBg, color: WL.homeDeep,
              fontSize: 9, fontWeight: 700, letterSpacing: 0.04, textTransform: 'uppercase',
            }}>New</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: WL.fg3, marginTop: 1 }}>
          {ready
            ? '1099-NEC for 2025 ready · $9,847 reported'
            : 'YTD earnings $3,184 · docs available mid-Jan'}
        </div>
      </div>
      <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: WL.fg4 }} />
    </div>
  );
}

// ─── Sticky bottom bar ───────────────────────────────────────

function BottomBar({ children }) {
  return (
    <div style={{
      flexShrink: 0,
      padding: '10px 16px 20px',
      background: 'linear-gradient(180deg, rgba(246,247,249,0) 0%, rgba(246,247,249,0.92) 30%, #f6f7f9 60%)',
      borderTop: `1px solid ${WL.borderSub}`,
      zIndex: 4,
    }}>
      {children}
    </div>
  );
}

function WithdrawCTA({ amount }) {
  return (
    <button style={{
      width: '100%', height: 52, borderRadius: 14, border: 'none',
      background: WL.primary600, color: '#fff',
      fontSize: 15, fontWeight: 700, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 18px',
      letterSpacing: -0.15,
      boxShadow: '0 6px 16px rgba(2,132,199,.28)',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <i data-lucide="arrow-down-to-line" style={{ width: 17, height: 17 }} />
        Withdraw
      </span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </button>
  );
}

function WithdrawCTABlocked({ amount }) {
  return (
    <div>
      <button disabled style={{
        width: '100%', height: 52, borderRadius: 14, border: `1px solid ${WL.border}`,
        background: WL.sunken, color: WL.fg4,
        fontSize: 15, fontWeight: 700, cursor: 'not-allowed',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 18px',
        letterSpacing: -0.15,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <i data-lucide="lock" style={{ width: 16, height: 16 }} />
          Withdraw
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </button>
      <div style={{
        marginTop: 6, textAlign: 'center',
        fontSize: 10.5, color: WL.fg3, lineHeight: '14px',
      }}>
        Re-verify your bank above to unlock payouts.
      </div>
    </div>
  );
}

// ─── Hold banner (Frame 2 top) ───────────────────────────────

function HoldBanner() {
  return (
    <div style={{
      background: WL.warningBg, border: `1px solid ${WL.warningRing}`,
      borderRadius: 14, padding: '12px 14px',
      display: 'flex', alignItems: 'flex-start', gap: 12,
      boxShadow: '0 1px 3px rgba(217,119,6,0.08)',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10, background: WL.warning600,
        color: '#fff', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i data-lucide="shield-alert" style={{ width: 17, height: 17, strokeWidth: 2.3 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 700, color: WL.amberDeep,
          letterSpacing: -0.15, marginBottom: 2,
        }}>Bank verification expired</div>
        <div style={{
          fontSize: 11.5, color: WL.amberDeep, lineHeight: '16px', opacity: 0.92,
        }}>
          Chase asks us to re-confirm your account every 12 months.
          A 2-minute micro-deposit check unlocks payouts again.
          Earnings keep landing in your wallet — they’re safe.
        </div>
      </div>
    </div>
  );
}

// ─── FRAME 1 — Populated, happy path ─────────────────────────

function FrameWalletPopulated() {
  return (
    <WLPhone>
      <WLTopBar />
      <div style={{
        flex: 1, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px 8px' }}>
          <BalanceHero available={847.50} pending={186.00} />

          <WLOverline action="See all">Recent activity</WLOverline>
          <TxList items={TXS.slice(0, 5)} />

          <WLOverline>Payout method</WLOverline>
          <PayoutMethod />

          <WLOverline>Taxes</WLOverline>
          <TaxDocsRow />

          <div style={{ height: 12 }} />
        </div>
        <BottomBar>
          <WithdrawCTA amount={847.50} />
        </BottomBar>
      </div>
    </WLPhone>
  );
}

// ─── FRAME 2 — Secondary: payout on hold ─────────────────────

function FrameWalletOnHold() {
  return (
    <WLPhone>
      <WLTopBar />
      <div style={{
        flex: 1, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px 8px' }}>
          <div style={{ marginBottom: 12 }}>
            <HoldBanner />
          </div>

          <BalanceHero available={847.50} pending={186.00} holdTone />

          <WLOverline action="See all">Recent activity</WLOverline>
          <TxList items={TXS.slice(0, 4)} />

          <WLOverline>Payout method</WLOverline>
          <PayoutMethod warn />

          <WLOverline>Taxes</WLOverline>
          <TaxDocsRow ready />

          <div style={{ height: 12 }} />
        </div>
        <BottomBar>
          <WithdrawCTABlocked amount={847.50} />
        </BottomBar>
      </div>
    </WLPhone>
  );
}

Object.assign(window, { FrameWalletPopulated, FrameWalletOnHold });
