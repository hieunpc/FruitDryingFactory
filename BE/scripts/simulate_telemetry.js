/* eslint-disable no-console */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { query } = require("../src/config/db");
const { ingestSensorValue } = require("../src/services/sensorService");

async function simulate() {
  try {
    // 1. Fetch all sensors for Dryers 2, 3, and 4 (Dryer 1 is skipped)
    const sensorsResult = await query(
      "SELECT sensor_id, sensor_type, threshold, dry_id FROM sensor_device WHERE dry_id IN (2, 3, 4) ORDER BY sensor_id"
    );
    const sensors = sensorsResult.rows;

    if (sensors.length === 0) {
      console.log("No sensors found for Dryers 2, 3, 4 in database. Run seed first.");
      return;
    }

    // 2. Fetch all running batches
    const runningBatchesResult = await query(
      "SELECT batch_id, dry_id, recipe_id FROM batch WHERE status = 'running' AND dry_id IN (2, 3, 4)"
    );
    const runningBatches = runningBatchesResult.rows;
    const runningDryerIds = new Set(runningBatches.map(b => b.dry_id));

    // 3. Fetch control device states for Dryers 2, 3, 4 to determine lamp/fan states
    const controlsResult = await query(
      "SELECT dry_id, control_type, status FROM control_device WHERE dry_id IN (2, 3, 4)"
    );
    const controls = controlsResult.rows;
    
    // Map control status: dryer_id -> control_type -> status
    const controlStatusMap = {};
    controls.forEach(ctrl => {
      if (!controlStatusMap[ctrl.dry_id]) {
        controlStatusMap[ctrl.dry_id] = {};
      }
      controlStatusMap[ctrl.dry_id][ctrl.control_type] = ctrl.status;
    });

    console.log(`[Simulator] Running simulation tick for Dryers 2, 3, 4... (Active: ${[...runningDryerIds].join(", ") || "none"})`);

    // 4. Update each sensor
    for (const sensor of sensors) {
      const { sensor_id, sensor_type, dry_id } = sensor;
      const isRunning = runningDryerIds.has(dry_id);
      const dryerControls = controlStatusMap[dry_id] || {};
      const isLampOn = dryerControls.lamp === "active" || dryerControls.lamp === "on";

      // Load last value from database to do a smooth random walk
      const latestResult = await query(
        "SELECT last_value FROM sensor_latest WHERE sensor_id = $1",
        [sensor_id]
      );
      
      let currentVal;
      if (latestResult.rows.length > 0) {
        currentVal = Number(latestResult.rows[0].last_value);
      } else {
        // Defaults if no record exists
        if (sensor_type === "temperature") currentVal = 30.0;
        else if (sensor_type === "humidity") currentVal = 60.0;
        else currentVal = 10.0;
      }

      let newVal = currentVal;

      if (isRunning) {
        // Active batch drying simulation
        if (sensor_type === "temperature") {
          const targetTemp = 65.0;
          if (currentVal < targetTemp) {
            newVal += 0.8 + Math.random() * 1.2; // Heat up smoothly
          } else {
            newVal += (Math.random() - 0.5) * 0.4; // Small hover fluctuation
          }
        } else if (sensor_type === "humidity") {
          const targetHum = 15.0;
          if (currentVal > targetHum) {
            newVal -= 1.0 + Math.random() * 1.5; // Dry out smoothly
          } else {
            newVal += (Math.random() - 0.5) * 0.5; // Small hover fluctuation
          }
        } else {
          // Light sensor (value 0-100%)
          const targetLight = isLampOn ? 85.0 : 15.0;
          // Step towards target smoothly
          if (Math.abs(currentVal - targetLight) > 2.0) {
            newVal += (targetLight - currentVal) * 0.2 + (Math.random() - 0.5) * 1.0;
          } else {
            newVal += (Math.random() - 0.5) * 0.5;
          }
        }
      } else {
        // Ambient cooling simulation (machine idle)
        if (sensor_type === "temperature") {
          const ambientTemp = 30.0;
          if (currentVal > ambientTemp) {
            newVal -= 0.5 + Math.random() * 0.5; // Cool down smoothly
          } else {
            newVal += (Math.random() - 0.5) * 0.2;
          }
        } else if (sensor_type === "humidity") {
          const ambientHum = 65.0;
          if (Math.abs(currentVal - ambientHum) > 2.0) {
            newVal += (ambientHum - currentVal) * 0.15 + (Math.random() - 0.5) * 0.5;
          } else {
            newVal += (Math.random() - 0.5) * 0.4;
          }
        } else {
          // Light sensor (ambient room: 5%)
          const ambientLight = 5.0;
          if (Math.abs(currentVal - ambientLight) > 2.0) {
            newVal += (ambientLight - currentVal) * 0.2 + (Math.random() - 0.5) * 0.5;
          } else {
            newVal += (Math.random() - 0.5) * 0.2;
          }
        }
      }

      // Constrain ranges
      if (sensor_type === "temperature") {
        newVal = Math.max(15.0, Math.min(100.0, newVal));
      } else if (sensor_type === "humidity") {
        newVal = Math.max(5.0, Math.min(99.0, newVal));
      } else {
        newVal = Math.max(0.0, Math.min(100.0, newVal));
      }

      // Round to 1 decimal place
      newVal = Math.round(newVal * 10) / 10;

      // Ingest the simulated reading
      await ingestSensorValue(sensor_id, newVal, "simulator");
    }
  } catch (error) {
    console.error("Telemetry simulation tick failed:", error);
  }
}

// Start simulation loop (runs every 30 seconds)
console.log("Starting IoT Dryer Telemetry Simulator for Dryers 2, 3, 4... (ticks every 30 seconds)");
setInterval(simulate, 30000);
simulate(); // first run immediately
