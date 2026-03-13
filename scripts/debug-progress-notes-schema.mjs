import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

try {
  const cols = await sql.unsafe("select column_name,data_type,character_maximum_length from information_schema.columns where table_name='progress_notes' order by ordinal_position");
  console.log('COLUMNS');
  console.table(cols);

  const sample = await sql.unsafe("select id,mold_number,date,length(content) as len, created_at from progress_notes order by created_at desc limit 10");
  console.log('LATEST_ROWS');
  console.table(sample);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
