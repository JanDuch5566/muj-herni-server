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
    description: 'Regulators crackdown on short-form video apps. TikTok disabled. Earnings x2.5 for Social/Video apps.',
    priceModifier: 2.5,
    durationMinutes: 20,
    affectedCategories: ['social', 'video'],
    disabledApp: 'com.zhiliaoapp.musically'
  },
  {
    id: 'instagram_collapse',
    name: 'Instagram Outage',
    description: 'Servers down worldwide. Instagram blocked. Earnings x1.8 for Social apps.',
    priceModifier: 1.8,
    durationMinutes: 20,
    affectedCategories: ['social'],
    disabledApp: 'com.instagram.android'
  },
  {
    id: 'youtube_algorithm',
    name: 'YouTube Algorithm Surge',
    description: 'Recommended feed goes haywire. Hours lost in autoplay. Earnings x3.0 for Video/Entertainment.',
    priceModifier: 3.0,
    durationMinutes: 20,
    affectedCategories: ['video', 'entertainment']
  },
  {
    id: 'doomscroll_festival',
    name: 'Doomscroll Festival',
    description: 'Global news cycle spirals. Everyone glued to their phone. Earnings x2.0 for Social/News.',
    priceModifier: 2.0,
    durationMinutes: 20,
    affectedCategories: ['social', 'news']
  },
  {
    id: 'reddit_ama',
    name: 'Reddit AMA Frenzy',
    description: 'Celebrity AMA sparks mass procrastination event. Earnings x1.5 for Entertainment.',
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

app.post('/api/v1/leaderboard/ping', async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  try {
    if (leaderboardCol) {
      const result = await leaderboardCol.updateOne(
        { userId },
        { $set: { lastUpdate: Date.now() } }
      );
      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json({ success: true });
    }
    const idx = leaderboardFallback.findIndex(p => p.userId === userId);
    if (idx < 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    leaderboardFallback[idx].lastUpdate = Date.now();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



app.get('/api/v1/leaderboard', async (_req, res) => {
  try {
    if (leaderboardCol) {
      const entries = await leaderboardCol
        .find({}, { projection: { _id: 0, userId: 0 } })
        .sort({ embers: -1, level: -1 })
        .limit(50)
        .toArray();
      return res.json(entries);
    }
    // Fallback — strip userId before sending
    const sorted = [...leaderboardFallback]
      .sort((a, b) => b.embers - a.embers || b.level - a.level)
      .slice(0, 50)
      .map(({ userId: _uid, ...pub }) => pub);
    res.json(sorted);
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
      // Reject if a *different* userId already owns this displayName
      const conflict = await leaderboardCol.findOne(
        { displayName, userId: { $ne: resolvedUserId } }
      );
      if (conflict) {
        return res.status(400).json({ error: 'This display name is already taken by another device.' });
      }
      await leaderboardCol.updateOne(
        { userId: resolvedUserId },
        { $set: entry },
        { upsert: true }
      );
      return res.status(201).json(entry);
    }
    // Fallback in-memory
    const conflict = leaderboardFallback.find(
      p => p.displayName === displayName && p.userId !== resolvedUserId
    );
    if (conflict) {
      return res.status(400).json({ error: 'This display name is already taken by another device.' });
    }
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

// --- Admin: delete single user ---

app.delete('/api/v1/admin/leaderboard/user/:userId', async (req, res) => {
  if (req.headers['x-admin-token'] !== ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { userId } = req.params;
  try {
    if (leaderboardCol) {
      await leaderboardCol.deleteOne({ userId });
      return res.json({ deleted: true, userId });
    }
    leaderboardFallback = leaderboardFallback.filter(p => p.userId !== userId);
    res.json({ deleted: true, userId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Inactivity cleanup (every 6 hours, remove entries older than 7 days) ---

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

async function cleanupInactive() {
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  try {
    if (leaderboardCol) {
      const result = await leaderboardCol.deleteMany({ lastUpdate: { $lt: cutoff } });
      if (result.deletedCount > 0) {
        console.log(`[Cleanup] Removed ${result.deletedCount} inactive player(s) from MongoDB`);
      }
    } else {
      const before = leaderboardFallback.length;
      leaderboardFallback = leaderboardFallback.filter(p => p.lastUpdate >= cutoff);
      const removed = before - leaderboardFallback.length;
      if (removed > 0) {
        console.log(`[Cleanup] Removed ${removed} inactive player(s) from in-memory store`);
      }
    }
  } catch (err) {
    console.error('[Cleanup] Error during inactive player cleanup:', err.message);
  }
}

setInterval(cleanupInactive, 6 * 60 * 60 * 1000);

// --- Market API ---

const upgradeIds = [
  'candle_flicker',
  'passive_ember',
  'combo_window',
  'ad_luck',
  'crit_chance',
  'click_yield'
];

let marketUpgrades = upgradeIds.map(id => ({
  id,
  efficiency: 1.0,
  rating: 'FAIR',
  priceMultiplier: 1.0,
  trend: 'STABLE'
}));
let cycleStartedAt = Date.now();

function nextGaussian() {
  let u = 0, v = 0;
  while(u === 0) u = Math.random(); 
  while(v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function updateGlobalUpgrades() {
  const now = Date.now();
  cycleStartedAt = now;
  marketUpgrades = marketUpgrades.map(item => {
    const oldEff = item.efficiency;
    const volatility = 0.1;
    const effChange = nextGaussian() * volatility;
    let currentEff = oldEff + effChange;
    currentEff += (1.0 - currentEff) * 0.05; // pull to 1.0
    currentEff = Math.max(0.3, Math.min(2.0, currentEff));
    
    let rating = 'FAIR';
    if (currentEff >= 1.4) rating = 'HOT';
    else if (currentEff >= 1.1) rating = 'GOOD';
    else if (currentEff >= 0.8) rating = 'FAIR';
    else if (currentEff >= 0.5) rating = 'POOR';
    else rating = 'TERRIBLE';

    let trend = 'STABLE';
    if (currentEff > oldEff + 0.05) trend = 'RISING';
    else if (currentEff < oldEff - 0.05) trend = 'FALLING';

    const efficiencyPremium = (currentEff - 1.0) * 0.5;
    const priceMultiplier = Math.max(0.5, Math.min(3.0, 1.0 + efficiencyPremium));

    return {
      id: item.id,
      efficiency: parseFloat(currentEff.toFixed(4)),
      rating,
      priceMultiplier: parseFloat(priceMultiplier.toFixed(4)),
      trend
    };
  });
  console.log(`[${new Date().toISOString()}] Global upgrades pricing refreshed`);
}

// Init
updateGlobalUpgrades();
setInterval(updateGlobalUpgrades, 3600 * 1000);

app.get('/api/v1/market/events', (_req, res) => {
  res.json([currentMarketEvent]);
});

app.get('/api/v1/market/upgrades', (_req, res) => {
  res.json(marketUpgrades.map(u => ({ ...u, cycleStartedAt })));
});

// --- Status API ---

app.get('/status', (_req, res) => {
  res.json({ status: 'active', serverTime: Date.now(), db: leaderboardCol ? 'mongodb' : 'memory' });
});

app.listen(PORT, () => {
  console.log(`EmberScroll Backend running on port ${PORT}`);
});
