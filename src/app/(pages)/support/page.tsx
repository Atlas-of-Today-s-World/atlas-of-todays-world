import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support the Atlas",
  description:
    "Join the membership community and help build an independent encyclopedia of the present.",
  alternates: { canonical: "/support" },
};

const CARDS = [
  {
    title: "Help Us Build Atlas",
    text: "Help build the encyclopedia and power its long-term, independent future through a strong membership community.",
  },
  {
    title: "Participate on Its Development",
    text: "Create content. Build powerful partnerships. Drive global impact.",
  },
  {
    title: "Join Our Community",
    text: "Connect with our team, members, and future authors and partners.",
  },
];

export default function SupportPage() {
  return (
    <main className="max-w-2xl">
      <h1 className="font-display text-[34px] font-bold">
        Together We Can Build a New Encyclopedia
      </h1>
      <p className="mt-4 text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
        By joining our membership community, you support Atlas development and
        gradually secure its independent funding. And you can directly
        participate in the development.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {CARDS.map((card, index) => (
          <div
            key={card.title}
            className="rounded-xl border border-[var(--color-line)] p-5"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-line)] text-[12px] text-[var(--color-ink-muted)]">
              {index + 1}
            </span>
            <h2 className="mt-3 font-display text-[15px] font-bold">
              {card.title}
            </h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
              {card.text}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-8 text-[12.5px] text-[var(--color-ink-muted)]">
        Napojení platební brány (Stripe / Darujme.cz) zatím není součástí MVP.
      </p>
    </main>
  );
}
