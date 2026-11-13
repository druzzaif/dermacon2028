import { DownloadIcon } from '../components/Icons';
import { PageHeader, PageShell, buttonCls, cardCls } from '../components/ui';

const downloads = [
  {
    title: 'Full Excel backup',
    description: 'Every table in one workbook, so the whole programme can be restored or checked offline.',
    detail: 'Sheets: Summary, Faculty, Sessions, Topics, Faculty-Topics, Chairpersons, Coordinators, Confirmations, Missing data.',
    href: '/api/backup',
    button: 'Download backup (.xlsx)',
  },
  {
    title: 'Change log',
    description: 'A record of what changed and when, with one sheet per day.',
    detail: 'Who confirmed, topics added or edited, chairpersons added, faculty added or removed.',
    href: '/api/changelog-export',
    button: 'Download change log (.xlsx)',
  },
];

export default function BackupPage() {
  return (
    <PageShell narrow>
      <PageHeader
        title="Backup"
        description="Download copies of your data. Files are named with the date and time, so older copies are never overwritten."
      />
      <div className="space-y-4">
        {downloads.map((d) => (
          <section key={d.title} className={`${cardCls} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6`}>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-ink">{d.title}</h2>
              <p className="mt-1 text-sm text-ink-2">{d.description}</p>
              <p className="mt-2 text-xs text-muted">{d.detail}</p>
            </div>
            <a href={d.href} className={buttonCls('primary', 'md', 'shrink-0')}>
              <DownloadIcon /> {d.button}
            </a>
          </section>
        ))}
      </div>
      <p className="mt-5 text-sm text-ink-2">
        Your browser saves the file to its usual Downloads folder. Keep a recent copy somewhere other than this computer.
      </p>
    </PageShell>
  );
}
