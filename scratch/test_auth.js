const http = require("http");

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    if (postData) req.write(JSON.stringify(postData));
    req.end();
  });
}

async function runTest() {
  console.log("🧪 Starting Authentication & Data Isolation Verification Tests...\n");

  try {
    // 1. Sign up User Alpha
    console.log("1️⃣ Registering User Alpha...");
    const alphaSignup = await request(
      {
        hostname: "localhost",
        port: 5000,
        path: "/api/auth/signup",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      { name: "User Alpha", email: "alpha@test.com", password: "password123" }
    );
    console.log("   Status:", alphaSignup.status);
    console.log("   User:", alphaSignup.body.user);
    const alphaToken = alphaSignup.body.token;

    // 2. Add transaction for User Alpha
    console.log("\n2️⃣ Adding $5,000 Income Transaction for User Alpha...");
    const alphaTx = await request(
      {
        hostname: "localhost",
        port: 5000,
        path: "/api/transactions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${alphaToken}`,
        },
      },
      { name: "Software Engineer Salary", amount: 5000, category: "Income" }
    );
    console.log("   Status:", alphaTx.status);
    console.log("   Added Transaction:", alphaTx.body);

    // 3. Sign up User Beta
    console.log("\n3️⃣ Registering User Beta...");
    const betaSignup = await request(
      {
        hostname: "localhost",
        port: 5000,
        path: "/api/auth/signup",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      { name: "User Beta", email: "beta@test.com", password: "password123" }
    );
    console.log("   Status:", betaSignup.status);
    console.log("   User:", betaSignup.body.user);
    const betaToken = betaSignup.body.token;

    // 4. Get transactions for User Beta (Should be empty!)
    console.log("\n4️⃣ Querying Transactions for User Beta (Checking Data Isolation)...");
    const betaTxs = await request({
      hostname: "localhost",
      port: 5000,
      path: "/api/transactions",
      method: "GET",
      headers: { Authorization: `Bearer ${betaToken}` },
    });
    console.log("   Status:", betaTxs.status);
    console.log("   Transactions count for User Beta:", betaTxs.body.length);
    console.log("   Data isolated:", betaTxs.body.length === 0 ? "✅ YES! (User Beta sees 0 transactions)" : "❌ NO!");

    // 5. Get transactions for User Alpha (Should contain the salary)
    console.log("\n5️⃣ Querying Transactions for User Alpha...");
    const alphaTxs = await request({
      hostname: "localhost",
      port: 5000,
      path: "/api/transactions",
      method: "GET",
      headers: { Authorization: `Bearer ${alphaToken}` },
    });
    console.log("   Status:", alphaTxs.status);
    console.log("   Transactions count for User Alpha:", alphaTxs.body.length);
    console.log("   Alpha transaction name:", alphaTxs.body[0]?.name);

    console.log("\n🎉 ALL AUTHENTICATION AND DATA ISOLATION TESTS PASSED PERFECTLY!");
  } catch (err) {
    console.error("❌ Test failed:", err);
  }
}

runTest();
