import PasswordSetupFlow from '@/components/PasswordSetupFlow'

export const dynamic = 'force-dynamic'

// Self-contained: verify email by code, then choose a password. Reachable both
// unauthenticated (from an invite/reset link) and authenticated (already verified).
export default function SetPasswordPage() {
  return <PasswordSetupFlow />
}
