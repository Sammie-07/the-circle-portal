'use client'

import { createClient } from '@/lib/supabase/client'

// Shown when someone is signed in with an email that matches no member record.
// The old copy ("your profile is being set up, check back soon") was a dead end:
// it never resolves on its own, and there was no way to sign out and retry with
// the right address, so members sat there waiting. This explains the actual
// situation and gives them a way forward.
export default function UnrecognizedAccount({ email }: { email: string | null | undefined }) {
  async function signOut() {
    await createClient().auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="p-4 sm:p-8 flex justify-center">
      <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-xl max-w-md w-full p-8 text-center">
        <div className="w-12 h-12 rounded-full border-2 border-[#C9A227]/40 flex items-center justify-center mx-auto mb-5">
          <span className="text-[#C9A227] text-xl">?</span>
        </div>
        <h1 className="text-[var(--text)] font-serif text-2xl mb-3">We don&apos;t recognize this email</h1>
        <p className="text-[var(--text-2)] text-sm leading-relaxed">
          You&apos;re signed in as{' '}
          <span className="text-[var(--text)] break-all">{email ?? 'this account'}</span>, but that
          address isn&apos;t on any member profile. If you have more than one email, sign out and use
          the one your Circle invitation was sent to.
        </p>
        <button
          onClick={signOut}
          className="mt-6 bg-[#C9A227] text-[#090909] text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-[#d4ac2d] transition-colors"
        >
          Sign out and try another email
        </button>
        <p className="text-[var(--text-3)] text-xs mt-5">
          Still stuck? Message your coach and we&apos;ll get you in.
        </p>
      </div>
    </div>
  )
}
