#!/usr/bin/env node

/**
 * Script to upload LockSafe pathway nodes and edges to Bland.ai
 * Run with: node scripts/upload-bland-pathway.js
 */

const fs = require("fs");
const path = require("path");

// Load environment variables from .env file
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=["']?([^"'\n]+)["']?$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

const BLAND_API_KEY = process.env.BLAND_API_KEY || "org_9937a660c3831d3b7615c02f0b166739d7f1093ada05a02a11884cd7c430bb74d8e0092837bc756a32cc69";
const PATHWAY_ID = process.env.BLAND_PATHWAY_ID || "e83df2fb-c018-4998-8d04-ccaefb273233";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://locksafe.co.uk";

/**
 * Replace template variables in the pathway data with actual values
 */
function replaceTemplateVariables(obj) {
  if (typeof obj === "string") {
    // Replace {{NEXT_PUBLIC_BASE_URL}} with actual base URL
    return obj.replace(/\{\{NEXT_PUBLIC_BASE_URL\}\}/g, BASE_URL);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => replaceTemplateVariables(item));
  }
  if (typeof obj === "object" && obj !== null) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceTemplateVariables(value);
    }
    return result;
  }
  return obj;
}

async function uploadPathway() {
  console.log("Uploading LockSafe pathway to Bland.ai...\n");
  console.log("Pathway ID:", PATHWAY_ID);
  console.log("Base URL:", BASE_URL);
  console.log("");

  // Read the pathway JSON
  const pathwayPath = path.join(__dirname, "../docs/bland-ai-pathway.json");

  if (!fs.existsSync(pathwayPath)) {
    console.error("Error: bland-ai-pathway.json not found at", pathwayPath);
    process.exit(1);
  }

  const pathwayData = JSON.parse(fs.readFileSync(pathwayPath, "utf8"));

  // Replace template variables with actual values
  const processedData = replaceTemplateVariables(pathwayData);

  console.log(`Found ${processedData.nodes?.length || 0} nodes`);
  console.log(`Found ${processedData.edges?.length || 0} edges`);
  console.log("");

  // Show the API URLs that will be used
  console.log("API Endpoints configured:");
  console.log(`  - Check User: ${BASE_URL}/api/bland/check-user`);
  console.log(`  - Create User: ${BASE_URL}/api/bland/create-user`);
  console.log(`  - Create Job: ${BASE_URL}/api/bland/create-job`);
  console.log(`  - Send Notification: ${BASE_URL}/api/bland/send-notification`);
  console.log("");

  try {
    // Update the pathway with nodes and edges
    const response = await fetch(`https://api.bland.ai/v1/pathway/${PATHWAY_ID}`, {
      method: "POST",
      headers: {
        "Authorization": BLAND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "LockSafe Emergency Intake",
        description: "Emergency locksmith request intake flow for LockSafe UK",
        nodes: processedData.nodes,
        edges: processedData.edges,
        ...(processedData.globalConfig && { globalConfig: processedData.globalConfig }),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error uploading pathway:");
      console.error(JSON.stringify(data, null, 2));

      // Try alternative endpoint
      console.log("\nTrying alternative update endpoint...");
      const altResponse = await fetch(`https://api.bland.ai/v1/pathway/${PATHWAY_ID}`, {
        method: "POST",
        headers: {
          "Authorization": BLAND_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "LockSafe Emergency Intake",
          description: "Emergency locksmith request intake flow for LockSafe UK",
          nodes: processedData.nodes,
          edges: processedData.edges,
          ...(processedData.globalConfig && { globalConfig: processedData.globalConfig }),
        }),
      });

      const altData = await altResponse.json();

      if (!altResponse.ok) {
        console.error("Alternative endpoint also failed:");
        console.error(JSON.stringify(altData, null, 2));
        process.exit(1);
      }

      console.log("✅ Pathway uploaded successfully (alternative endpoint)!\n");
      console.log("Response:");
      console.log(JSON.stringify(altData, null, 2));
      return;
    }

    console.log("✅ Pathway uploaded successfully!\n");
    console.log("Response:");
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error("Failed to upload pathway:", error.message);
    process.exit(1);
  }
}

uploadPathway();
