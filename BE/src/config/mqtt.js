const mqtt = require("mqtt");
const env = require("./env");
const { query } = require("./db");

let client1 = null;
let client2 = null;
let onSensorData = null;

function topicFromFeed(username, feed) {
  return `${username}/feeds/${feed}`;
}

function startMqtt(sensorIngestCallback) {
  onSensorData = sensorIngestCallback;

  // Start MQTT1 for Dryer1
  if (env.mqtt.mqtt1.enabled) {
    client1 = mqtt.connect(env.mqtt.mqtt1.brokerUrl, {
      username: env.mqtt.mqtt1.username,
      password: env.mqtt.mqtt1.key,
      reconnectPeriod: 5000,
    });

    client1.on("connect", () => {
      console.log("MQTT1 connected for Dryer1");
      [
        env.mqtt.mqtt1.feeds.temp,
        env.mqtt.mqtt1.feeds.hum,
        env.mqtt.mqtt1.feeds.light,
        env.mqtt.mqtt1.feeds.fan,
        env.mqtt.mqtt1.feeds.lamp,
      ]
        .filter(Boolean)
        .forEach((feed) => {
          client1.subscribe(topicFromFeed(env.mqtt.mqtt1.username, feed));
        });
    });

    client1.on("message", async (topic, payload) => {
      try {
        const text = payload.toString().trim();
        const feed = topic.split("/").pop();
        if (!feed) return;

        // Check if this feed is mapped to any Dryer control device in the environment variables
        // Find ALL dryers that are configured to use this feed
        const dryersToSync = [];

        // Check Dryer 1
        if (feed === env.mqtt.mqtt1.feeds.fan) {
          dryersToSync.push({ dryId: 1, controlType: "fan" });
        }
        if (feed === env.mqtt.mqtt1.feeds.lamp) {
          dryersToSync.push({ dryId: 1, controlType: "lamp" });
        }

        // Check Dryer 2
        if (feed === env.mqtt.mqtt2.feeds.fanDryer2) {
          dryersToSync.push({ dryId: 2, controlType: "fan" });
        }
        if (feed === env.mqtt.mqtt2.feeds.lampDryer2) {
          dryersToSync.push({ dryId: 2, controlType: "lamp" });
        }

        // Check Dryer 3
        if (feed === env.mqtt.mqtt2.feeds.fanDryer3) {
          dryersToSync.push({ dryId: 3, controlType: "fan" });
        }
        if (feed === env.mqtt.mqtt2.feeds.lampDryer3) {
          dryersToSync.push({ dryId: 3, controlType: "lamp" });
        }

        // Check Dryer 4
        if (feed === env.mqtt.mqtt2.feeds.fanDryer4) {
          dryersToSync.push({ dryId: 4, controlType: "fan" });
        }
        if (feed === env.mqtt.mqtt2.feeds.lampDryer4) {
          dryersToSync.push({ dryId: 4, controlType: "lamp" });
        }

        if (dryersToSync.length > 0) {
          const status = (text === "1" || text.toUpperCase() === "ON" || text.toUpperCase() === "ACTIVE") ? "active" : "inactive";
          for (const item of dryersToSync) {
            const controlResult = await query(
              `SELECT status, control_id FROM control_device WHERE dry_id = $1 AND control_type = $2`,
              [item.dryId, item.controlType]
            );
            if (controlResult.rows.length > 0) {
              const currentStatus = controlResult.rows[0].status;
              const controlId = controlResult.rows[0].control_id;
              if (currentStatus !== status) {
                await query(
                  `UPDATE control_device SET status = $1 WHERE control_id = $2`,
                  [status, controlId]
                );
                const { writeLog } = require("../services/logService");
                await writeLog({
                  logStyle: "device_action",
                  message: `Control ${controlId} (Dryer ${item.dryId}) sync from MQTT: ${status}`,
                  controlId,
                  appUserId: null
                });
                console.log(`Updated control ${controlId} (Dryer ${item.dryId}) (${item.controlType}) to ${status} via MQTT sync`);
              }
            }
          }
          return;
        }

        const numericValue = Number(text);
        if (Number.isNaN(numericValue)) return;
        if (typeof onSensorData !== "function") return;

        let sensorId = null;
        if (feed === env.mqtt.mqtt1.feeds.temp && env.mqtt.sensorMap.tempDryer1) {
          sensorId = env.mqtt.sensorMap.tempDryer1;
        } else if (feed === env.mqtt.mqtt1.feeds.hum && env.mqtt.sensorMap.humDryer1) {
          sensorId = env.mqtt.sensorMap.humDryer1;
        } else if (feed === env.mqtt.mqtt1.feeds.light && env.mqtt.sensorMap.lightDryer1) {
          sensorId = env.mqtt.sensorMap.lightDryer1;
        }

        if (sensorId) {
          console.log(`[MQTT1] Ingesting sensor ${sensorId} (${feed}) value: ${numericValue}`);
          await onSensorData(sensorId, numericValue, "mqtt");
        } else {
          console.log(`[MQTT1] Received message for feed ${feed} but no sensorId mapping found`);
        }
      } catch (error) {
        console.error("MQTT1 message handling error", error);
      }
    });

    client1.on("error", (error) => {
      console.error("MQTT1 error", error.message);
    });
  }

  // Start MQTT2 for Dryer2,3,4
  if (env.mqtt.mqtt2.enabled) {
    client2 = mqtt.connect(env.mqtt.mqtt2.brokerUrl, {
      username: env.mqtt.mqtt2.username,
      password: env.mqtt.mqtt2.key,
      reconnectPeriod: 5000,
    });

    client2.on("connect", () => {
      console.log("MQTT2 connected for Dryer2,3,4");
      const feeds = [
        env.mqtt.mqtt2.feeds.tempDryer2, env.mqtt.mqtt2.feeds.humDryer2, env.mqtt.mqtt2.feeds.lightDryer2,
        env.mqtt.mqtt2.feeds.fanDryer2, env.mqtt.mqtt2.feeds.lampDryer2,
        env.mqtt.mqtt2.feeds.tempDryer3, env.mqtt.mqtt2.feeds.humDryer3, env.mqtt.mqtt2.feeds.lightDryer3,
        env.mqtt.mqtt2.feeds.fanDryer3, env.mqtt.mqtt2.feeds.lampDryer3,
        env.mqtt.mqtt2.feeds.tempDryer4, env.mqtt.mqtt2.feeds.humDryer4, env.mqtt.mqtt2.feeds.lightDryer4,
        env.mqtt.mqtt2.feeds.fanDryer4, env.mqtt.mqtt2.feeds.lampDryer4,
      ].filter(Boolean);
      feeds.forEach((feed) => {
        client2.subscribe(topicFromFeed(env.mqtt.mqtt2.username, feed));
      });
    });

    client2.on("message", async (topic, payload) => {
      try {
        const text = payload.toString().trim();
        const feed = topic.split("/").pop();
        if (!feed) return;

        // Check if this feed is mapped to any Dryer control device in the environment variables
        const dryersToSync = [];

        // Check Dryer 2
        if (feed === env.mqtt.mqtt2.feeds.fanDryer2) {
          dryersToSync.push({ dryId: 2, controlType: "fan" });
        }
        if (feed === env.mqtt.mqtt2.feeds.lampDryer2) {
          dryersToSync.push({ dryId: 2, controlType: "lamp" });
        }

        // Check Dryer 3
        if (feed === env.mqtt.mqtt2.feeds.fanDryer3) {
          dryersToSync.push({ dryId: 3, controlType: "fan" });
        }
        if (feed === env.mqtt.mqtt2.feeds.lampDryer3) {
          dryersToSync.push({ dryId: 3, controlType: "lamp" });
        }

        // Check Dryer 4
        if (feed === env.mqtt.mqtt2.feeds.fanDryer4) {
          dryersToSync.push({ dryId: 4, controlType: "fan" });
        }
        if (feed === env.mqtt.mqtt2.feeds.lampDryer4) {
          dryersToSync.push({ dryId: 4, controlType: "lamp" });
        }

        if (dryersToSync.length > 0) {
          const status = (text === "1" || text.toUpperCase() === "ON" || text.toUpperCase() === "ACTIVE") ? "active" : "inactive";
          for (const item of dryersToSync) {
            const controlResult = await query(
              `SELECT status, control_id FROM control_device WHERE dry_id = $1 AND control_type = $2`,
              [item.dryId, item.controlType]
            );
            if (controlResult.rows.length > 0) {
              const currentStatus = controlResult.rows[0].status;
              const controlId = controlResult.rows[0].control_id;
              if (currentStatus !== status) {
                await query(
                  `UPDATE control_device SET status = $1 WHERE control_id = $2`,
                  [status, controlId]
                );
                const { writeLog } = require("../services/logService");
                await writeLog({
                  logStyle: "device_action",
                  message: `Control ${controlId} (Dryer ${item.dryId}) sync from MQTT: ${status}`,
                  controlId,
                  appUserId: null
                });
                console.log(`Updated control ${controlId} (Dryer ${item.dryId}) (${item.controlType}) to ${status} via MQTT sync`);
              }
            }
          }
          return;
        }

        const numericValue = Number(text);
        if (Number.isNaN(numericValue)) return;
        if (typeof onSensorData !== "function") return;

        let sensorId = null;
        if (feed === env.mqtt.mqtt2.feeds.tempDryer2 && env.mqtt.sensorMap.tempDryer2) {
          sensorId = env.mqtt.sensorMap.tempDryer2;
        } else if (feed === env.mqtt.mqtt2.feeds.humDryer2 && env.mqtt.sensorMap.humDryer2) {
          sensorId = env.mqtt.sensorMap.humDryer2;
        } else if (feed === env.mqtt.mqtt2.feeds.lightDryer2 && env.mqtt.sensorMap.lightDryer2) {
          sensorId = env.mqtt.sensorMap.lightDryer2;
        } else if (feed === env.mqtt.mqtt2.feeds.tempDryer3 && env.mqtt.sensorMap.tempDryer3) {
          sensorId = env.mqtt.sensorMap.tempDryer3;
        } else if (feed === env.mqtt.mqtt2.feeds.humDryer3 && env.mqtt.sensorMap.humDryer3) {
          sensorId = env.mqtt.sensorMap.humDryer3;
        } else if (feed === env.mqtt.mqtt2.feeds.lightDryer3 && env.mqtt.sensorMap.lightDryer3) {
          sensorId = env.mqtt.sensorMap.lightDryer3;
        } else if (feed === env.mqtt.mqtt2.feeds.tempDryer4 && env.mqtt.sensorMap.tempDryer4) {
          sensorId = env.mqtt.sensorMap.tempDryer4;
        } else if (feed === env.mqtt.mqtt2.feeds.humDryer4 && env.mqtt.sensorMap.humDryer4) {
          sensorId = env.mqtt.sensorMap.humDryer4;
        } else if (feed === env.mqtt.mqtt2.feeds.lightDryer4 && env.mqtt.sensorMap.lightDryer4) {
          sensorId = env.mqtt.sensorMap.lightDryer4;
        }

        if (sensorId) {
          console.log(`[MQTT2] Ingesting sensor ${sensorId} (${feed}) value: ${numericValue}`);
          await onSensorData(sensorId, numericValue, "mqtt");
        } else {
          console.log(`[MQTT2] Received message for feed ${feed} but no sensorId mapping found`);
        }
      } catch (error) {
        console.error("MQTT2 message handling error", error);
      }
    });

    client2.on("error", (error) => {
      console.error("MQTT2 error", error.message);
    });
  }

  return { client1, client2 };
}

