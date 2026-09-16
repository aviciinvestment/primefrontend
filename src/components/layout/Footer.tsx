export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#070e0a]/70">
      <div className="section-shell flex flex-col items-center justify-between gap-3 py-8 text-center md:flex-row md:text-left">
        <p className="text-xs text-gray-500">
          &copy; 2026 PrimeOpportunity. All rights reserved.
        </p>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-gray-600">
          <span className="h-px w-4 bg-white/10" aria-hidden="true"></span>
          Built for students, by students
        </div>
      </div>
    </footer>
  );
}
