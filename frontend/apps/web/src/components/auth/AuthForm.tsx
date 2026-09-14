'use client';

import { useEffect, useState, type FormEventHandler, type ReactNode } from 'react';

type AuthFormProps = {
  children: ReactNode;
  fieldsClassName?: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

/** Keep server-rendered credentials inactive until their submit handler is ready. */
export default function AuthForm({ children, fieldsClassName, onSubmit }: AuthFormProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <form
      method="post"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) onSubmit(event);
      }}
    >
      <fieldset disabled={!ready} aria-busy={!ready} className={fieldsClassName}>
        {children}
      </fieldset>
      <noscript>
        <p className="mt-4 text-sm text-app-text-secondary">Enable JavaScript to use this form.</p>
      </noscript>
    </form>
  );
}
