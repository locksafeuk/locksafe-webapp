#!/usr/bin/env node
// Release approved iOS build via App Store Connect API.
// Usage: node scripts/asc-release.mjs [--dry]
import fs from "node:fs";
import path from "node:path";
import jwt from "jsonwebtoken";

const KEY_PATH = process.env.ASC_KEY_PATH || "/Users/piks/Locksafe Project/locksafe-mobile/AuthKey_MJLU6DT298.p8";
const KEY_ID = process.env.ASC_KEY_ID || "MJLU6DT298";
const ISSUER_ID = process.env.ASC_ISSUER_ID || "7472da00-ebbf-4c36-a6e4-bd8a6b4e769d";
const BUNDLE_ID = "uk.locksafe.app";
const DRY = process.argv.includes("--dry");

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
		throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(parsed)}`);
	}
	return parsed;
}

(async () => {
	console.log("→ Locating app", BUNDLE_ID);
	const apps = await api(
		"GET",
		`/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}&limit=5`,
	);
	const app = apps.data?.[0];
	if (!app) throw new Error("App not found");
	console.log("  app id:", app.id, "name:", app.attributes.name);

	console.log("→ Fetching App Store versions");
	const versions = await api(
		"GET",
		`/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=10`,
	);
	for (const v of versions.data) {
		console.log(
			`  - ${v.attributes.versionString.padEnd(8)} state=${v.attributes.appStoreState} releaseType=${v.attributes.releaseType} id=${v.id}`,
		);
	}

	const target =
		versions.data.find((v) => v.attributes.appStoreState === "PENDING_DEVELOPER_RELEASE") ||
		versions.data.find((v) => v.attributes.appStoreState === "READY_FOR_SALE") ||
		null;
	if (!target) {
		console.log("⚠ No version in PENDING_DEVELOPER_RELEASE found.");
		return;
	}
	console.log(
		`→ Target version: ${target.attributes.versionString} (state=${target.attributes.appStoreState}, id=${target.id})`,
	);

	if (target.attributes.appStoreState === "READY_FOR_SALE") {
		console.log("✔ Already released / live.");
		return;
	}

	if (DRY) {
		console.log("DRY run — would POST /appStoreVersionReleaseRequests for version", target.id);
		return;
	}

	console.log("→ Submitting release request");
	const out = await api("POST", "/appStoreVersionReleaseRequests", {
		data: {
			type: "appStoreVersionReleaseRequests",
			relationships: {
				appStoreVersion: { data: { type: "appStoreVersions", id: target.id } },
			},
		},
	});
	console.log("✅ Release request accepted:", JSON.stringify(out, null, 2));
})().catch((e) => {
	console.error("❌", e.message);
	process.exit(1);
});
