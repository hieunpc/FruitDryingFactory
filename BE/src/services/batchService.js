const { query } = require("../config/db");
const { writeLog } = require("./logService");
const { publishControlState } = require("../config/mqtt");

const SCHEDULED_BATCH_POLL_SECONDS = 1;

function getBatchElapsedSeconds(batch) {
  const baseElapsed = Number(batch.elapsed_seconds || 0);
  if (batch.status === "running" && batch.start_time) {
    const now = Date.now();
    const startMs = new Date(batch.start_time).getTime();
    return baseElapsed + Math.max(0, Math.floor((now - startMs) / 1000));
  }
  return baseElapsed;
}

function resolveCurrentPhase(phases, elapsedSeconds) {
  let accumulated = 0;
  for (const phase of phases) {
    accumulated += Number(phase.duration_seconds);
    if (elapsedSeconds <= accumulated) {
      return phase;
    }
  }
  return phases[phases.length - 1] || null;
}

function calculatePhaseInfo(phases, elapsedSeconds) {
  const totalDuration = phases.reduce((sum, phase) => sum + Number(phase.duration_seconds), 0);
  const currentPhase = resolveCurrentPhase(phases, elapsedSeconds);
  if (!currentPhase) {
    return {
      elapsed_seconds: elapsedSeconds,
      total_duration_seconds: totalDuration,
      current_phase: null,
      current_phase_order: null,
      current_phase_remaining_seconds: 0,
      total_remaining_seconds: Math.max(0, totalDuration - elapsedSeconds),
    };
  }

  let phaseEnd = 0;
  for (const phase of phases) {
    phaseEnd += Number(phase.duration_seconds);
    if (phase.phase_id === currentPhase.phase_id) {
      break;
    }
  }

  const phaseStart = phaseEnd - Number(currentPhase.duration_seconds);
  const phaseElapsed = Math.max(0, elapsedSeconds - phaseStart);
  const remainingInPhase = Math.max(0, Number(currentPhase.duration_seconds) - phaseElapsed);

  return {
    elapsed_seconds: elapsedSeconds,
    total_duration_seconds: totalDuration,
    current_phase: {
      phase_id: currentPhase.phase_id,
      phase_order: currentPhase.phase_order,
      duration_seconds: Number(currentPhase.duration_seconds),
      humidity: currentPhase.humidity != null ? Number(currentPhase.humidity) : null,
      temperature: currentPhase.temperature != null ? Number(currentPhase.temperature) : null,
      light: currentPhase.light != null ? Number(currentPhase.light) : null,
    },
    current_phase_order: currentPhase.phase_order,
    current_phase_remaining_seconds: remainingInPhase,
    total_remaining_seconds: Math.max(0, totalDuration - elapsedSeconds),
  };
}

async function turnOffAllDevices(batchId, dryId) {
  const devicesResult = await query(
    `SELECT control_id, control_name, control_type FROM control_device WHERE dry_id = $1`,
    [Number(dryId)]
  );
  for (const device of devicesResult.rows) {
    await query(
      `UPDATE control_device SET status = 'inactive' WHERE control_id = $1`,
      [device.control_id]
    );
    await publishControlState(dryId, device.control_id, 'inactive');
    await writeLog({
      logStyle: "device_action",
      message: `Batch ${batchId} ended: turned off ${device.control_type} ${device.control_name}`,
      batchId: Number(batchId),
      controlId: device.control_id,
    });
  }
}

