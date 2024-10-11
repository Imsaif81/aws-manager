const path = require('path');
const express = require('express');
const cors = require('cors');
const { EC2Client, AllocateAddressCommand, ReleaseAddressCommand, DescribeAddressesCommand } = require('@aws-sdk/client-ec2');

// Initialize Express App
const app = express();
app.use(cors());
app.use(express.json());

// Predefined list of allowed IP ranges (the first three octets of IP)
const predefinedIPRanges = [
  '43.204.6', '43.204.10', '43.204.11', '43.204.16', '43.204.17',
  '43.204.21', '43.205.28', '43.205.57', '43.205.71', '43.205.190'
];

// Store the current status for each session
let statusStore = {
  createdIPs: [],
  allocatedIPs: [],
  releasedIPs: [],
  seenIPs: new Set(), // Track seen IPs to avoid duplicates
};

// Function to create EC2 client with dynamic credentials
function createEC2Client(accessKeyId, secretAccessKey, region) {
  return new EC2Client({
    region: region,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey
    }
  });
}

// Function to allocate Elastic IPs
async function allocateElasticIP(ec2Client) {
  try {
    const command = new AllocateAddressCommand({});
    const response = await ec2Client.send(command);
    console.log(`Successfully allocated IP: ${response.PublicIp}`);
    return { publicIp: response.PublicIp, allocationId: response.AllocationId };
  } catch (error) {
    console.error("Error allocating IP:", error);
    return null;
  }
}

// Function to release Elastic IP using Allocation ID
async function releaseElasticIP(ec2Client, allocationId, publicIp) {
  try {
    const command = new ReleaseAddressCommand({ AllocationId: allocationId });
    await ec2Client.send(command);
    console.log(`Released IP: ${publicIp} with Allocation ID: ${allocationId}`);
  } catch (error) {
    console.error(`Error releasing IP with Allocation ID ${allocationId}:`, error);
  }
}

// Function to check if the first three octets match the predefined list
function checkIfIPMatchesPredefinedList(ip) {
  const firstThreeOctets = ip.split('.').slice(0, 3).join('.');
  return predefinedIPRanges.includes(firstThreeOctets);
}

// Main process to allocate IPs, compare them, and release if necessary
async function processElasticIPs(accessKeyId, secretAccessKey, region) {
  const ec2Client = createEC2Client(accessKeyId, secretAccessKey, region);

  let allocatedCount = 0;
  statusStore = { createdIPs: [], allocatedIPs: [], releasedIPs: [], seenIPs: new Set() }; // Reset session state

  while (allocatedCount < 5) {
    let ipBatch = [];

    // Create a batch of 5 IPs
    for (let i = 0; i < 5; i++) {
      const result = await allocateElasticIP(ec2Client);
      if (result) {
        const { publicIp, allocationId } = result;

        // If the IP has been seen before, release it immediately and skip further processing
        if (statusStore.seenIPs.has(publicIp)) {
          console.log(`Duplicate IP detected: ${publicIp}. Releasing...`);
          await releaseElasticIP(ec2Client, allocationId, publicIp);
          continue; // Retry the loop for a new IP
        }

        // Mark the IP as seen and add it to the batch
        statusStore.seenIPs.add(publicIp);
        statusStore.createdIPs.push(publicIp);
        ipBatch.push({ publicIp, allocationId });
      }
    }

    // Process the batch of created IPs
    for (const ipData of ipBatch) {
      const { publicIp, allocationId } = ipData;

      // Check if the IP matches the predefined range
      if (checkIfIPMatchesPredefinedList(publicIp)) {
        statusStore.allocatedIPs.push(publicIp);
        allocatedCount++;
        console.log(`Allocated IP: ${publicIp}`);
      } else {
        // Release the non-matching IP
        await releaseElasticIP(ec2Client, allocationId, publicIp);
        statusStore.releasedIPs.push(publicIp);
      }

      if (allocatedCount >= 5) break; // Stop when 5 IPs have been allocated
    }

    // After processing the batch, wait for 1 minute before continuing (if more IPs are needed)
    if (allocatedCount < 5) {
      console.log('Waiting for 1 minute before processing the next batch...');
      await new Promise(resolve => setTimeout(resolve, 60000)); // 1-minute delay
    }
  }

  return statusStore;
}

// API endpoint to start the allocation process
app.post('/api/allocate-ip', async (req, res) => {
  const { accessKeyId, secretAccessKey, region } = req.body;

  // Validate the input
  if (!accessKeyId || !secretAccessKey || !region) {
    return res.status(400).json({ error: 'Missing AWS credentials or region.' });
  }

  try {
    const status = await processElasticIPs(accessKeyId, secretAccessKey, region);
    res.status(200).json(status);
  } catch (error) {
    console.error('Error during IP allocation:', error);
    res.status(500).json({ error: 'Failed to allocate IPs.' });
  }
});

// API to get the current status
app.get('/api/status', (req, res) => {
  res.status(200).json(statusStore);
});

// Serve static files from the frontend
app.use(express.static(path.join(__dirname, 'build')));

// Catch-all to serve React app
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start the server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
