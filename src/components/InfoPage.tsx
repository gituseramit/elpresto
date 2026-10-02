import Link from "next/link";
import { ArrowLeft, ArrowRight, Phone } from "lucide-react";

export interface InfoSection {
  title: string;
  paragraphs: string[];
}

export default function InfoPage({
  eyebrow,
  title,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: InfoSection[];
}) {
  return (
    <main className="min-h-[70vh] bg-[#fbf7f1] px-4 py-10 sm:py-16">
      <article className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-[0_20px_60px_-35px_rgba(55,34,21,0.28)]">
        <div className="bg-[#211712] px-6 py-8 text-white sm:px-10 sm:py-11">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-white/70 transition hover:text-white">
            <ArrowLeft size={16} aria-hidden="true" /> Home
          </Link>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">{intro}</p>
        </div>

        <div className="space-y-8 px-6 py-8 sm:px-10 sm:py-10">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-extrabold text-gray-950">{section.title}</h2>
              <div className="mt-2 space-y-3 text-sm leading-7 text-gray-600">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}

          <div className="flex flex-col gap-3 border-t border-orange-100 pt-6 sm:flex-row">
            <Link href="/menu" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D92312] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#B8190B]">
              Browse the menu <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <a href="tel:+916392512314" className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-800 transition hover:border-orange-300 hover:bg-orange-50">
              <Phone size={16} aria-hidden="true" /> Call +91 63925 12314
            </a>
          </div>
        </div>
      </article>
    </main>
  );
}