async function executePhaseActions(batchId, phaseId, dryId) {
  const actionsResult = await query(
    `SELECT pa.action_id, pa.control_id, pa.action_type, pa.start_offset_seconds, pa.duration_seconds,
            cd.control_name, cd.control_type
     FROM phase_actions pa
     JOIN control_device cd ON pa.control_id = cd.control_id
     WHERE pa.phase_id = $1
     ORDER BY pa.start_offset_seconds`,
    [Number(phaseId)]
  );

  for (const action of actionsResult.rows) {
    // Resolve the actual control_id for the target dryId
    let targetControlId = null;
    let targetControlName = action.control_name;

    // First try to match by both type and name on the target dryer
    const matchByNameAndType = await query(
      `SELECT control_id, control_name FROM control_device 
       WHERE dry_id = $1 AND control_type = $2 AND control_name = $3`,
      [Number(dryId), action.control_type, action.control_name]
    );

    if (matchByNameAndType.rows.length > 0) {
      targetControlId = matchByNameAndType.rows[0].control_id;
      targetControlName = matchByNameAndType.rows[0].control_name;
    } else {
      // Fallback: match by type only on the target dryer
      const matchByType = await query(
        `SELECT control_id, control_name FROM control_device 
         WHERE dry_id = $1 AND control_type = $2 
         ORDER BY control_id LIMIT 1`,
        [Number(dryId), action.control_type]
      );
      if (matchByType.rows.length > 0) {
        targetControlId = matchByType.rows[0].control_id;
        targetControlName = matchByType.rows[0].control_name;
      }
    }

    if (!targetControlId) {
      console.warn(`No matching control device of type ${action.control_type} found for dryer ${dryId}`);
      continue;
    }

    // Execute actions on the resolved target control device
    await query(
      `UPDATE control_device SET status = $1 WHERE control_id = $2`,
      [action.action_type === 'activate' ? 'active' : 'inactive', targetControlId]
    );

    // Publish MQTT
    await publishControlState(dryId, targetControlId, action.action_type === 'activate' ? 'active' : 'inactive');

    // Log
    await writeLog({
      logStyle: "device_action",
      message: `Phase action: ${action.action_type} ${action.control_type} ${targetControlName || targetControlId} in batch ${batchId}`,
      batchId: Number(batchId),
      controlId: targetControlId,
    });
  }
}

async function getBatchPhaseInfo(batchId) {
  const batchResult = await query(
    `SELECT batch_id, start_time, status, operation_mode, recipe_id, elapsed_seconds
     FROM batch WHERE batch_id = $1`,
    [Number(batchId)]
  );
  const batch = batchResult.rows[0];
  if (!batch) {
    return null;
  }

  const phasesResult = await query(
    `SELECT phase_id, phase_order, duration_seconds, humidity, temperature, light
     FROM phase WHERE recipe_id = $1 ORDER BY phase_order`,
    [Number(batch.recipe_id)]
  );
  const phases = phasesResult.rows;
  const elapsedSeconds = getBatchElapsedSeconds(batch);

  if (batch.status !== "running" && batch.status !== "paused") {
    return {
      batch_id: batch.batch_id,
      status: batch.status,
      operation_mode: batch.operation_mode,
      current_phase: null,
      elapsed_seconds: 0,
      total_duration_seconds: 0,
      current_phase_remaining_seconds: 0,
      total_remaining_seconds: 0,
    };
  }

  return {
    batch_id: batch.batch_id,
    status: batch.status,
    operation_mode: batch.operation_mode,
    ...calculatePhaseInfo(phases, elapsedSeconds),
  };
}

