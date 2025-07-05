const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

async function getValidUser() {
  let attempts = 0;
  while (attempts < 10) {
    const randomId = Math.floor(Math.random() * 5000000000) + 100000;
    try {
      const userInfo = await axios.get(`https://users.roblox.com/v1/users/${randomId}`);
      const user = userInfo.data;
      if (user && !user.isBanned) {
        return user;
      }
    } catch (e) {
      // ignore 404s
    }
    attempts++;
  }
  throw new Error("Couldn't find a valid user");
}

async function getOutfitValue(userId) {
  const wearRes = await axios.get(`https://avatar.roblox.com/v1/users/${userId}/currently-wearing`);
  const assetIds = wearRes.data.assetIds || [];

  let totalValue = 0;

  for (const assetId of assetIds) {
    try {
      const resellers = await axios.get(`https://economy.roblox.com/v1/assets/${assetId}/resellers`);
      const price = resellers.data.data[0]?.price;
      if (price) totalValue += price;
    } catch {
      // no resellers, ignore
    }
  }

  return totalValue;
}

app.get('/random-outfit-value', async (req, res) => {
  try {
    const user = await getValidUser();
    const outfitValue = await getOutfitValue(user.id);
    res.json({
      username: user.name,
      userId: user.id,
      outfitValue
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch outfit data' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
