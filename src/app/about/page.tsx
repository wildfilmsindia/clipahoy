import Link from 'next/link';

/*
 * About us.
 *
 * The content mirrors wildfilmsindia.com/about — same mission text, same four
 * figures, same "What We Do" trio, the same managing-director biography and
 * the same conservation sites. Only "Our People" is left out, because the
 * roster is photographs of staff and belongs to the parent company's site
 * rather than to this one.
 *
 * Rendered in Clipahoy's own tokens rather than copied markup: the main site
 * is inline-styled framer-motion in a gold-on-black palette, and pasting that
 * in would have produced a page that looks like a different product.
 */

export const metadata = {
  title: 'About us',
  description:
    "Wilderness Films India has spent 37 years building South Asia's largest factual visual archive.",
};

const STATS = [
  { figure: '150,000+', label: 'Hours of video content' },
  { figure: '140,000+', label: 'Videos on YouTube' },
  { figure: '5 Million+', label: 'YouTube subscribers' },
  { figure: '37+', label: 'Years of experience' },
];

const VALUES = [
  {
    title: 'What we hold',
    body: 'Our collection spans wildlife, landscapes, culture, communities, heritage, and current affairs — built over decades and continuously growing.',
  },
  {
    title: 'What we create',
    body: 'Factual films and visual content for television, digital platforms, and institutions. Documentary production, footage licensing, and short-form storytelling.',
  },
  {
    title: 'Why it matters',
    body: 'Many Indians did not know their own country. We document India honestly — its heritage, culture, landscapes, and living histories — for Indians and the world.',
  },
];

const SITES = [
  {
    location: 'Jabbarkhet Estate, Uttarakhand',
    name: 'The Haunted House',
    desc: 'A heritage woodland estate in the foothills of the Himalayas — home to leopards, Himalayan black bears, and over 200 species of birds.',
  },
  {
    location: 'Motidhar Valley, Uttarakhand',
    name: 'Mountain Quail Estate',
    desc: 'Named for the tragically extinct Mountain Quail last recorded here in 1876 — a sanctuary dedicated to oak forest restoration.',
  },
  {
    location: 'New Delhi',
    name: 'Wilderness Orchard',
    desc: 'An urban biodiversity island in the heart of the capital — demonstrating that wilderness can exist anywhere if you choose to let it.',
  },
];

