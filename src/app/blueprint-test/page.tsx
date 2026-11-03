import type { Metadata } from 'next'
import TestForm from './TestForm'

export const metadata: Metadata = {
  title: 'The Blueprint Test · Gogo Bethke',
  description: 'Find out where you stand on time, location and financial freedom, and what is really holding your business back.',
}

export default function BlueprintTestPage() {
  return <TestForm />
}
