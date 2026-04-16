#!/usr/bin/env node

/**
 * Script to create LockSafe Emergency Intake pathway in Bland.ai
 * Run with: node scripts/create-bland-pathway.js
 */

const BLAND_API_KEY = process.env.BLAND_API_KEY || "org_9937a660c3831d3b7615c02f0b166739d7f1093ada05a02a11884cd7c430bb74d8e0092837bc756a32cc69";

async function createPathway() {
  console.log("Creating LockSafe Emergency Intake pathway in Bland.ai...\n");

  try {
    const response = await fetch("https://api.bland.ai/v1/convo_pathway/create", {
      method: "POST",
      headers: {
        "Authorization": BLAND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "LockSafe Emergency Intake",
        description: "Emergency locksmith request intake flow for LockSafe UK. Collects customer details (email required), checks/creates account, registers emergency job, and sends SMS/email with continuation link.",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error creating pathway:");
      console.error(JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log("✅ Pathway created successfully!\n");
    console.log("Response:");
    console.log(JSON.stringify(data, null, 2));

    // Extract pathway ID
    const pathwayId = data.pathway_id || data.id || data.data?.pathway_id || data.data?.id;

    if (pathwayId) {
      console.log("\n" + "=".repeat(50));
      console.log("PATHWAY ID:", pathwayId);
      console.log("=".repeat(50));
      console.log("\nAdd this to your .env file:");
      console.log(`BLAND_PATHWAY_ID="${pathwayId}"`);
    }

  } catch (error) {
    console.error("Failed to create pathway:", error.message);
    process.exit(1);
  }
}

createPathway();
