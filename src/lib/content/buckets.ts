// Content buckets and visual types for the Circle content strategist. Kept in
// their own file so the Content tab (a client component) can import the labels
// without pulling in the server-side generator.

// Pillars are defined by the JOB a post does (the Circle admin's framework).
// Topics (delegation, freedom, systems...) are a separate tag: the same topic
// can show up in every pillar, doing a different job each time.
export const BUCKETS = ['coaching', 'pearls', 'transformation', 'proof', 'coach', 'experience'] as const
export type Bucket = (typeof BUCKETS)[number]

export const BUCKET_LABEL: Record<Bucket, string> = {
  coaching: 'Coaching',
  pearls: 'Gogo POV / Pearls',
  transformation: 'Member Transformation',
  proof: 'Proof / Testimonial',
  coach: 'Gogo as the Coach',
  experience: 'The Circle Experience',
}

/** One line: what this pillar's post is saying. */
export const BUCKET_SAYS: Record<Bucket, string> = {
  coaching: '"You have this problem."',
  pearls: '"This is how Gogo thinks about it."',
  transformation: '"Someone like you changed this."',
  proof: '"Here is evidence it worked."',
  coach: '"This is what it feels like to have HER coach you."',
  experience: '"This is what you get access to by being IN this program."',
}

/** The job, what belongs, and what does NOT belong, per pillar. */
export const PILLARS: Record<Bucket, { job: string; belongs: string; not: string }> = {
  coaching: {
    job: 'Make the ideal Circle person recognize a problem in their own business and see that Gogo understands it.',
    belongs: 'Pain-led posts about delegation, overwork, systems, leadership, money vs freedom, bottlenecks, next-level decisions, multiple income streams, etc.',
    not: 'Member stories, testimonials, behind the scenes of Gogo, program features.',
  },
  pearls: {
    job: "Establish Gogo's way of thinking and make people want access to her brain.",
    belongs: 'Actual quotes, strong questions, analogies, mindset shifts, or "Gogo said this on a call and it changes how you see the problem" moments.',
    not: "Generic teaching rewritten in Gogo's tone. It must come from something she actually said or clearly teaches.",
  },
  transformation: {
    job: "Help the audience see themselves in someone else's journey and imagine what could change for them.",
    belongs: 'Anonymous before, problem, what changed, what they are building now stories. Big-picture transformation only.',
    not: '"Member completed homework", attended every call, finished a task, etc.',
  },
  proof: {
    job: 'Remove doubt by showing evidence that the coaching works.',
    belongs: 'Direct member testimonials, measurable results, quotes from members, screenshots, video testimonial clips, specific wins with permission, endorsements.',
    not: "A narrated case study where we tell the member's story ourselves. That is a Member Transformation.",
  },
  coach: {
    job: 'Sell Gogo herself. Make the viewer understand what it FEELS like to be coached by her and why she is different.',
    belongs: 'Behind-the-scenes coaching moments, her directness, personality, reactions, questions, challenging ideas, looking at the numbers, telling someone what needs to change.',
    not: 'General Gogo quotes with no coaching interaction. Those are Pearls.',
  },
  experience: {
    job: 'Sell the actual environment and access someone gets by joining The Circle.',
    belongs: 'Caliber of members, $1.6B+ combined experience, private conversations, direct access, team support, the calls, peer learning, confidentiality, "a seat at the table", what makes this room different.',
    not: "General business advice or a member's personal result.",
  },
}

// Topics: WHAT a post is about (any pillar can carry any topic).
export const TOPICS = [
  'delegation', 'freedom', 'systems', 'wealth', 'leadership', 'time', 'team', 'mindset',
  'investments', 'multiple income streams', 'next-level identity', 'money vs freedom', 'the room',
] as const
export type Topic = (typeof TOPICS)[number]

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
