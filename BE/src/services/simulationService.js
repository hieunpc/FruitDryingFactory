const fs = require("fs");
const path = require("path");
const { query } = require("../config/db");
const { publishSensorValue } = require("../config/mqtt");

const STATE_FILE = path.join(__dirname, "../../simulation_state.json");
let intervalId = null;
let activeTimeouts = [];

function saveSimulationState(isActive) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ is_active: isActive }), "utf8");
  } catch (error) {
    console.error("[Simulation Service] Failed to save state:", error);
  }
}

function loadSimulationState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, "utf8");
      const parsed = JSON.parse(data);
      return !!parsed.is_active;
    }
  } catch (error) {
    console.error("[Simulation Service] Failed to load state:", error);
  }
  return false;
}


async function runTick() {
  try {
    // 1. Fetch all sensor devices in the database
    const sensorsResult = await query(
      "SELECT sensor_id, sensor_type, dry_id FROM sensor_device ORDER BY sensor_id"
    );
    const sensors = sensorsResult.rows;
    if (sensors.length === 0) return;

    // 2. Fetch all running batches
    const runningBatchesResult = await query(
      "SELECT batch_id, dry_id, recipe_id FROM batch WHERE status = 'running'"
    );
    const runningBatches = runningBatchesResult.rows;
    const runningDryerIds = new Set(runningBatches.map(b => b.dry_id));

    // 3. Fetch control device states to know if lamp/fan are active
    const controlsResult = await query(
      "SELECT dry_id, control_type, status FROM control_device"
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

    console.log(`[Simulation Service] Running simulation tick for active dryers: ${[...runningDryerIds].join(", ") || "none"}`);

    // 4. Update each sensor
    let index = 0;
    for (const sensor of sensors) {
      const { sensor_id, sensor_type, dry_id } = sensor;
      const isRunning = runningDryerIds.has(dry_id);
      const dryerControls = controlStatusMap[dry_id] || {};
      const isLampOn = dryerControls.lamp === "active" || dryerControls.lamp === "on";

      // Load last value from database for a smooth random walk
      const latestResult = await query(
        "SELECT last_value FROM sensor_latest WHERE sensor_id = $1",
        [sensor_id]
      );
      
      let currentVal;
      if (latestResult.rows.length > 0 && latestResult.rows[0].last_value != null) {
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

      // Stagger MQTT publish to avoid Adafruit IO rate limit throttling.
      // Publish to MQTT only. The backend MQTT subscriber will receive it and update the DB,
      // matching the exact behavior of a real physical device.
      const delayMs = 2500 * index;
      const timeoutId = setTimeout(async () => {
        activeTimeouts = activeTimeouts.filter(t => t !== timeoutId);
        try {
          await publishSensorValue(dry_id, sensor_type, newVal);
        } catch (publishError) {
          console.error(`[Simulation Service] Failed to publish sensor ${sensor_id}:`, publishError);
        }
      }, delayMs);
      activeTimeouts.push(timeoutId);

      index++;
    }
  } catch (error) {
    console.error("[Simulation Service] Telemetry tick failed:", error);
  }
}

function startSimulation() {
  if (intervalId) return;
  console.log("[Simulation Service] Starting telemetry simulation loop...");
  intervalId = setInterval(runTick, 30000); // Run every 30 seconds to stay safely under 30 publishes/min
  saveSimulationState(true);
  runTick(); // run once immediately
}

function stopSimulation() {
  if (!intervalId) return;
  console.log("[Simulation Service] Stopping telemetry simulation loop...");
  clearInterval(intervalId);
  intervalId = null;

  // Cancel all pending staggered publishes
  activeTimeouts.forEach(t => clearTimeout(t));
  activeTimeouts = [];

  saveSimulationState(false);
}

function isSimulationActive() {
  return intervalId !== null;
}

function initSimulation() {
  const shouldStart = loadSimulationState();
  if (shouldStart) {
    console.log("[Simulation Service] Auto-starting simulation from persisted state...");
    startSimulation();
  }
}

module.exports = {
  startSimulation,
  stopSimulation,
  isSimulationActive,
  initSimulation,
};
