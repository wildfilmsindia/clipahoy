'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { QUESTIONS, TASTE_COOKIE, encodeTaste, type Answers } from '@/lib/taste';
import { Thumbnail } from './Thumbnail';

/**
 * The five questions.
 *
 * Typing is the primary interaction: a real text field, with suggestions drawn
 * from the archive's own vocabulary offered underneath. Nobody has to know
 * that this collection calls the sea "coastline" — interpret.ts translates.
 *
 * Answers live in a cookie rather than localStorage so the server can render a
 * personalised page on the very first paint, with no loading flash.
 */

const TRANSITION_MS = 460;
const REVEAL_MS = 1700;

function reduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export type Vocabulary = { places: string[]; states: string[] };

export function Onboarding({
  vocabulary,
  backdropClips = [],
  redirectOnDone = false,
}: {
  vocabulary: Vocabulary;
  /** Real clip ids, one per question, blurred behind the interface. */
  backdropClips?: string[];
  redirectOnDone?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  // Always a clean slate. Building a new archive starts empty by design — an
  // earlier version pre-filled the previous answers, which read as editing the
  // old archive rather than making a new one.
  const [answers, setAnswers] = useState<Answers>({});
  const [value, setValue] = useState('');
  const [leaving, setLeaving] = useState<'forward' | 'back' | null>(null);
  const [phase, setPhase] = useState<'asking' | 'revealing'>('asking');
  const [revealPersonal, setRevealPersonal] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const question = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;

  /*
   * A question's own `suggest` list wins; otherwise the gazetteer-backed pool
   * for its kind. `open` questions stay poolless on purpose — they are the
   * ones most likely to name something outside the closed vocabulary, and
   * autocomplete would nudge people back toward words the archive knows.
   */
  const pool = useMemo(() => {
    if (!question) return [];
    if (question.suggest) return question.suggest;
    if (question.kind === 'place') return vocabulary.places;
    if (question.kind === 'state' || question.kind === 'region') return vocabulary.states;
    return [];
  }, [question, vocabulary]);

  /** Prefix matches first, then contains. Capped so the list never overwhelms. */
  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 2) return [];
    const starts: string[] = [];
    const contains: string[] = [];
    for (const item of pool) {
      const lower = item.toLowerCase();
      if (lower === q) continue;
      if (lower.startsWith(q)) starts.push(item);
      else if (lower.includes(q)) contains.push(item);
      if (starts.length >= 6) break;
    }
    return [...starts, ...contains].slice(0, 6);
  }, [pool, value]);

  const commit = useCallback(
    (final: Answers) => {
      setRevealPersonal(Object.values(final).some((v) => v.trim()));
      setPhase('revealing');
      document.cookie = `${TASTE_COOKIE}=${encodeTaste(final)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;

      /*
       * Mark <html> here as well as in the layout's inline script.
       *
       * That script only runs on a full page load, but finishing the questions
       * navigates client-side — so the nav kept reading "Make my archive"
       * while the visitor was looking at the archive they had just built, and
       * only corrected itself on a hard reload.
       */
      if (Object.values(final).some((v) => v.trim())) {
        document.documentElement.dataset.taste = '1';
      } else {
        delete document.documentElement.dataset.taste;
      }

      window.setTimeout(
        () => {
          if (redirectOnDone) {
            // push alone can serve the home feed from the client router cache —
            // i.e. the OLD archive you came from. refresh() invalidates it so
            // the newly built feed actually renders.
            router.push('/');
            router.refresh();
          } else {
            router.refresh();
          }
        },
        reduced() ? 200 : REVEAL_MS,
      );
    },
    [redirectOnDone, router],
  );

  const go = useCallback(
    (next: Answers, direction: 'forward' | 'back') => {
      setLeaving(direction);
      window.setTimeout(
        () => {
          const target = direction === 'forward' ? step + 1 : step - 1;
          setStep(target);
          setValue(next[QUESTIONS[target]?.id] ?? '');
          setLeaving(null);
        },
        reduced() ? 0 : TRANSITION_MS,
      );
    },
    [step],
  );

  const submit = useCallback(
    (raw?: string) => {
      if (leaving || phase !== 'asking') return;
      const text = (raw ?? value).trim();

      const next: Answers = { ...answers };
      if (text) next[question.id] = text.slice(0, 120);
      else delete next[question.id];
      setAnswers(next);

      if (isLast) commit(next);
      else go(next, 'forward');
    },
    [answers, commit, go, isLast, leaving, phase, question, value],
  );

  /** Build from what has been answered so far, including this field. */
  const finishNow = useCallback(() => {
    if (leaving || phase !== 'asking') return;
    const next: Answers = { ...answers };
    const text = value.trim();
    if (text) next[question.id] = text.slice(0, 120);
    commit(next);
  }, [answers, commit, leaving, phase, question, value]);

  /** Leave the questions unanswered and go straight to the generic feed. */
  const browseInstead = useCallback(() => {
    if (leaving || phase !== 'asking') return;
    commit({});
  }, [commit, leaving, phase]);

  /** Answers banked so far, plus whatever is in the field right now. */
  const answeredCount =
    Object.values(answers).filter((v) => v.trim()).length +
    (value.trim() && !answers[question.id]?.trim() ? 1 : 0);

  const back = useCallback(() => {
    if (step === 0 || leaving || phase !== 'asking') return;
    const next = { ...answers };
    if (value.trim()) next[question.id] = value.trim();
    setAnswers(next);
    go(next, 'back');
  }, [answers, go, leaving, phase, question, step, value]);

  /*
   * Keep suggestions clear of the soft keyboard.
   *
   * The list renders below the field, around 580px down a 844px screen — which
   * is behind the keyboard once it opens. visualViewport reports the space the
   * keyboard actually left, so this only fires when the viewport has really
   * shrunk, and does nothing on desktop.
   */
  useEffect(() => {
    if (suggestions.length === 0) return;
    const vv = window.visualViewport;
    if (!vv || vv.height >= window.innerHeight - 80) return;

    listRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: reduced() ? 'auto' : 'smooth',
    });
  }, [suggestions.length]);

  /*
   * Desktop only. Autofocusing on a phone throws the keyboard up over the
   * question the moment the page opens, hiding the thing being asked.
   */
  useEffect(() => {
    if (leaving || phase !== 'asking') return;
    if (window.matchMedia('(pointer: fine)').matches) inputRef.current?.focus();
  }, [step, leaving, phase]);

  if (phase === 'revealing') return <Reveal personal={revealPersonal} />;
  if (!question) return null;

  const progress = ((step + 1) / QUESTIONS.length) * 100;
  const stepLabel = String(step + 1).padStart(2, '0');
  const fieldId = `taste-${question.id}`;
  const hintId = `taste-hint-${question.id}`;

  return (
    <section
      aria-label="Personalise your archive"
      className="relative flex min-h-[calc(100dvh-4rem)] flex-col justify-center overflow-hidden px-5 py-12 sm:px-8"
    >
      <QuestionBackdrop
        clipId={backdropClips[step % Math.max(backdropClips.length, 1)]}
        step={step}
      />

      <div className="relative mx-auto w-full max-w-3xl">
        <div
          key={step}
          className={
            leaving === 'forward' ? 'q-leave' : leaving === 'back' ? 'q-leave-back' : 'q-enter'
          }
        >
          {/* Oversized numeral anchors the composition. */}
          <p className="font-display text-[56px] leading-none font-light tabular-nums text-accent/25 sm:text-[80px]">
            {stepLabel}
          </p>

          <p className="eyebrow mt-4">{question.eyebrow}</p>

          <h1 className="mt-3 max-w-2xl font-display text-[34px] leading-[1.03] font-light tracking-[-0.015em] text-balance sm:text-[54px]">
            {question.prompt}
          </h1>

          <p id={hintId} className="mt-4 max-w-md text-[15px] leading-relaxed text-mute">
            {question.support}
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="mt-8 max-w-xl"
          >
            {/* A real label, not a placeholder standing in for one. Kept
                off-screen because the <h1> above states the same thing. */}
            <label htmlFor={fieldId} className="sr-only">
              {question.prompt}
            </label>
            <input
              id={fieldId}
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setValue('');
                }
              }}
              placeholder={question.placeholder}
              aria-describedby={hintId}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint={isLast ? 'go' : 'next'}
              maxLength={120}
              className="taste-field"
            />

            {/* Suggestions are secondary: they refine typing, never replace it. */}
            {suggestions.length > 0 && (
              <ul ref={listRef} className="mt-3 flex flex-wrap gap-2" aria-label="Suggestions">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button type="button" onClick={() => submit(s)} className="chip">
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/*
              Ghost chips rather than a dot-separated line. Wrapping the list
              put a leading separator at the start of the second row, which
              read as a stray bullet, and plain text gave a ~20px tap target.
            */}
            {suggestions.length === 0 && question.examples.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {question.examples.map((ex) => (
                  <li key={ex}>
                    <button
                      type="button"
                      onClick={() => {
                        setValue(ex);
                        inputRef.current?.focus();
                      }}
                      className="ghost-chip"
                    >
                      {ex}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <button type="submit" className="btn btn-primary">
                {isLast ? 'Build my archive' : 'Continue'}
                <span aria-hidden="true">→</span>
              </button>

              {!value.trim() && (
                <button
                  type="button"
                  onClick={() => submit('')}
                  className="text-[13.5px] text-faint transition-colors hover:text-mute"
                >
                  Skip this one
                </button>
              )}

              {step > 0 && (
                <button
                  type="button"
                  onClick={back}
                  className="text-[13.5px] text-faint transition-colors hover:text-mute"
                >
                  ← Back
                </button>
              )}

              {/*
                Stop whenever you like.

                Fifteen questions is a long way to the end, and without this the
                only route from question three to your archive was pressing
                "Skip this one" twelve times. The recommender already works from
                partial answers, so there is no reason to make anyone finish.
              */}
              {!isLast && answeredCount > 0 && (
                <button
                  type="button"
                  onClick={finishNow}
                  className="ml-auto text-[13.5px] text-accent underline decoration-line underline-offset-4 transition-colors hover:decoration-accent"
                >
                  Build it with these {answeredCount} →
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Progress: a line with a travelling node, not a form counter. */}
        <div className="mt-14 flex items-center gap-4">
          <div
            className="relative h-px flex-1 bg-line"
            role="progressbar"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={QUESTIONS.length}
            aria-label="Question progress"
          >
            <div
              className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-700 ease-[cubic-bezier(0.22,0.61,0.36,1)]"
              style={{ width: `${progress}%` }}
            />
            <span
              aria-hidden="true"
              className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent transition-[left] duration-700 ease-[cubic-bezier(0.22,0.61,0.36,1)]"
              style={{ left: `${progress}%` }}
            />
          </div>
          <span className="shrink-0 text-[12px] tabular-nums text-faint">
            {step + 1} / {QUESTIONS.length}
          </span>
        </div>

        {/*
          A way out that is not "answer fifteen questions".

          For a first-time visitor `/` IS this flow, so without an explicit
          escape there was no route to the rest of the site — the logo leads
          back here, and skipping every question one at a time is not a
          browsing experience. Writing an empty answer set marks them as asked
          and lands them on the generic feed.
        */}
        <p className="mt-6 text-[12.5px] text-faint">
          <button
            type="button"
            onClick={browseInstead}
            className="underline decoration-line underline-offset-4 transition-colors hover:text-mute hover:decoration-mute"
          >
            Skip all this and just browse the archive
          </button>
        </p>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- reveal */

/** The payoff beat between the last answer and the feed. */
/**
 * The beat between the last answer and the feed.
 *
 * Says something different when nothing was answered: claiming to have "a
 * sense of your India" from an empty form would be a small lie, and the page
 * that follows is the whole archive rather than a personal one.
 */
function Reveal({ personal }: { personal: boolean }) {
  return (
    <div
      className="grid min-h-[calc(100dvh-4rem)] place-items-center px-6 text-center"
      role="status"
      aria-live="polite"
    >
      <div>
        <p className="eyebrow reveal-a">
          {personal ? 'We\u2019ve got a sense of your India.' : 'No questions, then.'}
        </p>
        <p className="reveal-b mt-5 font-display text-[30px] leading-tight font-light sm:text-[44px]">
          {personal ? 'Your archive is ready.' : 'Here is the whole archive.'}
        </p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- backdrop */

/**
 * Real archive footage behind the interface.
 *
 * Heavily blurred and dimmed: it should register as depth and colour, never as
 * a picture competing with the question. Uses Thumbnail so it inherits the
 * grey-placeholder fallback rather than risking a blank rectangle.
 */
function QuestionBackdrop({ clipId, step }: { clipId?: string; step: number }) {
  const washes = [
    'rgba(22,58,42,0.5)',
    'rgba(26,64,46,0.46)',
    'rgba(18,52,48,0.46)',
    'rgba(44,58,28,0.42)',
    'rgba(58,48,22,0.4)',
  ];

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/*
        Opacity is inline, not a utility class. `.fade-in`'s keyframes end at
        opacity:1 with fill-mode both, which beat the utility and rendered the
        backdrop at full strength — a bright bus photo washing out the whole
        question. Wrapping the dimming in its own element keeps the two
        concerns apart.
      */}
      {clipId && (
        <div className="absolute inset-0" style={{ opacity: 0.14 }}>
          <Thumbnail
            key={clipId}
            videoId={clipId}
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
          />
        </div>
      )}

      {/* Keeps type legible whatever the frame behind happens to be. */}
      <div className="absolute inset-0 bg-ink/70" />
      <div
        className="absolute inset-0 transition-[background] duration-[1400ms] ease-out"
        style={{
          background: `radial-gradient(75% 60% at 50% 45%, ${washes[step % washes.length]}, transparent 72%)`,
        }}
      />
      <div className="grain absolute inset-0" />
    </div>
  );
}
