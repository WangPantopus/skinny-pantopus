'use client';

// 23:30 — the close. Night, one window still lit, and the address field
// again: picking an address opens its preview on /start. Below it, the
// app: the phone's own store badge on a phone, or the QR code that opens
// /get and both badges on a computer. /get sends computers here
// (#get-the-app).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AddressAutocomplete, { type SelectedAddress } from '@/components/place/AddressAutocomplete';
import AppDownload from './AppDownload';
import LivingSky from './LivingSky';
import styles from './home.module.css';

export default function CloseSection() {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedAddress | null>(null);
  const [fallbackAddress, setFallbackAddress] = useState<string | null>(null);
  const open = (address: string | null) => router.push(address ? `/start?address=${encodeURIComponent(address)}` : '/start');

  return (
    <section id="get-the-app" className={styles.close} aria-labelledby="close-title">
      <LivingSky className={styles.sky} hour={23.5} rise={false} orbX={0.84} homes={0.75} houseX={0.72} houseXNarrow={0.4} horizon={0.86} label="Late at night, one window still lit" />
      <div className={styles.closeInner}>
        <span className={styles.label} style={{ color: '#C9D3E3', fontSize: 12 }}>23:30 · One window still lit</span>
        <h2 id="close-title" className={styles.closeTitle}>Start with the place you call home.</h2>
        <p className={styles.lede} style={{ color: '#D5DDEA', maxWidth: 560 }}>
          See what’s true about your address. Make a little room in your head. Find a reason to get together.
        </p>
        <div className={styles.closeForm}>
          <div className={styles.lookupRow}>
            <div className={styles.lookupField}>
              <AddressAutocomplete
                ariaLabel="Your address"
                placeholder="Start typing your address"
                onSelect={(place) => {
                  setSelected(place);
                  open(place.label);
                }}
                onClear={() => setSelected(null)}
                onFallbackChange={setFallbackAddress}
                onSubmit={() => open(selected?.label ?? fallbackAddress)}
              />
            </div>
            <button type="button" className={styles.closeBtn} onClick={() => open(selected?.label ?? fallbackAddress)}>See your place</button>
          </div>
        </div>
        <p className={styles.note} style={{ color: '#C9D3E3' }}>Free to look. No account needed.</p>
        <AppDownload variant="close" />
      </div>
      <div className={styles.closeSpace} aria-hidden="true" />
    </section>
  );
}
