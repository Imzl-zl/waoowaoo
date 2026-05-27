'use client'

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Navbar from '@/components/Navbar'
import { AppIcon } from '@/components/ui/icons'
import { useProjectData } from '@/lib/query/hooks'
import { Link } from '@/i18n/navigation'
import WorkflowBuilderShell from './components/WorkflowBuilderShell'

export default function ProjectWorkflowsPage() {
  const params = useParams<{ projectId?: string }>()
  if (!params?.projectId) throw new Error('ProjectWorkflowsPage requires projectId route param')
  const projectId = params.projectId
  const t = useTranslations('workflowBuilder')
  const projectQuery = useProjectData(projectId)
  const projectName = projectQuery.data?.name || ''

  return (
    <div className="glass-page min-h-screen">
      <Navbar />
      <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-5 lg:px-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <Link
              href={{ pathname: `/workspace/${projectId}` }}
              className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-[var(--glass-text-tertiary)] hover:text-[var(--glass-text-primary)]"
            >
              <AppIcon name="chevronLeft" className="h-4 w-4" />
              {t('back')}
            </Link>
            <div className="flex min-w-0 items-center gap-3">
              <span className="glass-chip glass-chip-info shrink-0">
                <AppIcon name="cpu" className="h-4 w-4" />
                {t('pageTitle')}
              </span>
              <h1 className="truncate text-2xl font-bold text-[var(--glass-text-primary)]">
                {projectName || t('loading')}
              </h1>
            </div>
          </div>
        </header>
        {projectQuery.isLoading ? (
          <div className="glass-surface p-6 text-sm text-[var(--glass-text-secondary)]">{t('loading')}</div>
        ) : projectQuery.error ? (
          <div className="glass-surface border-[var(--glass-stroke-danger)] p-6 text-sm text-[var(--glass-tone-danger-fg)]">
            {t('loadFailed')}
          </div>
        ) : (
          <WorkflowBuilderShell projectId={projectId} />
        )}
      </main>
    </div>
  )
}