async function processScheduledBatches() {
  const pendingBatches = await query(
    `SELECT batch_id, dry_id, recipe_id, scheduled_start_time
     FROM batch
     WHERE status = 'pending'
       AND operation_mode = 'scheduled'
       AND scheduled_start_time IS NOT NULL
       AND scheduled_start_time <= NOW()`
  );

  for (const batch of pendingBatches.rows) {
    try {
      const dryerCheck = await query(
        `SELECT status FROM Dryer WHERE dry_id = $1`,
        [batch.dry_id]
      );

      if (!dryerCheck.rows[0] || dryerCheck.rows[0].status !== "Idle") {
        await writeLog({
          logStyle: "batch_running",
          message: `Scheduled batch ${batch.batch_id} skipped because dryer ${batch.dry_id} is not Idle`,
          batchId: Number(batch.batch_id),
        });
        continue;
      }

      await query(
        `UPDATE batch SET status = 'running', start_time = NOW(), elapsed_seconds = 0 WHERE batch_id = $1`,
        [batch.batch_id]
      );

      await query(
        `UPDATE Dryer SET status = 'Running' WHERE dry_id = $1`,
        [batch.dry_id]
      );

      const firstPhaseResult = await query(
        `SELECT phase_id, duration_seconds FROM phase WHERE recipe_id = $1 ORDER BY phase_order LIMIT 1`,
        [batch.recipe_id]
      );
      if (firstPhaseResult.rows.length) {
        const firstPhase = firstPhaseResult.rows[0];
        await executePhaseActions(batch.batch_id, firstPhase.phase_id, batch.dry_id);
        await writeLog({
          logStyle: "batch_running",
          message: `Batch ${batch.batch_id} entered phase 1 (${firstPhase.duration_seconds}s)`,
          batchId: Number(batch.batch_id),
        });
      }

      await writeLog({
        logStyle: "batch_start",
        message: `Batch ${batch.batch_id} auto-started (scheduled)`,
        batchId: batch.batch_id,
      });
    } catch (error) {
      console.error(`Error auto-starting batch ${batch.batch_id}:`, error);
    }
  }

  const runningBatches = await query(
    `SELECT batch_id, dry_id, recipe_id, start_time, status, elapsed_seconds
     FROM batch
     WHERE status = 'running' AND operation_mode = 'scheduled'`
  );

  const now = Date.now();

  for (const batch of runningBatches.rows) {
    if (!batch.start_time) {
      continue;
    }

    const phasesResult = await query(
      `SELECT phase_id, phase_order, duration_seconds
       FROM phase WHERE recipe_id = $1 ORDER BY phase_order`,
      [Number(batch.recipe_id)]
    );
    const phases = phasesResult.rows;
    if (!phases.length) {
      await query(
        `UPDATE batch SET status = 'failed', end_time = NOW() WHERE batch_id = $1`,
        [Number(batch.batch_id)]
      );
      await query(
        `UPDATE Dryer SET status = 'Idle' WHERE dry_id = $1`,
        [Number(batch.dry_id)]
      );
      await turnOffAllDevices(batch.batch_id, batch.dry_id);
      await writeLog({
        logStyle: "batch_end",
        message: `Scheduled batch ${batch.batch_id} failed due to missing recipe phases`,
        batchId: Number(batch.batch_id),
      });
      continue;
    }

    const elapsedSeconds = getBatchElapsedSeconds(batch);
    const totalDuration = phases.reduce((sum, phase) => sum + Number(phase.duration_seconds), 0);

    if (elapsedSeconds >= totalDuration) {
      await query(
        `UPDATE batch SET status = 'completed', end_time = NOW() WHERE batch_id = $1`,
        [Number(batch.batch_id)]
      );
      await query(
        `UPDATE Dryer SET status = 'Idle' WHERE dry_id = $1`,
        [Number(batch.dry_id)]
      );
      await turnOffAllDevices(batch.batch_id, batch.dry_id);
      await writeLog({
        logStyle: "batch_end",
        message: `Scheduled batch ${batch.batch_id} completed`,
        batchId: Number(batch.batch_id),
      });
      continue;
    }

    // Check for phase transitions
    let accumulatedTime = 0;
    let currentPhase = null;
    let previousPhase = null;

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      const phaseStartTime = accumulatedTime;
      const phaseEndTime = accumulatedTime + Number(phase.duration_seconds);

      if (elapsedSeconds >= phaseStartTime && elapsedSeconds < phaseEndTime) {
        currentPhase = phase;
        previousPhase = i > 0 ? phases[i - 1] : null;
        break;
      }

      accumulatedTime += Number(phase.duration_seconds);
    }

    if (currentPhase) {
      // Check if we already logged entering this phase to avoid duplicate executions
      const alreadyLogged = await query(
        `SELECT 1 FROM log 
         WHERE batch_id = $1 
           AND log_style = 'batch_running' 
           AND message LIKE $2 
         LIMIT 1`,
        [batch.batch_id, `Batch ${batch.batch_id} entered phase ${currentPhase.phase_order}%`]
      );

      if (!alreadyLogged.rows.length) {
        await writeLog({
          logStyle: "batch_running",
          message: `Batch ${batch.batch_id} entered phase ${currentPhase.phase_order} (${currentPhase.duration_seconds}s)`,
          batchId: Number(batch.batch_id),
        });

        // Execute phase actions for scheduled mode
        await executePhaseActions(batch.batch_id, currentPhase.phase_id, batch.dry_id);
      }
    }
  }
}


module.exports = {
  getBatchPhaseInfo,
  processScheduledBatches,
  executePhaseActions,
  turnOffAllDevices,
};