async function publishControlState(dryerId, controlId, status) {
  let client = null;
  let username = null;
  let feed = null;

  const controlResult = await query(
    `SELECT control_type, dry_id FROM control_device WHERE control_id = $1`,
    [controlId]
  );
  const control = controlResult.rows[0];
  if (!control) return;

  const controlType = control.control_type;
  const dryId = control.dry_id;

  if (dryId === 1 && client1 && env.mqtt.mqtt1.enabled) {
    client = client1;
    username = env.mqtt.mqtt1.username;
    if (controlType === "fan") {
      feed = env.mqtt.mqtt1.feeds.fan;
    } else if (controlType === "lamp") {
      feed = env.mqtt.mqtt1.feeds.lamp;
    }
  } else if ((dryId === 2 || dryId === 3 || dryId === 4) && env.mqtt.mqtt2.enabled) {
    let resolvedFeed = null;
    if (controlType === "fan") {
      if (dryId === 2) resolvedFeed = env.mqtt.mqtt2.feeds.fanDryer2;
      else if (dryId === 3) resolvedFeed = env.mqtt.mqtt2.feeds.fanDryer3;
      else if (dryId === 4) resolvedFeed = env.mqtt.mqtt2.feeds.fanDryer4;
    } else if (controlType === "lamp") {
      if (dryId === 2) resolvedFeed = env.mqtt.mqtt2.feeds.lampDryer2;
      else if (dryId === 3) resolvedFeed = env.mqtt.mqtt2.feeds.lampDryer3;
      else if (dryId === 4) resolvedFeed = env.mqtt.mqtt2.feeds.lampDryer4;
    }

    if (resolvedFeed) {
      // Check if this resolvedFeed matches Dryer 1's physical device feed string
      if (env.mqtt.mqtt1.enabled && (resolvedFeed === env.mqtt.mqtt1.feeds.fan || resolvedFeed === env.mqtt.mqtt1.feeds.lamp)) {
        client = client1;
        username = env.mqtt.mqtt1.username;
        feed = resolvedFeed;
      } else if (client2) {
        client = client2;
        username = env.mqtt.mqtt2.username;
        feed = resolvedFeed;
      }
    }
  }

  if (!client || !feed) {
    return;
  }

  const payloadValue = (status === "active" || status === "on") ? "1" : "0";
  client.publish(topicFromFeed(username, feed), payloadValue);
}

