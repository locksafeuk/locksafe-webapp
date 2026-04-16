#!/usr/bin/env node

/**
 * Script to update the Bland.ai pathway via API
 * Usage: node scripts/update-bland-pathway.js
 */

const fs = require('fs');
const path = require('path');

// Read .env file manually
function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};

  envContent.split('\n').forEach(line => {
    // Skip comments and empty lines
    if (!line || line.startsWith('#')) return;

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let value = match[2].trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[match[1].trim()] = value;
    }
  });

  return env;
}

const env = loadEnv();
const BLAND_API_KEY = env.BLAND_API_KEY;
const BLAND_PATHWAY_ID = env.BLAND_PATHWAY_ID;

if (!BLAND_API_KEY) {
  console.error('❌ BLAND_API_KEY not found in .env file');
  process.exit(1);
}

if (!BLAND_PATHWAY_ID) {
  console.error('❌ BLAND_PATHWAY_ID not found in .env file');
  process.exit(1);
}

async function updatePathway() {
  console.log('🚀 Starting Bland.ai pathway update...');
  console.log(`📋 Pathway ID: ${BLAND_PATHWAY_ID}`);

  // Read the pathway JSON file
  const pathwayPath = path.join(__dirname, '../docs/bland-ai-pathway.json');

  if (!fs.existsSync(pathwayPath)) {
    console.error(`❌ Pathway file not found at: ${pathwayPath}`);
    process.exit(1);
  }

  const pathwayData = JSON.parse(fs.readFileSync(pathwayPath, 'utf8'));
  console.log(`✅ Loaded pathway with ${pathwayData.nodes.length} nodes and ${pathwayData.edges.length} edges`);

  // Prepare the update payload
  const payload = {
    name: "LockSafe Emergency Intake",
    description: "Emergency locksmith request intake flow for LockSafe UK",
    nodes: pathwayData.nodes,
    edges: pathwayData.edges
  };

  try {
    // Update the pathway using Bland.ai API
    const response = await fetch(`https://api.bland.ai/v1/convo_pathway/${BLAND_PATHWAY_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': BLAND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Failed to update pathway:');
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }

    console.log('✅ Pathway updated successfully!');
    console.log('📊 Response:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Error updating pathway:', error.message);
    process.exit(1);
  }
}

updatePathway();
