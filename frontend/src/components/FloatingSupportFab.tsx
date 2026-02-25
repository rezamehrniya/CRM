import { MessageCircle } from 'lucide-react';

const SUPPORT_URL = 'https://wa.me/989374925125';

export default function FloatingSupportFab() {
  return (
    <a
      href={SUPPORT_URL}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="پشتیبانی ساختار در واتساپ"
      className="fixed bottom-5 left-5 z-[70] flex items-center gap-2 group"
    >
      <span className="rounded-full border border-emerald-200 bg-white/95 px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-lg backdrop-blur transition-transform duration-200 group-hover:-translate-y-0.5">
        پشتیبانی ساختار
      </span>
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl ring-4 ring-emerald-200/70 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:bg-emerald-600 group-hover:ring-emerald-300/80">
        <MessageCircle className="size-5" aria-hidden />
      </span>
    </a>
  );
}
