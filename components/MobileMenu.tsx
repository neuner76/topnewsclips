'use client'

import Link from 'next/link'
import { useState } from 'react'

const LINKS = [
  { href: '/feed', label: "Today's Digest" },
  { href: '/clips', label: 'Clips' },
  { href: '/stories', label: 'Archive' },
  { href: '/about', label: 'About' },
]

export default function MobileMenu() {
  const [open, setOpen] = useState(false)

  return (
    <div className="sm:hidden relative">
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-center p-1 text-[#334155] hover:text-[#0F172A] transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {open ? (
            <>
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </>
          ) : (
            <>
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-[#E2E8F0] bg-white shadow-lg py-1 z-50">
            {LINKS.map(l => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm font-medium text-[#334155] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
