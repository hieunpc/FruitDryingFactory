const { query } = require("../config/db");
const { writeLog } = require("./logService");
const { publishControlState } = require("../config/mqtt");

function evalCondition(operator, left, right) {
  const cleanOp = typeof operator === 'string' ? operator.trim() : operator;
  switch (cleanOp) {
    case ">":
      return left > right;
    case "<":
      return left < right;
    case ">=":
      return left >= right;
    case "<=":
      return left <= right;
    case "=":
      return left === right;
    default:
      return false;
  }
}

function resolveCurrentPhase(phases, elapsedSeconds) {
  let acc = 0;
  for (const phase of phases) {
    acc += Number(phase.duration_seconds);
    if (elapsedSeconds <= acc) {
      return phase;
    }
  }
  return phases[phases.length - 1] || null;
}

async function ingestSensorValue(sensorId, value, source = "api") {
  const sensorResult = await query(
    `SELECT sensor_id, sensor_type, threshold, dry_id
     FROM sensor_device
     WHERE sensor_id = $1`,
    [Number(sensorId)]
  );

  const sensor = sensorResult.rows[0];
  if (!sensor) {
    return { updated: false, reason: "sensor_not_found" };
  }

  // Fetch current running batch for this dryer
  const runningBatchResult = await query(
    `SELECT batch_id, start_time, threshold_enabled, recipe_id
     FROM batch
     WHERE dry_id = $1 AND status = 'running'
     ORDER BY start_time DESC
     LIMIT 1`,
    [sensor.dry_id]
  );
  const batch = runningBatchResult.rows[0];
  const batchId = batch ? batch.batch_id : null;

  const latestResult = await query(
    `SELECT last_value FROM sensor_latest WHERE sensor_id = $1`,
    [Number(sensorId)]
  );

  const hasLatest = latestResult.rows.length > 0;
  const lastValue = hasLatest ? Number(latestResult.rows[0].last_value) : null;

  if (hasLatest) {
    await query(
      `UPDATE sensor_latest
       SET last_value = $1, updated_at = NOW()
       WHERE sensor_id = $2`,
      [Number(value), Number(sensorId)]
    );
  } else {
    await query(
      `INSERT INTO sensor_latest (sensor_id, last_value) VALUES ($1, $2)`,
      [Number(sensorId), Number(value)]
    );
  }

  await writeLog({
    logStyle: "parameter_change",
    message: `[${source}] sensor ${sensorId} -> ${value}`,
    sensorId: Number(sensorId),
    value: Number(value),
    batchId: batchId,
  });

  if (!batch || !batch.start_time) {
    return { updated: true, batchEvaluated: false };
  }

  const phasesResult = await query(
    `SELECT phase_id, phase_order, duration_seconds
     FROM phase
     WHERE recipe_id = $1
     ORDER BY phase_order`,
    [batch.recipe_id]
  );

  const phases = phasesResult.rows;
  if (!phases.length) {
    return { updated: true, batchEvaluated: false };
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(batch.start_time).getTime()) / 1000)
  );

  const currentPhase = resolveCurrentPhase(phases, elapsedSeconds);
  if (!currentPhase) {
    return { updated: true, batchEvaluated: false };
  }

  const policiesResult = await query(
    `SELECT p.policy_id, p.policy_name, p.policy_type, p.phase_id
     FROM policy p
     JOIN phase ph ON ph.phase_id = p.phase_id
     WHERE ph.recipe_id = $1 AND p.is_active = TRUE`,
    [batch.recipe_id]
  );

  for (const policy of policiesResult.rows) {
    if ((policy.policy_type === "threshold" || policy.policy_type === "threshold_condition") && !batch.threshold_enabled) {
      continue;
    }

    // Phase-specific 'threshold' policies should only execute during their specific phase
    if (policy.policy_type === "threshold" && policy.phase_id !== currentPhase.phase_id) {
      continue;
    }

    const condResult = await query(
      `SELECT pc.condition_id, pc.sensor_id, pc.value, pc.cp_operator
       FROM policy_condition pc
       JOIN sensor_device sd ON sd.sensor_id = pc.sensor_id
       WHERE pc.policy_id = $1 AND sd.dry_id = $2`,
      [policy.policy_id, sensor.dry_id]
    );

    if (!condResult.rows.length) {
      console.warn(`[sensorService] Policy ${policy.policy_name} (ID: ${policy.policy_id}) has no conditions defined.`);
      continue;
    }

    // Only evaluate policies that have at least one condition referencing the current sensor that changed
    const hasCurrentSensorCondition = condResult.rows.some(
      (condition) => Number(condition.sensor_id) === Number(sensorId)
    );
    if (!hasCurrentSensorCondition) {
      continue;
    }

    let allTrue = true;

    for (const condition of condResult.rows) {
      const currentResult = await query(
        `SELECT last_value
         FROM sensor_latest
         WHERE sensor_id = $1`,
        [condition.sensor_id]
      );

      const currentValue = currentResult.rows[0]?.last_value;
      if (currentValue == null) {
        allTrue = false;
        break;
      }

      if (!evalCondition(condition.cp_operator, Number(currentValue), Number(condition.value))) {
        allTrue = false;
        break;
      }
    }

    if (!allTrue) {
      continue;
    }

    // Check if the actions actually need to be executed to avoid redundant database writes and logs
    const actionsResult = await query(
      `SELECT pa.action_id, pa.action_type, cd.control_id, cd.control_type
       FROM policy_action pa
       JOIN control_device cd ON cd.control_id = pa.control_id
       WHERE pa.policy_id = $1 AND cd.dry_id = $2`,
      [policy.policy_id, sensor.dry_id]
    );

    let loggingWritten = false;
    for (const action of actionsResult.rows) {
      const nextStatus = action.action_type === "activate" ? "active" : "inactive";

      // Verify if the device state is actually changing to prevent Adafruit IO rate limits and db spam
      const currentControlResult = await query(
        `SELECT status FROM control_device WHERE control_id = $1 AND dry_id = $2`,
        [action.control_id, sensor.dry_id]
      );
      const currentStatus = currentControlResult.rows[0]?.status;

      if (currentStatus !== nextStatus) {
        if (!loggingWritten) {
          await writeLog({
            logStyle: "sensor_trigger",
            message: `Policy ${policy.policy_name} triggered (${policy.policy_type}) on phase ${currentPhase.phase_order}`,
            batchId: batch.batch_id,
            sensorId: Number(sensorId),
            value: Number(value),
          });
          loggingWritten = true;
        }

        await query(
          `UPDATE control_device
           SET status = $1
           WHERE control_id = $2 AND dry_id = $3`,
          [nextStatus, action.control_id, sensor.dry_id]
        );

        await writeLog({
          logStyle: "device_action",
          message: `Policy ${policy.policy_name}: ${action.control_type} #${action.control_id} -> ${nextStatus}`,
          batchId: batch.batch_id,
          controlId: action.control_id,
        });

        publishControlState(sensor.dry_id, action.control_id, nextStatus);
      }
    }
  }

  return { updated: true, batchEvaluated: true };
}

module.exports = {
  ingestSensorValue,
};
