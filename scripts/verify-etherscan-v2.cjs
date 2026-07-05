// Direct Etherscan V2 multichain verification — bypasses the old hardhat-verify plugin
// (which is stuck on the retired V1 endpoint). Submits standard-json-input + encoded ctor args.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { AbiCoder } = require("ethers");

const API = "https://api.etherscan.io/v2/api";
const CHAINID = "11155111";
const KEY = process.env.ETHERSCAN_API_KEY;
if (!KEY) throw new Error("ETHERSCAN_API_KEY missing");

const coder = AbiCoder.defaultAbiCoder();
const buildInfoDir = path.join(__dirname, "..", "artifacts", "build-info");

// pick the build-info that contains a given source path
function buildInfoFor(sourceNeedle) {
  for (const f of fs.readdirSync(buildInfoDir)) {
    const bi = JSON.parse(fs.readFileSync(path.join(buildInfoDir, f)));
    if (Object.keys(bi.input.sources).some((s) => s.includes(sourceNeedle))) return bi;
  }
  throw new Error("no build-info for " + sourceNeedle);
}

const TARGETS = [
  {
    name: "OracleAdapter",
    address: "0xD9BE093EBc43FaB96e45Cd35158E2bf3f6b560D5",
    source: "contracts/OracleAdapter.sol",
    contractName: "OracleAdapter",
    ctorTypes: ["address", "address", "uint256"],
    ctorArgs: ["0xC5981F461d74c46eB4b0CF3f4Ec79f025573B0Ea", "0x694AA1769357215DE4FAC081bf1f309aDC325306", "3600"],
  },
  {
    name: "ConfidentialNoteV4",
    address: "0x9Bb129E4912B9C3e0B2dd74394061d27060b7322",
    source: "contracts/ConfidentialNoteV4.sol",
    contractName: "ConfidentialNoteV4",
    ctorTypes: ["address", "address"],
    ctorArgs: ["0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639", "0xD9BE093EBc43FaB96e45Cd35158E2bf3f6b560D5"],
  },
  {
    name: "MockConfidentialToken",
    address: "0xf7c0cdc1e5f8B79741E78b25D014A7a8f7486B16",
    source: "contracts/MockConfidentialToken.sol",
    contractName: "MockConfidentialToken",
    ctorTypes: [],
    ctorArgs: [],
  },
];

async function post(params) {
  const body = new URLSearchParams(params);
  const res = await fetch(`${API}?chainid=${CHAINID}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  return res.json();
}

async function get(params) {
  const qs = new URLSearchParams({ ...params, chainid: CHAINID });
  const res = await fetch(`${API}?${qs}`);
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const out = [];
  for (const t of TARGETS) {
    // already verified?
    const chk = await get({ module: "contract", action: "getabi", address: t.address, apikey: KEY });
    if (chk.status === "1") {
      console.log(`${t.name}: ALREADY VERIFIED`);
      out.push({ name: t.name, address: t.address, status: "already-verified" });
      continue;
    }

    const bi = buildInfoFor(t.source.split("/").pop().replace(".sol", ""));
    const ctor = t.ctorTypes.length ? coder.encode(t.ctorTypes, t.ctorArgs).slice(2) : "";

    const submit = await post({
      module: "contract",
      action: "verifysourcecode",
      apikey: KEY,
      contractaddress: t.address,
      sourceCode: JSON.stringify(bi.input),
      codeformat: "solidity-standard-json-input",
      contractname: `${t.source}:${t.contractName}`,
      compilerversion: `v${bi.solcLongVersion}`,
      constructorArguements: ctor,
    });

    console.log(`${t.name}: submit ->`, submit.status, submit.result);
    if (submit.status !== "1") {
      out.push({ name: t.name, address: t.address, status: "submit-failed", result: submit.result });
      continue;
    }

    const guid = submit.result;
    let final = null;
    for (let i = 0; i < 20; i++) {
      await sleep(6000);
      const poll = await get({ module: "contract", action: "checkverifystatus", guid, apikey: KEY });
      console.log(`  ${t.name}: poll ${i} ->`, poll.result);
      if (poll.result && !/pending/i.test(poll.result)) { final = poll; break; }
    }
    out.push({ name: t.name, address: t.address, guid, status: final?.status === "1" ? "verified" : "check", result: final?.result });
  }
  fs.writeFileSync(path.join(__dirname, "..", "internal", "evidence", "verification.json"), JSON.stringify(out, null, 2));
  console.log("\n=== SUMMARY ===");
  out.forEach((o) => console.log(`${o.name} ${o.address} => ${o.status}`));
})().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
