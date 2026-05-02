const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let leaderboard = [];

const marketEvents = [
  {
    id: 'tiktok_ban_global',
    name: 'TikTok Ban Wave',
    description: 'Regulators crackdown on short-form video apps. Prices surging!',
    priceModifier: 2.5,
    durationMinutes: 20,
    affectedCategories: ['social', 'video']
  },
  {
    id: 'instagram_collapse',
    name: 'Instagram Outage',
    description: 'Servers down worldwide. Users panic-scrolling other apps.',
    priceModifier: 1.8,
    durationMinutes: 20,
    affectedCategories: ['social']
  },
  {
    id: 'youtube_algorithm',
    name: 'YouTube Algorithm Surge',
    description: 'Recommended feed goes haywire. Hours lost in autoplay.',
    priceModifier: 3.0,
    durationMinutes: 20,
    affectedCategories: ['video', 'entertainment']
  },
  {
    id: 'doomscroll_festival',
    name: 'Doomscroll Festival',
    description: 'Global news cycle spirals. Everyone glued to their phone.',
    priceModifier: 2.0,
    durationMinutes: 20,
    affectedCategories: ['social', 'news']
  },
  {
    id: 'reddit_ama',
    name: 'Reddit AMA Frenzy',
    description: 'Celebrity AMA sparks mass procrastination event.',
    priceModifier: 1.5,
    durationMinutes: 20,
    affectedCategories: ['entertainment']
  }
];

let currentEventIndex = 0;
let currentMarketEvent = {
  ...marketEvents[0],
  triggeredAt: Date.now()
};

// Rotate events every 20 minutes
setInterval(() => {
  currentEventIndex = (currentEventIndex + 1) % marketEvents.length;
  currentMarketEvent = {
    ...marketEvents[currentEventIndex],
    triggeredAt: Date.now()
  };
  console.log(`[${new Date().toISOString()}] Market event rotated to: ${currentMarketEvent.name}`);
}, 20 * 60 * 1000);

// --- Leaderboard API ---

app.get('/api/v1/leaderboard', (req, res) => {
  const sorted = [...leaderboard].sort((a, b) => b.level - a.level || b.totalScrollTimeMs - a.totalScrollTimeMs);
  res.json(sorted.slice(0, 50));
});

app.post('/api/v1/leaderboard', (req, res) => {
  const { displayName, userId, level, totalScrollTimeMs, embers } = req.body;

  if (!displayName) {
    return res.status(400).json({ error: 'Display name is required' });
  }

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
  res.json([currentMarketEvent]);
});

// --- Status API ---

app.get('/status', (req, res) => {
  res.json({ status: 'active', serverTime: Date.now() });
});

app.listen(PORT, () => {
  console.log(`EmberScroll Backend running on port ${PORT}`);
});
