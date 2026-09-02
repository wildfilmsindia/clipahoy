import { Suspense } from 'react';

import { ContactForm } from '@/components/ContactForm';

/*
 * Contact.
 *
 * Mirrors the contact section on wildfilmsindia.com — the same heading, the
 * same standfirst about production plans in India, and the same form posting
 * to the same inbox. Laid out in Clipahoy's tokens for the same reason the
 * About page is.
 */

export const metadata = {
  title: 'Contact',
  description:
    'Make us part of your production plans in India — production, gear, location, support services and stock footage.',
};

export default function ContactPage() {
  return (
    <main className="shell pt-8 pb-20 sm:pt-12">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="rise">
          <p className="eyebrow">Contact — Wilderness Films India</p>
          <h1 className="mt-2 font-display text-[38px] leading-[1.04] font-light tracking-[-0.015em] sm:text-[54px]">
            Let&rsquo;s share
            <br />
            <span className="text-accent italic">India&rsquo;s madness</span>
          </h1>

          <div aria-hidden="true" className="mt-6 flex items-center gap-2">
            <span className="h-px w-9 bg-accent/55" />
            <span className="h-px w-2 bg-accent/20" />
          </div>

          <p className="mt-6 max-w-md text-[15px] leading-[1.9] text-mute">
            Make us part of your production plans in India. We deliver the widest range of
            production, gear, location, support services and stock footage. We can open doors that
            no one else can. And yes, while some of us have a weakness for wildlife, wilderness and
            the outdoors, we do produce programming on just about every subject under the sun!
          </p>
          <p className="mt-4 max-w-md text-[15px] leading-[1.9] text-mute">
            We invite content creators to reach out for our commercial production partnerships.
          </p>
        </div>

        <div className="rise" style={{ animationDelay: '80ms' }}>
          {/* ContactForm reads ?subject via useSearchParams, which needs a
              boundary; the fallback holds the form's height so the two-column
              layout does not jump as it arrives. */}
          <Suspense fallback={<div className="panel h-[520px]" />}>
            <ContactForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
