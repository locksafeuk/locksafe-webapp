#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Load environment variables
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

const BLAND_API_KEY = process.env.BLAND_API_KEY;
const PATHWAY_ID = process.env.BLAND_PATHWAY_ID;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://locksafe.co.uk";

function replaceTemplateVariables(obj) {
  if (typeof obj === "string") {
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

async function debugPathway() {
  console.log("PATHWAY_ID:", PATHWAY_ID);
  console.log("BASE_URL:", BASE_URL);
  console.log("");

  // Step 1: Get current pathway state
  console.log("=== Step 1: Getting current pathway state ===");
  const getResponse = await fetch(`https://api.bland.ai/v1/pathway/${PATHWAY_ID}`, {
    method: "GET",
    headers: {
      "Authorization": BLAND_API_KEY,
    },
  });
  const getData = await getResponse.json();
  console.log("Current nodes count:", getData.data?.nodes?.length || 0);
  console.log("Current edges count:", getData.data?.edges?.length || 0);
  if (getData.data?.nodes) {
    console.log("Node names:", getData.data.nodes.map(n => n.data?.name || n.id));
  }
  console.log("");

  // Step 2: Read and process our pathway
  console.log("=== Step 2: Reading our pathway JSON ===");
  const pathwayPath = path.join(__dirname, "../docs/bland-ai-pathway.json");
  const pathwayData = JSON.parse(fs.readFileSync(pathwayPath, "utf8"));
  const processedData = replaceTemplateVariables(pathwayData);
  console.log("Our nodes count:", processedData.nodes?.length || 0);
  console.log("Our edges count:", processedData.edges?.length || 0);
  console.log("Our node names:", processedData.nodes?.map(n => n.data?.name || n.id));
  console.log("");

  // Step 3: Upload with full body logging
  console.log("=== Step 3: Uploading pathway ===");
  const uploadBody = {
    name: "LockSafe Emergency Intake",
    description: "Emergency locksmith request intake flow for LockSafe UK",
    nodes: processedData.nodes,
    edges: processedData.edges,
  };

  console.log("Sending", uploadBody.nodes.length, "nodes and", uploadBody.edges.length, "edges");
  console.log("First node:", JSON.stringify(uploadBody.nodes[0], null, 2).substring(0, 500) + "...");

  const updateResponse = await fetch(`https://api.bland.ai/v1/pathway/${PATHWAY_ID}`, {
    method: "POST",
    headers: {
      "Authorization": BLAND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(uploadBody),
  });

  const updateData = await updateResponse.json();
  console.log("");
  console.log("Update response status:", updateResponse.status);
  console.log("Update response:", JSON.stringify(updateData, null, 2).substring(0, 1000));

  // Step 4: Check state after upload
  console.log("");
  console.log("=== Step 4: Checking pathway after upload ===");
  const checkResponse = await fetch(`https://api.bland.ai/v1/pathway/${PATHWAY_ID}`, {
    method: "GET",
    headers: {
      "Authorization": BLAND_API_KEY,
    },
  });
  const checkData = await checkResponse.json();
  console.log("Nodes after upload:", checkData.data?.nodes?.length || 0);
  console.log("Node names after upload:", checkData.data?.nodes?.map(n => n.data?.name || n.id));
}

debugPathway().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
