import crypto from "crypto";

const FB_APP_SECRET = process.env.FB_APP_SECRET;
const FB_PAGE_ID = process.env.FB_PAGE_ID;
const BASE_URL = "http://localhost:3000";

// Test PSID — using a test value that won't conflict with real customers
const TEST_PSID = "9000000000000001";

function signPayload(rawBody) {
  return "sha256=" + crypto
    .createHmac("sha256", FB_APP_SECRET)
    .update(rawBody)
    .digest("hex");
}

async function sendWebhook(text) {
  const payload = {
    object: "page",
    entry: [
      {
        id: FB_PAGE_ID,
        messaging: [
          {
            sender: { id: TEST_PSID },
            recipient: { id: FB_PAGE_ID },
            timestamp: Date.now(),
            message: { text },
          },
        ],
      },
    ],
  };

  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = signPayload(rawBody);

  const res = await fetch(`${BASE_URL}/api/facebook/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": signature,
    },
    body: rawBody,
  });

  const responseText = await res.text();
  console.log(`[${text}] → ${res.status}: ${responseText}`);
  // Wait for async processing
  await new Promise((r) => setTimeout(r, 3000));
}

async function main() {
  const tests = [
    { label: "固定回复-运费", text: "请问运费怎么算？" },
    { label: "固定回复-问候", text: "hi" },
    { label: "知识库-会员", text: "我想了解会员制度" },
    { label: "知识库-植物养护", text: "请问怎么浇水养护？" },
    { label: "转人工", text: "我想订购一批特殊肥料，可以帮忙吗？" },
  ];

  for (const test of tests) {
    console.log(`\n=== ${test.label} ===`);
    await sendWebhook(test.text);
  }

  console.log("\n=== All test messages sent ===");
}

main().catch((err) => {
  console.error("Test script error:", err);
  process.exit(1);
});
