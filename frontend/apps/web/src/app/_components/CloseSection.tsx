'use client';

// 23:30 — the close. Night, one window still lit, and the address field
// again: picking an address opens its preview on /start. The store
// badges show only once both public listings exist and the QR codes are
// marked ready, as the old closing section did.

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ANDROID_PLAY_STORE_URL, IOS_APP_STORE_URL } from '@pantopus/utils';
import AddressAutocomplete, { type SelectedAddress } from '@/components/place/AddressAutocomplete';
import LivingSky from './LivingSky';
import styles from './home.module.css';

const STORES_READY = !!(IOS_APP_STORE_URL && ANDROID_PLAY_STORE_URL && process.env.NEXT_PUBLIC_STORE_QR_CODES_READY === 'true');

export default function CloseSection() {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedAddress | null>(null);
  const open = (place: SelectedAddress | null) => router.push(place ? `/start?address=${encodeURIComponent(place.label)}` : '/start');

  return (
    <section className={styles.close} aria-labelledby="close-title">
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
                  open(place);
                }}
                onClear={() => setSelected(null)}
                onSubmit={() => open(selected)}
              />
            </div>
            <button type="button" className={styles.closeBtn} onClick={() => open(selected)}>See your place</button>
          </div>
        </div>
        <p className={styles.note} style={{ color: '#C9D3E3' }}>Free to look. No account needed.</p>
        {STORES_READY ? (
          <div className={styles.stores}>
            <a href={IOS_APP_STORE_URL} target="_blank" rel="noopener noreferrer">
              <Image src="/landing/badge-appstore-dark.svg" alt="Download on the App Store" width={132} height={44} />
            </a>
            <a href={ANDROID_PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
              <Image src="/landing/badge-playstore-dark.svg" alt="Get it on Google Play" width={140} height={44} />
            </a>
            <Image src="/landing/qr-ios.png" alt="QR code for the iPhone app" width={96} height={96} className={styles.qr} />
          </div>
        ) : null}
      </div>
      <div className={styles.closeSpace} aria-hidden="true" />
    </section>
  );
}
