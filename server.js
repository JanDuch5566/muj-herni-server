const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// MongoDB Atlas — nastav MONGODB_URI v Render dashboard
// Formát: mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/?retryWrites=true&w=majority
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'change-me-in-render-env';

let leaderboardCol = null;

async function connectDB() {
  if (!MONGODB_URI) {
    console.warn('[DB] MONGODB_URI not set — leaderboard bude in-memory fallback');
    return;
  }
  const client = new MongoClient(MONGODB_URI, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
  });
  await client.connect();
  const db = client.db('emberscroll');
  leaderboardCol = db.collection('leaderboard');
  await leaderboardCol.createIndex({ userId: 1 }, { unique: true });
  console.log('[DB] MongoDB Atlas connected');
}

connectDB().catch(err => {
  console.error('[DB] Connection failed:', err.message);
});

// In-memory fallback pro případ že MONGODB_URI není nastaven
let leaderboardFallback = [];

const marketEvents = [
  {
    id: 'tiktok_ban_global',
    name: 'TikTok Ban Wave',
    description: 'Regulators crackdown on short-form video apps. TikTok earnings disabled.',
    priceModifier: 2.5,
    durationMinutes: 20,
    affectedCategories: ['social', 'video'],
    disabledApp: 'com.zhiliaoapp.musically'
  },
  {
    id: 'instagram_collapse',
    name: 'Instagram Outage',
    description: 'Servers down worldwide. Instagram earnings blocked.',
    priceModifier: 1.8,
    durationMinutes: 20,
    affectedCategories: ['social'],
    disabledApp: 'com.instagram.android'
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

setInterval(() => {
  currentEventIndex = (currentEventIndex + 1) % marketEvents.length;
  currentMarketEvent = {
    ...marketEvents[currentEventIndex],
    triggeredAt: Date.now()
  };
  console.log(`[${new Date().toISOString()}] Market event rotated to: ${currentMarketEvent.name}`);
}, 20 * 60 * 1000);

// --- Leaderboard API ---

app.get('/api/v1/leaderboard', async (_req, res) => {
  try {
    if (leaderboardCol) {
      const entries = await leaderboardCol
        .find({}, { projection: { _id: 0 } })
        .sort({ level: -1, totalScrollTimeMs: -1 })
        .limit(50)
        .toArray();
      return res.json(entries);
    }
    // Fallback
    const sorted = [...leaderboardFallback].sort((a, b) => b.level - a.level || b.totalScrollTimeMs - a.totalScrollTimeMs);
    res.json(sorted.slice(0, 50));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/leaderboard', async (req, res) => {
  const { displayName, userId, level, totalScrollTimeMs, embers } = req.body;

  if (!displayName) {
    return res.status(400).json({ error: 'Display name is required' });
  }

  const resolvedUserId = userId || uuidv4();

  const entry = {
    userId: resolvedUserId,
    displayName,
    level: level || 1,
    totalScrollTimeMs: totalScrollTimeMs || 0,
    embers: embers || 0,
    lastUpdate: Date.now()
  };

  try {
    if (leaderboardCol) {
      await leaderboardCol.updateOne(
        { userId: resolvedUserId },
        { $set: entry },
        { upsert: true }
      );
      return res.status(201).json(entry);
    }
    // Fallback in-memory
    const idx = leaderboardFallback.findIndex(p => p.userId === resolvedUserId);
    if (idx >= 0) {
      leaderboardFallback[idx] = entry;
    } else {
      leaderboardFallback.push(entry);
    }
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Admin: wipe leaderboard ---

app.delete('/api/v1/admin/leaderboard', async (req, res) => {
  if (req.headers['x-admin-token'] !== ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    if (leaderboardCol) {
      const result = await leaderboardCol.deleteMany({});
      return res.json({ cleared: true, deleted: result.deletedCount });
    }
    const count = leaderboardFallback.length;
    leaderboardFallback = [];
    res.json({ cleared: true, deleted: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Market API ---

app.get('/api/v1/market/events', (_req, res) => {
  res.json([currentMarketEvent]);
});

// --- Status API ---

app.get('/status', (_req, res) => {
  res.json({ status: 'active', serverTime: Date.now(), db: leaderboardCol ? 'mongodb' : 'memory' });
});

app.listen(PORT, () => {
  console.log(`EmberScroll Backend running on port ${PORT}`);
});
