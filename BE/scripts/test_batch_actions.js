const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { query, pool } = require("../src/config/db");
const { processScheduledBatches } = require("../src/services/batchService");

async function runTest() {
  try {
    console.log("--- Batch Phase Device Action Verification Test ---");

    // 1. Check all control devices and their initial status for Dryer 2
    const initialControls = await query(
      "SELECT control_id, control_name, control_type, status, dry_id FROM control_device WHERE dry_id = 2 ORDER BY control_id"
    );
    console.log("Initial control devices for Dryer 2:");
    console.table(initialControls.rows);

    // 2. Check if there is an active running batch for Dryer 2
    let activeBatch = (await query(
      "SELECT batch_id, status, recipe_id FROM batch WHERE dry_id = 2 AND status = 'running'"
    )).rows[0];

    if (!activeBatch) {
      console.log("No running batch on Dryer 2. Checking for pending scheduled batch to start...");
      const pendingBatch = (await query(
        "SELECT batch_id, recipe_id FROM batch WHERE dry_id = 2 AND status = 'pending' AND operation_mode = 'scheduled'"
      )).rows[0];

      if (pendingBatch) {
        console.log(`Starting pending batch #${pendingBatch.batch_id} on Dryer 2...`);
        await query(
          "UPDATE batch SET status = 'running', start_time = NOW(), elapsed_seconds = 0 WHERE batch_id = $1",
          [pendingBatch.batch_id]
        );
        await query("UPDATE Dryer SET status = 'Running' WHERE dry_id = 2");
        activeBatch = pendingBatch;
      } else {
        console.log("No pending scheduled batch found either. Creating a mock scheduled batch on Dryer 2...");
        const fruitId = (await query("SELECT fruit_id FROM fruit LIMIT 1")).rows[0].fruit_id;
        const recipeId = (await query("SELECT recipe_id FROM recipe WHERE fruit_id = $1 LIMIT 1", [fruitId])).rows[0].recipe_id;

        const insertRes = await query(
          `INSERT INTO batch (dry_id, fruit_id, recipe_id, status, operation_mode, scheduled_delay_seconds, scheduled_start_time, elapsed_seconds)
           VALUES (2, $1, $2, 'running', 'scheduled', 0, NOW(), 0) RETURNING batch_id`,
          [fruitId, recipeId]
        );
        activeBatch = { batch_id: insertRes.rows[0].batch_id, recipe_id: recipeId };
        await query("UPDATE Dryer SET status = 'Running' WHERE dry_id = 2");
        console.log(`Created and started mock batch #${activeBatch.batch_id} on Dryer 2.`);
      }
    } else {
      console.log(`Active running batch #${activeBatch.batch_id} found on Dryer 2.`);
      console.log("Updating batch to scheduled running mode starting NOW...");
      await query(
        "UPDATE batch SET status = 'running', operation_mode = 'scheduled', start_time = NOW() - INTERVAL '2 seconds', elapsed_seconds = 0 WHERE batch_id = $1",
        [activeBatch.batch_id]
      );
    }

    // 3. Inspect the first phase of this batch's recipe and its phase actions
    const phases = await query(
      "SELECT phase_id, phase_order FROM phase WHERE recipe_id = $1 ORDER BY phase_order",
      [activeBatch.recipe_id]
    );
    
    if (phases.rows.length === 0) {
      console.error("Error: Recipe has no phases!");
      return;
    }
    const firstPhase = phases.rows[0];
    console.log(`First Phase of recipe #${activeBatch.recipe_id}:`, firstPhase);

    const phaseActions = await query(
      "SELECT action_id, control_id, action_type FROM phase_actions WHERE phase_id = $1",
      [firstPhase.phase_id]
    );
    console.log(`Configured actions for first phase (Phase ID: ${firstPhase.phase_id}):`);
    console.table(phaseActions.rows);

    if (phaseActions.rows.length === 0) {
      console.log("No actions configured in database for this phase. Inserting mock action...");
      const fanControl = initialControls.rows.find(c => c.control_type === 'fan');
      if (fanControl) {
        await query(
          "INSERT INTO phase_actions (phase_id, control_id, action_type, start_offset_seconds, duration_seconds) VALUES ($1, $2, 'activate', 0, 3600)",
          [firstPhase.phase_id, fanControl.control_id]
        );
        console.log(`Added phase action: activate control #${fanControl.control_id} (${fanControl.control_name}) for phase #${firstPhase.phase_id}`);
      }
    }

    console.log("Resetting Dryer 2 controls to 'inactive' to verify batch phase trigger...");
    await query("UPDATE control_device SET status = 'inactive' WHERE dry_id = 2");

    // Print time debugging info
    const dbBatch = (await query("SELECT start_time, status, operation_mode FROM batch WHERE batch_id = $1", [activeBatch.batch_id])).rows[0];
    const nodeNow = Date.now();
    const dbStartMs = new Date(dbBatch.start_time).getTime();
    console.log(`Time Debugging:
    - Node Date.now(): ${nodeNow} (${new Date(nodeNow).toISOString()})
    - DB start_time: ${dbBatch.start_time} (${new Date(dbBatch.start_time).toISOString()})
    - Offset (Node - DB start): ${Math.floor((nodeNow - dbStartMs) / 1000)} seconds
    - Batch status: ${dbBatch.status}
    - Operation Mode: ${dbBatch.operation_mode}`);

    // 4. Force execute the phase actions for the running batch
    console.log("Processing scheduled batches and executing active phase actions...");
    await processScheduledBatches();

    // 5. Verify the results
    const finalControls = await query(
      "SELECT control_id, control_name, control_type, status FROM control_device WHERE dry_id = 2 ORDER BY control_id"
    );
    console.log("Control devices for Dryer 2 after processing batch phase execution:");
    console.table(finalControls.rows);

    const configuredActions = await query(
      "SELECT control_id, action_type FROM phase_actions WHERE phase_id = $1",
      [firstPhase.phase_id]
    );

    let success = true;
    for (const act of configuredActions.rows) {
      const finalStatus = finalControls.rows.find(c => c.control_id === act.control_id).status;
      const expectedStatus = act.action_type === 'activate' ? 'active' : 'inactive';
      
      console.log(`Control #${act.control_id}: Expected Status = '${expectedStatus}', Actual Status = '${finalStatus}'`);
      if (finalStatus !== expectedStatus) {
        success = false;
      }
    }

    if (success) {
      console.log("SUCCESS: Batch execution correctly turned on configured phase devices!");
    } else {
      console.log("FAILURE: Device status did not match expected phase action types.");
    }

  } catch (err) {
    console.error("Test failed with error:", err);
  } finally {
    await pool.end();
  }
}

runTest();
