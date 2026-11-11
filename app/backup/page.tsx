export default function BackupPage() {
  const card = 'rounded-2xl border border-line bg-white p-6 shadow-card';
  const btn = 'mt-4 inline-flex h-11 items-center rounded-lg bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-strong';
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-canvas text-ink">
      <main className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-8">
        <div>
          <h1 className="text-3xl font-semibold">Backup &amp; change log</h1>
          <p className="mt-1.5 text-ink-2">Downloads are named with the date and time, so older copies are never overwritten.</p>
        </div>
        <section className={card}>
          <h2 className="text-lg font-semibold">Full Excel backup</h2>
          <p className="mt-1 text-sm text-ink-2">
            Sheets: Summary, Faculty, Sessions, Topics, Faculty-Topics, Chairpersons, Coordinators, Confirmations, Missing data.
          </p>
          <a href="/api/backup" className={btn}>Download backup (.xlsx)</a>
        </section>
        <section className={card}>
          <h2 className="text-lg font-semibold">Change log</h2>
          <p className="mt-1 text-sm text-ink-2">
            One sheet per day: who confirmed, topics added or edited, chairpersons added, faculty added or removed.
          </p>
          <a href="/api/changelog-export" className={btn}>Download change log (.xlsx)</a>
        </section>
      </main>
    </div>
  );
}
