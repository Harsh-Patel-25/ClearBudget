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

async function testFriendAPI() {
  console.log("🧪 Testing Friend Creation (Leva na & Deva na)...\n");

  // Login or Signup Test User
  const loginRes = await request(
    {
      hostname: "localhost",
      port: 5000,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { email: "alpha@test.com", password: "password123" }
  );

  const token = loginRes.body.token;
  console.log("Logged in user, token received.");

  // Add Leva Friend (Receivable)
  console.log("\n1️⃣ Adding Leva na (Receivable) Friend Record...");
  const levaRes = await request(
    {
      hostname: "localhost",
      port: 5000,
      path: "/api/friends",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
    { name: "Rohan Sharma", amount: 1500, type: "leva", description: "Dinner bill split" }
  );
  console.log("   Status:", levaRes.status);
  console.log("   Leva Friend Response:", levaRes.body);

  // Add Deva Friend (Payable)
  console.log("\n2️⃣ Adding Deva na (Payable) Friend Record...");
  const devaRes = await request(
    {
      hostname: "localhost",
      port: 5000,
      path: "/api/friends",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
    { name: "Priya Patel", amount: 800, type: "deva", description: "Movie ticket" }
  );
  console.log("   Status:", devaRes.status);
  console.log("   Deva Friend Response:", devaRes.body);

  // Get active friends list
  console.log("\n3️⃣ Querying Active Friends List...");
  const friendsList = await request({
    hostname: "localhost",
    port: 5000,
    path: "/api/friends",
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("   Status:", friendsList.status);
  console.log("   Friends Count:", friendsList.body.length);
  console.log("   Friends Data:", friendsList.body);

  if (friendsList.body.length >= 2) {
    console.log("\n✅ SUCCESS: Friend records (Leva na & Deva na) are now saved and fetched perfectly!");
  } else {
    console.log("\n❌ FAILED to retrieve created friend records.");
  }
}

testFriendAPI();
