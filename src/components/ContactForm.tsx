'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/*
 * Mirrors the contact form on wildfilmsindia.com — same fields, same honeypot,
 * same web3forms endpoint and access key, so messages land in the same inbox.
 * The subject is prefixed [Clipahoy] rather than [WildFilmsIndia] so the source
 * is obvious to whoever reads it.
 *
 * The access key is a publishable web3forms key: it is already in the main
 * site's client bundle and identifies the destination, not the sender.
 */
const ACCESS_KEY = '1292336c-c396-47df-8b71-307a0d8e7877';

/** How long the success state holds before the form becomes usable again. */
const RESET_AFTER_MS = 6000;

type State = 'idle' | 'sending' | 'sent' | 'error';

const EMPTY = { name: '', email: '', subject: '', message: '', website: '' };

export function ContactForm() {
  /*
   * The clip page links here with ?subject=Licensing enquiry — <title>, so
   * someone arriving from a specific clip does not have to describe which of
   * 108,000 it was. Capped and read once as the initial value: it is a URL
   * parameter rendered into a form, so it is treated as untrusted length.
   */
  const prefill = (useSearchParams().get('subject') ?? '').slice(0, 150);
  const [fields, setFields] = useState({ ...EMPTY, subject: prefill });
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * Without this the form stayed disabled forever after one successful send:
   * anyone with a second thing to say had to reload the page. Clearing the
   * timeout on unmount keeps it from setting state on a gone component.
   */
  useEffect(() => {
    if (state !== 'sent') return;
    timer.current = setTimeout(() => setState('idle'), RESET_AFTER_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state]);

  const set =
    (key: keyof typeof fields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFields((prev) => ({ ...prev, [key]: e.target.value }));
      // Typing after a failure clears the error rather than leaving a red
      // field sitting under a message the person is already acting on.
      if (state === 'error') setState('idle');
    };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === 'sending' || state === 'sent') return;

    // Honeypot: bots fill this, humans never see it.
    if (fields.website) return;

    setState('sending');
    setError('');

    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          from_name: fields.name,
          reply_to: fields.email,
          subject: `[Clipahoy] ${fields.subject}`,
          message: `From: ${fields.name} <${fields.email}>\n\n${fields.message}`,
        }),
      });

      const data: { success?: boolean; message?: string } = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message ?? 'Something went wrong. Please try again.');
        setState('error');
        return;
      }

      setFields(EMPTY);
      setState('sent');
    } catch {
      setError('Network error. Please check your connection and try again.');
      setState('error');
    }
  }

  const busy = state === 'sending' || state === 'sent';
  const invalid = state === 'error' || undefined;

  return (
    <form onSubmit={onSubmit} className="panel p-5 sm:p-7" noValidate={false}>
      <p className="eyebrow">Send a message</p>

      {/* Honeypot — off-screen, never filled by humans. */}
      <input
        type="text"
        name="website"
        value={fields.website}
        onChange={set('website')}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cf-name" className="field-label">
            Full name
          </label>
          <input
            id="cf-name"
            className="field"
            value={fields.name}
            onChange={set('name')}
            required
            maxLength={100}
            autoComplete="name"
            disabled={busy}
            aria-invalid={invalid}
          />
        </div>
        <div>
          <label htmlFor="cf-email" className="field-label">
            Email address
          </label>
          <input
            id="cf-email"
            type="email"
            className="field"
            value={fields.email}
            onChange={set('email')}
            required
            maxLength={254}
            autoComplete="email"
            disabled={busy}
            aria-invalid={invalid}
          />
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="cf-subject" className="field-label">
          Subject
        </label>
        <input
          id="cf-subject"
          className="field"
          value={fields.subject}
          onChange={set('subject')}
          required
          maxLength={150}
          disabled={busy}
          aria-invalid={invalid}
        />
      </div>

      <div className="mt-4">
        <label htmlFor="cf-message" className="field-label">
          Your message
        </label>
        <textarea
          id="cf-message"
          rows={7}
          className="field resize-y"
          value={fields.message}
          onChange={set('message')}
          required
          maxLength={4000}
          disabled={busy}
          aria-invalid={invalid}
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="btn btn-primary mt-6 w-full disabled:cursor-default disabled:opacity-70"
      >
        {state === 'sending' && (
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent"
          />
        )}
        {state === 'sending'
          ? 'Sending…'
          : state === 'sent'
            ? 'Message sent'
            : state === 'error'
              ? 'Try again'
              : 'Start a project'}
      </button>

      {/*
        One live region for both outcomes, so a screen reader is told what
        happened instead of only seeing the button label change.
      */}
      <p aria-live="polite" className="mt-3 min-h-[1.25rem] text-center text-[13px]">
        {state === 'sent' && <span className="text-accent">Thank you — we will be in touch.</span>}
        {state === 'error' && <span className="text-red-400">{error}</span>}
      </p>

      <p className="mt-1 text-center text-[12px] leading-relaxed text-faint">
        Your information is kept strictly confidential and never shared with third parties.
      </p>
    </form>
  );
}
