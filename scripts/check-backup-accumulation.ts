import '../server/env.js';
import { sql } from '../server/db.js';

async function main() {
  if (!sql) {
    console.log(JSON.stringify({ error: 'DATABASE_URL missing' }));
    return;
  }

  const totals = await sql`
    select
      (select count(*)::int from progress_notes) as progress_notes_count,
      (select count(*)::int from progress_note_backups) as backups_count,
      (select count(*)::int from progress_note_backups where jsonb_array_length(snapshot)=0) as empty_backups_count
  `;

  const topMolds = await sql`
    select
      mold_number,
      count(*)::int as backups,
      max(created_at) as latest
    from progress_note_backups
    group by mold_number
    order by backups desc, mold_number asc
    limit 10
  `;

  const recentDaily = await sql`
    select
      to_char(created_at::date, 'YYYY-MM-DD') as day,
      count(*)::int as backups
    from progress_note_backups
    where created_at >= now() - interval '14 day'
    group by created_at::date
    order by created_at::date desc
  `;

  console.log(JSON.stringify({
    totals: totals[0],
    topMolds,
    recentDaily,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
