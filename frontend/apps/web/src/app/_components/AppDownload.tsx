'use client';

// Getting the app, by device. On an iPhone or an Android phone: one
// badge for that phone's store. On anything else: one QR code that
// opens /get (which sends each phone to its own store) and both badges.
// The phone is read after hydration, so the server renders nothing.

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ANDROID_PLAY_STORE_URL, APP_WEB_URL, IOS_APP_STORE_URL } from '@pantopus/utils';
import QRCode from '@/components/ui/QRCode';
import styles from './home.module.css';

export type Platform = 'ios' | 'android' | 'other';

/** The visitor's phone, once known; null before hydration. */
export function usePlatform(): Platform | null {
  const [platform, setPlatform] = useState<Platform | null>(null);
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    setPlatform(/iphone|ipad|ipod/.test(ua) ? 'ios' : /android/.test(ua) ? 'android' : 'other');
  }, []);
  return platform;
}

/** The store for this phone, or null on a computer or when that store has no listing. */
export function phoneStore(platform: Platform | null): { href: string; label: string } | null {
  if (platform === 'ios' && IOS_APP_STORE_URL) return { href: IOS_APP_STORE_URL, label: 'Get it on the App Store' };
  if (platform === 'android' && ANDROID_PLAY_STORE_URL) return { href: ANDROID_PLAY_STORE_URL, label: 'Get it on Google Play' };
  return null;
}

function AppStoreBadge() {
  return (
    <a href={IOS_APP_STORE_URL} className={styles.storeBadge} target="_blank" rel="noopener noreferrer">
      <Image src="/landing/badge-appstore.svg" alt="Download on the App Store" width={132} height={44} />
    </a>
  );
}

function PlayBadge() {
  return (
    <a href={ANDROID_PLAY_STORE_URL} className={styles.storeBadge} target="_blank" rel="noopener noreferrer">
      <Image src="/landing/badge-playstore.svg" alt="Get it on Google Play" width={148} height={44} />
    </a>
  );
}

export default function AppDownload({ variant }: { variant: 'hero' | 'close' }) {
  const platform = usePlatform();
  if (!platform || !IOS_APP_STORE_URL || !ANDROID_PLAY_STORE_URL) return null;

  if (platform !== 'other') {
    return (
      <div className={styles.appPhone}>
        <span className={styles.appCaption}>{variant === 'hero' ? 'Or get the app:' : 'Get the app, free:'}</span>
        {platform === 'ios' ? <AppStoreBadge /> : <PlayBadge />}
      </div>
    );
  }
  // The hero keeps its one action on a computer; the QR code waits in the closing section.
  if (variant === 'hero') return null;
  return (
    <div className={styles.appDesk}>
      <span className={styles.qrCard}>
        <QRCode value={`${APP_WEB_URL}/get`} size={104} label="QR code that opens the Pantopus app in your phone's store" />
      </span>
      <span className={styles.appDeskText}>
        <span className={styles.appCaption}>Scan with your phone’s camera to get the app, or pick your store:</span>
        <span className={styles.stores}>
          <AppStoreBadge />
          <PlayBadge />
        </span>
      </span>
    </div>
  );
}
