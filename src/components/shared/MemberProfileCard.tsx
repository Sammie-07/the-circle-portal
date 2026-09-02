interface MemberProfileCardProps {
  name: string
  email?: string | null
  cohort?: string | null
  joinDate?: string | null
  city?: string | null
  instagram?: string | null
  website?: string | null
  bio?: string | null
  headshotUrl?: string | null
  membershipStatus?: string | null
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatJoinDate(joinDate?: string | null): string | null {
  if (!joinDate) return null
  const d = new Date(joinDate)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function normalizeWebsite(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase()
  if (s === 'active') return 'bg-green-500/10 text-green-400 border-green-500/30'
  if (s === 'paused') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
  if (s === 'cancelled' || s === 'canceled') return 'bg-red-500/10 text-[#CC1F1F] border-red-500/30'
  return 'bg-[var(--input-bg)] text-[var(--text-3)] border-[var(--border-color)]'
}

export default function MemberProfileCard({
  name,
  email,
  cohort,
  joinDate,
  city,
  instagram,
  website,
  bio,
  headshotUrl,
  membershipStatus,
}: MemberProfileCardProps) {
  const since = formatJoinDate(joinDate)
  const handle = instagram?.trim().replace(/^@/, '') || null

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-2xl p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
        {/* Headshot */}
        <div className="shrink-0">
          {headshotUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={headshotUrl}
              alt={name}
              className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover ring-2 ring-[#C9A227]/60"
            />
          ) : (
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl flex items-center justify-center bg-[#C9A227]/10 ring-2 ring-[#C9A227]/40">
              <span className="text-[#C9A227] font-serif text-[38px]">{getInitials(name)}</span>
            </div>
          )}
        </div>

        {/* Main */}
        <div className="min-w-0 flex-1">
          {cohort && (
            <p className="text-[var(--gold-text)] text-[10px] tracking-[0.28em] uppercase mb-1.5">{cohort}</p>
          )}
          <h1 className="text-[var(--text)] font-serif text-[38px] leading-tight">{name}</h1>
          {email && <p className="text-[var(--text-3)] text-sm mt-1">{email}</p>}

          {/* Key info chips */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm text-[var(--text-2)]">
            {since && <span>Member since {since}</span>}
            {city && (
              <>
                {since && <span className="text-[var(--text-4)]">·</span>}
                <span>{city}</span>
              </>
            )}
            {membershipStatus && (
              <span className={`px-2 py-0.5 rounded-full border text-xs capitalize ${statusBadgeClass(membershipStatus)}`}>
                {membershipStatus}
              </span>
            )}
          </div>

          {/* Social links */}
          {(handle || website) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-sm">
              {handle && (
                <a
                  href={`https://instagram.com/${handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#C9A227] hover:text-[#d4ac2d] transition-colors"
                >
                  @{handle}
                </a>
              )}
              {website && (
                <a
                  href={normalizeWebsite(website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#C9A227] hover:text-[#d4ac2d] transition-colors break-all"
                >
                  {website.replace(/^https?:\/\//i, '')}
                </a>
              )}
            </div>
          )}

          {/* Bio */}
          <div className="mt-4 pt-4 border-t border-[var(--border-color)]/50">
            {bio?.trim() ? (
              <p className="text-[var(--text-2)] leading-relaxed whitespace-pre-wrap">{bio}</p>
            ) : (
              <p className="text-[var(--text-4)] italic">No bio yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
