import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

try {
  const notes = await sql.unsafe(`
    select mold_number, id, date, left(content, 120) as content_preview, created_at
    from progress_notes
    where mold_number in ('LA26006','LA26007','LA26012','LA26013')
    order by mold_number, created_at desc
  `);
  console.log('=== progress_notes (重点项目) ===');
  console.table(notes);

  const cards = await sql.unsafe(`
    select mold_id, update_date, left(progress_details, 200) as progress_details
    from dashboard_projects
    where mold_id in ('LA26006','LA26007','LA26012','LA26013')
    order by mold_id
  `);
  console.log('=== dashboard_projects 原始细节 ===');
  console.table(cards);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
