// Cek koneksi DB: `npm run db:check` (dev: jalankan `npm run db:tunnel` dulu)
import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 10 });
  try {
    const [r] = await sql`
      select current_database() as db, current_user as u,
             current_setting('server_version') as v, pg_is_in_recovery() as standby`;
    console.log(`OK  db=${r.db} user=${r.u} postgres=${r.v} ${r.standby ? "(STANDBY!)" : "(primary)"}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("Gagal konek DB:", err.message);
  process.exit(1);
});
