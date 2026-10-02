// Content buckets and visual types for the Circle content strategist. Kept in
// their own file so the Content tab (a client component) can import the labels
// without pulling in the server-side generator.

export const BUCKETS = ['coaching', 'pearls', 'transformation', 'proof', 'room', 'coach'] as const
export type Bucket = (typeof BUCKETS)[number]

export const BUCKET_LABEL: Record<Bucket, string> = {
  coaching: 'Coaching',
  pearls: 'Gogo Pearls',
  transformation: 'Member Transformation',
  proof: 'Testimonial / Proof',
  room: 'The Room',
  coach: 'Gogo as the Coach',
}

// The emotion of the visual, so the right kind of Gogo photo/clip gets used.
export const VISUAL_TYPES = ['power', 'relatable', 'coaching', 'speaking', 'listening', 'table', 'lifestyle', 'team', 'broll'] as const
export type VisualType = (typeof VISUAL_TYPES)[number]

export const VISUAL_LABEL: Record<VisualType, string> = {
  power: 'Gogo, powerful / boss energy',
  relatable: 'Gogo laughing / relatable',
  coaching: 'Gogo coaching',
  speaking: 'Gogo speaking',
  listening: 'Gogo listening',
  table: 'Gogo at the table with entrepreneurs',
  lifestyle: 'Gogo lifestyle / freedom',
  team: 'Gogo working with her team',
  broll: 'B-roll for a mindset Reel',
}
