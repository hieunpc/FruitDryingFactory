const http = require("http");

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const dataStr = body ? JSON.stringify(body) : "";
    const options = {
      hostname: "127.0.0.1",
      port: 3000,
      path: path,
      method: method,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(dataStr),
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let responseBody = "";
      res.on("data", (chunk) => {
        responseBody += chunk;
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(responseBody));
        } catch (e) {
          resolve(responseBody);
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (dataStr) {
      req.write(dataStr);
    }
    req.end();
  });
}

async function run() {
  console.log("1. Logging in as admin...");
  const loginRes = await request("POST", "/api/v1/auth/login", {
    email: "admin@gmail.com",
    password: "123456",
  });

  if (!loginRes || !loginRes.data || !loginRes.data.access_token) {
    console.error("Login failed:", loginRes);
    return;
  }

  const token = loginRes.data.access_token;
  console.log("Login success! Token acquired.");

  console.log("2. Enabling simulation mode...");
  const simRes = await request(
    "POST",
    "/api/v1/settings/simulation",
    { is_active: true },
    { Authorization: `Bearer ${token}` }
  );

  console.log("Simulation toggle response:", simRes);
}

run().catch(console.error);