async function publishSensorValue(dryerId, sensorType, value) {
  let client = null;
  let username = null;
  let feed = null;

  if (dryerId === 1 && client1 && env.mqtt.mqtt1.enabled) {
    client = client1;
    username = env.mqtt.mqtt1.username;
    if (sensorType === "temperature") feed = env.mqtt.mqtt1.feeds.temp;
    else if (sensorType === "humidity") feed = env.mqtt.mqtt1.feeds.hum;
    else if (sensorType === "light") feed = env.mqtt.mqtt1.feeds.light;
  } else if ((dryerId === 2 || dryerId === 3 || dryerId === 4) && env.mqtt.mqtt2.enabled) {
    client = client2;
    username = env.mqtt.mqtt2.username;
    if (dryerId === 2) {
      if (sensorType === "temperature") feed = env.mqtt.mqtt2.feeds.tempDryer2;
      else if (sensorType === "humidity") feed = env.mqtt.mqtt2.feeds.humDryer2;
      else if (sensorType === "light") feed = env.mqtt.mqtt2.feeds.lightDryer2;
    } else if (dryerId === 3) {
      if (sensorType === "temperature") feed = env.mqtt.mqtt2.feeds.tempDryer3;
      else if (sensorType === "humidity") feed = env.mqtt.mqtt2.feeds.humDryer3;
      else if (sensorType === "light") feed = env.mqtt.mqtt2.feeds.lightDryer3;
    } else if (dryerId === 4) {
      if (sensorType === "temperature") feed = env.mqtt.mqtt2.feeds.tempDryer4;
      else if (sensorType === "humidity") feed = env.mqtt.mqtt2.feeds.humDryer4;
      else if (sensorType === "light") feed = env.mqtt.mqtt2.feeds.lightDryer4;
    }
  }

  if (!client || !feed) {
    return;
  }

  client.publish(topicFromFeed(username, feed), String(value));
}

module.exports = {
  startMqtt,
  publishControlState,
  publishSensorValue,
};
