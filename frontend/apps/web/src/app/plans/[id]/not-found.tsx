import Link from 'next/link';
import { ANDROID_PLAY_STORE_URL, IOS_APP_STORE_URL } from '@pantopus/utils';

// A plan link that doesn't open: removed, never shared publicly, or mistyped.
export default function PlanNotFound() {
  const button =
    'flex h-10 w-full items-center justify-center rounded-[10px] border border-app-border-strong bg-app-surface text-[15px] font-semibold text-app-text';
  return (
    <main className="min-h-screen bg-app text-app-text">
      <div className="mx-auto w-full max-w-md">
        <div className="flex h-14 items-center border-b border-app-border bg-app-surface px-4">
          <Link href="/" className="text-[19px] font-bold leading-[22px] tracking-[-0.02em] text-app-text">
            Pantopus
          </Link>
        </div>
        <div className="flex flex-col gap-4 px-4 pt-10">
          <h1 className="text-xl font-semibold leading-[26px]">This plan isn&apos;t available</h1>
          <p className="text-sm leading-5 text-app-text-secondary">
            It may have been removed, or the link is incomplete. Plans near you are in the Pantopus app.
          </p>
          {IOS_APP_STORE_URL || ANDROID_PLAY_STORE_URL ? (
            <div className="grid grid-cols-2 gap-[10px]">
              {IOS_APP_STORE_URL ? <a href={IOS_APP_STORE_URL} className={button}>Get it for iPhone</a> : <span />}
              {ANDROID_PLAY_STORE_URL ? <a href={ANDROID_PLAY_STORE_URL} className={button}>Get it for Android</a> : <span />}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
