'use client'

import { useState } from 'react'
import Link from 'next/link'

interface ReportRow {
  id: string
  period_type: string
  period_label: string
  generated_at: string
  sent_at: string | null
  content_html: string | null
  member: { id: string; name: string; email: string } | null
}

interface Props {
  reports: ReportRow[]
}

const PERIOD_LABEL: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Annual',
}

export default function AdminReportsTable({ reports }: Props) {
  const [previewId, setPreviewId] = useState<string | null>(null)

  if (reports.length === 0) {
    return (
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded p-8 text-center">
        <p className="text-[#555] text-sm">No reports generated yet.</p>
        <p className="text-[#444] text-xs mt-2">Open a member&apos;s profile to generate their first report.</p>
      </div>
    )
  }

  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2A2A2A]">
            <th className="text-left px-5 py-3 text-[#555] text-xs uppercase tracking-wider font-normal">Member</th>
            <th className="text-left px-5 py-3 text-[#555] text-xs uppercase tracking-wider font-normal">Period</th>
            <th className="text-left px-5 py-3 text-[#555] text-xs uppercase tracking-wider font-normal">Type</th>
            <th className="text-left px-5 py-3 text-[#555] text-xs uppercase tracking-wider font-normal">Generated</th>
            <th className="text-left px-5 py-3 text-[#555] text-xs uppercase tracking-wider font-normal">Status</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2A2A2A]">
          {reports.map((report) => (
            <>
              {/* Main row */}
              <tr key={report.id} className={`transition-colors ${previewId === report.id ? 'bg-[#111]' : 'hover:bg-[#111]'}`}>
                <td className="px-5 py-4">
                  {report.member ? (
                    <Link
                      href={`/admin/member/${report.member.id}`}
                      className="text-white hover:text-[#C9A227] transition-colors"
                    >
                      {report.member.name}
                    </Link>
                  ) : (
                    <span className="text-[#555]">Unknown</span>
                  )}
                </td>
                <td className="px-5 py-4 text-[#888]">{report.period_label}</td>
                <td className="px-5 py-4">
                  <span className="text-[10px] bg-[#2A2A2A] text-[#555] px-2 py-0.5 rounded uppercase tracking-wider">
                    {PERIOD_LABEL[report.period_type] ?? report.period_type}
                  </span>
                </td>
                <td className="px-5 py-4 text-[#555] text-xs">
                  {new Date(report.generated_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </td>
                <td className="px-5 py-4">
                  {report.sent_at ? (
                    <span className="flex items-center gap-1.5 text-green-500 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      Sent
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[#555] text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#555]" />
                      Draft
                    </span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-3">
                    {report.content_html && (
                      <button
                        onClick={() => setPreviewId(previewId === report.id ? null : report.id)}
                        className={`text-xs border px-2.5 py-1 rounded transition-colors ${
                          previewId === report.id
                            ? 'border-[#C9A227]/50 text-[#C9A227] bg-[#C9A227]/8'
                            : 'border-[#2A2A2A] text-[#555] hover:text-[#888] hover:border-[#444]'
                        }`}
                      >
                        {previewId === report.id ? 'Hide' : 'Preview'}
                      </button>
                    )}
                    {report.member && (
                      <Link
                        href={`/admin/member/${report.member.id}`}
                        className="text-xs text-[#555] hover:text-[#C9A227] transition-colors"
                      >
                        Manage →
                      </Link>
                    )}
                  </div>
                </td>
              </tr>

              {/* Inline preview row */}
              {previewId === report.id && report.content_html && (
                <tr key={`${report.id}-preview`}>
                  <td colSpan={6} className="p-0">
                    <div className="border-t border-[#2A2A2A]">
                      {/* Preview header */}
                      <div className="bg-[#111] px-5 py-2.5 border-b border-[#2A2A2A] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-[#C9A227] text-[10px] tracking-[0.2em] uppercase">
                            Preview
                          </span>
                          <span className="text-[#333]">·</span>
                          <span className="text-[#555] text-xs">
                            {report.member?.name} — {report.period_label}
                          </span>
                          {report.sent_at && (
                            <>
                              <span className="text-[#333]">·</span>
                              <span className="text-green-400 text-xs">
                                Sent {new Date(report.sent_at).toLocaleDateString('en-US', {
                                  month: 'short', day: 'numeric', year: 'numeric',
                                })}
                              </span>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => setPreviewId(null)}
                          className="text-[#444] hover:text-[#888] text-xs transition-colors"
                        >
                          ✕ Close
                        </button>
                      </div>
                      {/* Report HTML */}
                      <div
                        className="bg-[#0D0D0D] px-8 py-6 max-h-[600px] overflow-y-auto text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: report.content_html }}
                      />
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}
