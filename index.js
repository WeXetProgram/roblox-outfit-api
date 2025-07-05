const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

const axiosInstance = axios.create({ timeout: 2500 });

// Fetch a valid player with non-zero outfit value
async function getValidUserWithOutfit() {
  let attempts = 0;

  while (attempts < 20) {
    const randomId = Math.floor(Math.random() * 5000000000) + 100000;

    try {
      const response = await axiosInstance.get(`https://users.roblox.com/v1/users/${randomId}`);
      const user = response.data;

      if (!user || user.isBanned || !user.name) {
        attempts++;
        continue;
      }

      const outfitValue = await getOutfitValue(user.id);

      if (outfitValue > 0) {
        console.log(`✅ Found: ${user.name} (${user.id}) → ${outfitValue} Robux`);
        return { user, outfitValue };
      } else {
        console.log(`🔁 Skipping ${user.name} (${user.id}) - 0 Robux`);
      }

    } catch (e) {
      console.warn(`⚠️ Skipping user ID ${randomId}: ${e.response?.status || e.message}`);
    }

    attempts++;
  }

  throw new Error("No valid user with non-zero outfit value found.");
}

// Calculate total value of currently-worn items
async function getOutfitValue(userId) {
  let assetIds = [];

  try {
    const wearRes = await axiosInstance.get(`https://avatar.roblox.com/v1/users/${userId}/currently-wearing`);
    assetIds = wearRes.data.assetIds || [];
  } catch (e) {
    console.warn(`⚠️ Failed to get worn assets for ${userId}: ${e.message}`);
    return 0;
  }

  let total = 0;

  for (const assetId of assetIds) {
    try {
      const resellerRes = await axiosInstance.get(`https://economy.roblox.com/v1/assets/${assetId}/resellers`);
      const price = resellerRes.data.data?.[0]?.price;
      if (price) total += price;
    } catch (e) {
      console.warn(`❌ Asset ${assetId} skipped: ${e.message}`);
    }
  }

  return total;
}

// API endpoint for Roblox Studio
app.get('/random-outfit-value', async (req, res) => {
  try {
    const { user, outfitValue } = await getValidUserWithOutfit();

    res.json({
      username: user.name,
      userId: user.id,
      outfitValue
    });
  } catch (err) {
    console.error("🔥 Final error:", err.message);
    res.status(500).json({ error: 'Failed to fetch outfit data' });
  }
});

// Root test endpoint
app.get('/', (req, res) => {
  res.send("✅ Roblox Outfit API is running.");
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
