const { Pool } = require("pg");
const pool = new Pool({
  host: "127.0.0.1",
  port: 55432,
  database: "dryerdb",
  user: "dryer",
  password: "dryer123",
});

async function run() {
  const res = await pool.query(`
    SELECT sl.sensor_id, sd.sensor_type, sd.dry_id, sl.last_value, sl.updated_at
    FROM sensor_latest sl
    JOIN sensor_device sd ON sd.sensor_id = sl.sensor_id
    WHERE sd.dry_id IN (2, 3, 4)
    ORDER BY sd.dry_id, sd.sensor_type
  `);
  console.table(res.rows);
  await pool.end();
}

run().catch(console.error);
