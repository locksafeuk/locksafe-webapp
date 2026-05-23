#!/usr/bin/env node
// Resubmit the latest rejected iOS version for App Store review.
// Usage:
//   node scripts/asc-resubmit-ios.mjs --dry
//   node scripts/asc-resubmit-ios.mjs --notes-file ./docs/ios-review-notes.txt
// Env (optional): ASC_KEY_PATH, ASC_KEY_ID, ASC_ISSUER_ID, ASC_BUNDLE_ID

import fs from "node:fs";
import jwt from "jsonwebtoken";

const KEY_PATH = process.env.ASC_KEY_PATH || "/Users/piks/Locksafe Project/locksafe-mobile/AuthKey_MJLU6DT298.p8";
const KEY_ID = process.env.ASC_KEY_ID || "MJLU6DT298";
const ISSUER_ID = process.env.ASC_ISSUER_ID || "7472da00-ebbf-4c36-a6e4-bd8a6b4e769d";
const BUNDLE_ID = process.env.ASC_BUNDLE_ID || "uk.locksafe.app";
const DRY = process.argv.includes("--dry");

const NOTES_FILE_FLAG = "--notes-file";
const notesFileIdx = process.argv.indexOf(NOTES_FILE_FLAG);
const notesFile = notesFileIdx !== -1 ? process.argv[notesFileIdx + 1] : null;

const defaultNotes = [
  "Resubmission after addressing the previously reported issue.",
  "",
  "Test account:",
  "Email: amiosif@icloud.com",
  "Password: demo1234",
  "",
  "If you need a fresh demo account, please let us know in Resolution Center and we will provide it immediately.",
].join("\n");

const reviewNotes = notesFile ? fs.readFileSync(notesFile, "utf8") : defaultNotes;

const privateKey = fs.readFileSync(KEY_PATH, "utf8");
const token = jwt.sign(
  {
    iss: ISSUER_ID,
    exp: Math.floor(Date.now() / 1000) + 20 * 60,
    aud: "appstoreconnect-v1",
  },
  privateKey,
  { algorithm: "ES256", header: { kid: KEY_ID, typ: "JWT" } },
);

const base = "https://api.appstoreconnect.apple.com/v1";
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function api(method, url, body) {
  const res = await fetch(url.startsWith("http") ? url : `${base}${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    throw new Error(`${method} ${url} -> ${res.status} ${JSON.stringify(parsed)}`);
  }

  return parsed;
}

async function findAppId() {
  const apps = await api("GET", `/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}&limit=5`);
  const app = apps.data?.[0];
  if (!app) throw new Error(`App not found for bundle id: ${BUNDLE_ID}`);
  return app.id;
}

async function findRejectedVersion(appId) {
  const versions = await api("GET", `/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=20`);
  return (
    versions.data.find((v) => v.attributes.appStoreState === "REJECTED") ||
    versions.data.find((v) => v.attributes.appStoreState === "DEVELOPER_REJECTED") ||
    null
  );
}

async function updateReviewNotes(versionId) {
  const relationship = await api("GET", `/appStoreVersions/${versionId}/relationships/appStoreReviewDetail`);
  const reviewDetailId = relationship?.data?.id;
  if (!reviewDetailId) {
    console.log("No appStoreReviewDetail found; skipping notes update.");
    return;
  }

  if (DRY) {
    console.log(`DRY run - would update review notes on appStoreReviewDetail ${reviewDetailId}`);
    return;
  }

  await api("PATCH", `/appStoreReviewDetails/${reviewDetailId}`, {
    data: {
      type: "appStoreReviewDetails",
      id: reviewDetailId,
      attributes: {
        notes: reviewNotes,
      },
    },
  });

  console.log("Updated app review notes.");
}

async function createReviewSubmission(versionId) {
  if (DRY) {
    console.log(`DRY run - would create review submission for version ${versionId}`);
    return;
  }

  const payload = {
    data: {
      type: "appStoreVersionSubmissions",
      relationships: {
        appStoreVersion: {
          data: {
            type: "appStoreVersions",
            id: versionId,
          },
        },
      },
    },
  };

  let out;
  try {
    out = await api("POST", "/appStoreVersionSubmissions", payload);
  } catch (firstError) {
    // Backward compatibility for older naming variants.
    out = await api("POST", "/reviewSubmissions", {
      data: {
        type: "reviewSubmissions",
        relationships: payload.data.relationships,
      },
    }).catch(() => {
      throw firstError;
    });
  }

  console.log("Review submission created:", JSON.stringify(out, null, 2));
}

(async () => {
  console.log("-> Locating app", BUNDLE_ID);
  const appId = await findAppId();
  console.log("   app id:", appId);

  console.log("-> Finding rejected iOS version");
  const rejected = await findRejectedVersion(appId);
  if (!rejected) {
    console.log("No rejected iOS version found. Nothing to resubmit.");
    process.exit(0);
  }

  const versionId = rejected.id;
  const versionString = rejected.attributes.versionString;
  const state = rejected.attributes.appStoreState;
  console.log(`   found version ${versionString} (state=${state}, id=${versionId})`);

  console.log("-> Updating App Review notes");
  await updateReviewNotes(versionId);

  console.log("-> Creating App Review submission");
  await createReviewSubmission(versionId);

  console.log("Done.");
})().catch((error) => {
  console.error("ERROR", error.message);
  process.exit(1);
});
