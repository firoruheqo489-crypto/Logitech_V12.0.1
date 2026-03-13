import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

function normalizeDate(input) {
  if (!input) return new Date().toISOString().slice(0, 10);
  const s = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    const month = String(Number(m[1])).padStart(2, '0');
    const day = String(Number(m[2])).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return new Date().toISOString().slice(0, 10);
}

try {
  const mold = 'LA26006';

  const existing = await sql.unsafe(`select count(*)::int as c from progress_notes where mold_number='${mold}'`);
  if (existing[0]?.c > 0) {
    console.log(`已有 ${existing[0].c} 条记录，未执行回填。`);
    process.exit(0);
  }

  const rows = await sql.unsafe(`select mold_id, update_date, progress_details from dashboard_projects where mold_id='${mold}' limit 1`);
  if (!rows.length) {
    console.log('dashboard_projects中未找到该模具，无法回填。');
    process.exit(1);
  }

  const r = rows[0];
  const content = (r.progress_details || '').trim();
  if (!content) {
    console.log('原始推进细节为空，无法回填。');
    process.exit(1);
  }

  const id = `recover_${Date.now()}`;
  const date = normalizeDate(r.update_date);

  await sql.unsafe(
    `insert into progress_notes (id, mold_number, date, content) values ($1,$2,$3,$4)`,
    [id, mold, date, content]
  );

  const check = await sql.unsafe(`select id,mold_number,date,left(content,120) as content_preview,created_at from progress_notes where mold_number='${mold}' order by created_at desc limit 1`);
  console.log('已回填：');
  console.table(check);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
