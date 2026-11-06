// ============================================================
// /get — the one link the homepage's QR code opens.
//
// An iPhone goes straight to the App Store and an Android phone to
// Google Play; anything else (a computer, a tablet in desktop mode)
// lands on the homepage's app section. One code works for both phones,
// and it never needs redrawing when a store link changes.
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { ANDROID_PLAY_STORE_URL, IOS_APP_STORE_URL } from '@pantopus/utils';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  const ua = (req.headers.get('user-agent') || '').toLowerCase();
  const store = /iphone|ipad|ipod/.test(ua) ? IOS_APP_STORE_URL : /android/.test(ua) ? ANDROID_PLAY_STORE_URL : '';
  const res = NextResponse.redirect(store || new URL('/#get-the-app', req.url), 302);
  // The answer depends on the phone, so no cache may keep one phone's store for another.
  res.headers.set('Cache-Control', 'private, no-store');
  res.headers.set('Vary', 'User-Agent');
  return res;
}
