const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

const axiosInstance = axios.create({ timeout: 2500 });

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getValidUserWithOutfit() {
  let attempts = 0;

  while (attempts < 20) {
    const randomId = Math.floor(Math.random() * 5000000000) + 100000;

    try {
      const response = await axiosInstance.get(`https://users.roblox.com/v1/users/${randomId}`);
      const user = response.data;

      if (!user || user.isBanned || !user.name) {
        attempts++;
        await delay(200);
        continue;
      }

      const outfitValue = await getOutfitValue(user.id);

      console.log(`✅ Found: ${user.name} (${user.id}) → ${outfitValue} Robux`);
      return { user, outfitValue };

    } catch (e) {
      console.warn(`⚠️ Skipping user ID ${randomId}: ${e.response?.status || e.message}`);
    }

    attempts++;
    await delay(200); // prevent hitting rate limit
  }

  throw new Error("No valid user found.");
}

async function getOutfitValue(userId) {
  let assetIds = [];

  // Retry up to 3 times if rate limited
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const wearRes = await axiosInstance.get(`https://avatar.roblox.com/v1/users/${userId}/currently-wearing`);
      assetIds = wearRes.data.assetIds || [];
      break;
    } catch (e) {
      if (e.response?.status === 429) {
        console.warn(`⏳ Rate limited getting outfit for ${userId}, retrying... (${attempt + 1})`);
        await delay(300 + attempt * 200);
      } else {
        console.warn(`⚠️ Failed to get worn assets for ${userId}: ${e.message}`);
        return 0;
      }
    }
  }

  if (assetIds.length === 0) return 0;

  let total = 0;

  for (const assetId of assetIds) {
    try {
      const resellerRes = await axiosInstance.get(`https://economy.roblox.com/v1/assets/${assetId}/resellers`);
      const price = resellerRes.data.data?.[0]?.price;
      if (price) total += price;
    } catch (e) {
      if (e.response?.status === 429) {
        console.warn(`⏳ Rate limited on asset ${assetId}, skipping.`);
      } else {
        console.warn(`❌ Asset ${assetId} skipped: ${e.message}`);
      }
    }
  }

  return total;
}

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

app.get('/', (req, res) => {
  res.send("✅ Roblox Outfit API is running.");
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