export default function AboutPage() {
  return (
    <main className="shell pt-8 pb-20 sm:pt-12">
      {/* ============================================================ HERO */}
      <header className="rise rule-accent">
        <p className="eyebrow">Wilderness Films India — est. 1987</p>
        <h1 className="mt-2 max-w-3xl font-display text-[34px] leading-tight font-light text-balance sm:text-[46px]">
          About us
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-mute">
          People, places, monuments, traditions, cultures, wildlife, festivals, dances, music — and
          many more rabbit holes.
        </p>
      </header>

      {/* ========================================================= MISSION */}
      <section className="section-major max-w-3xl">
        <p className="text-[17px] leading-[1.85] font-light text-mute sm:text-[18px]">
          For over 37 years, we have been building South Asia&rsquo;s largest factual visual archive
          while producing films and visual stories that document India for posterity. From rare
          wildlife footage to cultural, environmental, and historical documentation, our work
          connects memory, storytelling, and moving images at scale — creating visual time capsules
          on just about everything South Asian.
        </p>

        {/*
          The house line for what the archive feels like to watch, rather than
          what it contains. Set as a pull quote because it is a claim about
          India, not a description of the company.
        */}
        <blockquote className="mt-8 border-l-2 border-accent pl-5">
          <p className="font-display text-[19px] leading-relaxed font-light text-paper italic sm:text-[22px]">
            Good, bad, or ugly; beautiful, awe-inspiring, or a complete pain — India comes strongly
            at you; it assaults the senses. Make it come alive for you at Clipahoy.
          </p>
        </blockquote>
      </section>

      {/* =========================================================== STATS */}
      <section className="section-major">
        <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line-soft bg-line-soft sm:grid-cols-4">
          {STATS.map((s) => (
            <li key={s.label} className="bg-ink px-5 py-7">
              <p className="font-display text-[28px] leading-none font-light text-accent tabular-nums sm:text-[36px]">
                {s.figure}
              </p>
              <p className="mt-2.5 text-[12.5px] leading-snug text-faint">{s.label}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ========================================================== VALUES */}
      <section className="section-major">
        <p className="eyebrow">What we do</p>
        <ul className="mt-7 grid grid-cols-1 gap-y-9 border-t border-line-soft pt-9 sm:grid-cols-3 sm:gap-x-10">
          {VALUES.map((v) => (
            <li key={v.title}>
              <h2 className="font-display text-[21px] leading-tight font-light">{v.title}</h2>
              <div aria-hidden="true" className="mt-3.5 h-px w-6 bg-accent/40" />
              <p className="mt-3.5 text-[14.5px] leading-[1.8] text-mute">{v.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ============================================== MANAGING DIRECTOR */}
      <section className="section-major">
        <p className="eyebrow">Managing director</p>
        <h2 className="mt-2 font-display text-[38px] leading-none font-light sm:text-[56px]">
          Rupin <span className="text-accent italic">Dang</span>
        </h2>
        <p className="mt-4 text-[13px] text-faint">
          Founder · Filmmaker · Mountaineer · Naturalist · Photographer · Entrepreneur
        </p>

        <blockquote className="mt-7 border-l-2 border-accent/40 pl-5">
          <p className="font-display text-[17px] leading-relaxed font-light text-mute italic sm:text-[20px]">
            Listed in the Limca Book of Records as the youngest filmmaker in India.
          </p>
        </blockquote>

        <div className="mt-9 grid grid-cols-1 gap-8 border-t border-line-soft pt-9 sm:grid-cols-2 sm:gap-14">
          <p className="text-[15px] leading-[1.9] text-mute">
            Rupin Dang is a curious blend of filmmaker, writer, mountaineer, naturalist,
            photographer &amp; entrepreneur. Listed in the Limca Book of Records at one time as the
            youngest filmmaker in India, Rupin subsequently studied and taught at Dartmouth College
            in New Hampshire.
          </p>
          <p className="text-[15px] leading-[1.9] text-mute">
            He founded Wilderness Films India in 1987 and has successfully established it as a
            leading broadcast and television services company in north India. Its greatest assets
            lie in an extensive archive of television and stills content — a library of South Asian
            footage unparalleled in subject matter and technical quality.
          </p>
        </div>
      </section>

      {/* ==================================================== CONSERVATION */}
      <section className="section-major">
        <p className="eyebrow">Beyond the lens</p>
        <h2 className="mt-2 max-w-2xl font-display text-[26px] leading-tight font-light text-balance sm:text-[34px]">
          Conservation sites &amp; <span className="text-accent italic">botanical arboreta</span>
        </h2>
        <p className="mt-4 max-w-lg text-[15px] leading-[1.85] text-mute">
          True to our brief, we now live and work out of our trio of botanical arboreta — in a
          sylvan orchard in Delhi, a trout valley surrounded by peony gardens in the western
          Himalaya and a high ridge in the oldest estate in the Himalaya, with views of the Ganga
          and snow peaks of Garhwal.
        </p>

        <ul className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-line-soft bg-line-soft sm:grid-cols-3">
          {SITES.map((s) => (
            <li key={s.name} className="bg-ink px-5 py-6">
              <p className="eyebrow">{s.location}</p>
              <p className="mt-2.5 font-display text-[19px] leading-tight font-light text-paper italic">
                {s.name}
              </p>
              <p className="mt-3 text-[13.5px] leading-relaxed text-mute">{s.desc}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ============================================================= CTA */}
      <section className="section-major">
        <div className="flex flex-wrap items-center justify-between gap-6 border-t border-line-soft pt-9">
          <div className="max-w-xl">
            <h2 className="font-display text-[22px] leading-tight font-light sm:text-[28px]">
              Looking for footage, a production partner,{' '}
              <span className="text-accent italic">or access to our archive?</span>
            </h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-mute">
              Get in touch to discuss licensing, collaborations, and commissions.
            </p>
          </div>
          <Link href="/contact" className="btn btn-primary shrink-0">
            Get in touch
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
