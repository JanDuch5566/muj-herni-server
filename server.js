const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-memory "database" (Render pro-plan supports disk, free-tier resets on restart)
let leaderboard = [
  { userId: '1', displayName: 'ZombieScroller', level: 99, totalScrollTimeMs: 999999999, embers: 100000 },
  { userId: '2', displayName: 'DoomScrollKing', level: 50, totalScrollTimeMs: 500000000, embers: 50000 },
  { userId: '3', displayName: 'LazyLegend', level: 25, totalScrollTimeMs: 120000000, embers: 10000 }
];

let currentMarketEvent = {
  id: 'tiktok_ban_global',
  name: 'TikTok Ban Wave',
  description: 'Regulators crackdown on short-form video apps. Prices surging!',
  priceModifier: 2.5,
  durationMinutes: 60,
  affectedCategories: ['social', 'video'],
  triggeredAt: Date.now()
};

// --- Leaderboard API ---

app.get('/api/v1/leaderboard', (req, res) => {
  // Return top 50 sorted by level and time
  const sorted = [...leaderboard].sort((a, b) => b.level - a.level || b.totalScrollTimeMs - a.totalScrollTimeMs);
  res.json(sorted.slice(0, 50));
});

app.post('/api/v1/leaderboard', (req, res) => {
  const { displayName, userId, level, totalScrollTimeMs, embers } = req.body;

  if (!displayName) {
    return res.status(400).json({ error: 'Display name is required' });
  }

  // Find if player already exists by userId or displayName
  const existingIndex = leaderboard.findIndex(p => p.userId === userId || p.displayName === displayName);
  
  const entry = {
    userId: userId || (existingIndex >= 0 ? leaderboard[existingIndex].userId : uuidv4()),
    displayName,
    level: level || 1,
    totalScrollTimeMs: totalScrollTimeMs || 0,
    embers: embers || 0,
    lastUpdate: Date.now()
  };

  if (existingIndex >= 0) {
    leaderboard[existingIndex] = entry;
  } else {
    leaderboard.push(entry);
  }

  res.status(201).json(entry);
});

// --- Market API ---

app.get('/api/v1/market/events', (req, res) => {
  // Rotate events every hour if needed (logic simplified)
  res.json([currentMarketEvent]);
});

// --- Status API ---

app.get('/status', (req, res) => {
  res.json({ status: 'active', serverTime: Date.now() });
});

app.listen(PORT, () => {
  console.log(`EmberScroll Backend running on port ${PORT}`);
});
