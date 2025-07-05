const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// Axios instance with timeout
const axiosInstance = axios.create({ timeout: 2500 });

// Get a real random Roblox user
async function getValidUser() {
  let attempts = 0;
  while (attempts < 10) {
    const randomId = Math.floor(Math.random() * 5000000000) + 100000;
    try {
      const response = await axiosInstance.get(`https://users.roblox.com/v1/users/${randomId}`);
      const user = response.data;
      if (user && !user.isBanned) {
        return user;
      }
    } catch (err) {
      // Ignore 404s or failed lookups
    }
    attempts++;
  }
  throw new Error("Could not find a valid user after 10 attempts");
}

// Calculate outfit value
async function getOutfitValue(userId) {
  try {
    const wearRes = await axiosInstance.get(`https://avatar.roblox.com/v1/users/${userId}/currently-wearing`);
    const assetIds = wearRes.data.assetIds || [];

    let total = 0;

    for (const assetId of assetIds) {
      try {
        const resellerRes = await axiosInstance.get(`https://economy.roblox.com/v1/assets/${assetId}/resellers`);
        const price = resellerRes.data.data?.[0]?.price;
        if (price) total += price;
      } catch (err) {
        console.warn(`Skipping asset ${assetId}: ${err.message}`);
      }
    }

    return total;
  } catch (err) {
    throw new Error("Failed to get outfit assets");
  }
}

// Main API route for Roblox
app.get('/random-outfit-value', async (req, res) => {
  console.log("🔍 Incoming request");

  try {
    const user = await getValidUser();
    console.log(`✅ User: ${user.name} (${user.id})`);

    const value = await getOutfitValue(user.id);
    console.log(`💰 Outfit value: ${value} Robux`);

    res.json({
      username: user.name,
      userId: user.id,
      outfitValue: value
    });
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: 'Failed to fetch outfit data' });
  }
});

// Root route to avoid 404 on /
app.get('/', (req, res) => {
  res.send("✅ Roblox Outfit API is running.");
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server ready on port ${PORT}`);
});
