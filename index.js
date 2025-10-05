// -----------------------------------------------------------------------------
// | index.js pro Unity hru "Candle Clicker"                                     |
// | Vylepšená verze s publikacemi a zprávami                                   |
// -----------------------------------------------------------------------------

// Krok 1: Import potřebných modulů
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config(); // Načte "Secrets" z Replitu

// Krok 2: Inicializace aplikace
const app = express();
const port = process.env.PORT || 3000;

// Krok 3: Nastavení "Middleware"
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Krok 4: Připojení k MongoDB databázi
const mongoUri = process.env.MONGO_URI;
mongoose
    .connect(mongoUri)
    .then(() => console.log("✅ Připojeno k MongoDB."))
    .catch((err) => console.error("❌ Chyba připojení k MongoDB:", err));

// Krok 5: Definice datových struktur (Schémat)
const ProgressSchema = new mongoose.Schema({
    upgradeCost: { type: Number, default: 200 },
    upgradeLevel: { type: Number, default: 1 },
    currentFireType: { type: String, default: "Basic" },
    clickBonus: { type: Number, default: 0 },
    adRewardMultiplier: { type: Number, default: 1.75 },
    offlineRewardMultiplier: { type: Number, default: 46 },
    fireCounts: [{ fireType: String, count: Number }],
    unlockedArtifacts: [{ artifactType: String, isUnlocked: Boolean }],
    equippedArtifacts: [String],
});

const PublicationSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    progress: { type: ProgressSchema },
});

const MessageSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    senderUsername: { type: String, required: true },
    content: { type: String, required: true, maxlength: 200 },
    createdAt: { type: Date, default: Date.now, expires: "24h" }, // Zprávy se po 24h smažou
});

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
    },
    password: { type: String, required: true },
    profilePicture: { type: String, default: "" },
    publications: [PublicationSchema],
    liveProgress: { type: ProgressSchema },
});

const User = mongoose.model("User", UserSchema);
const Message = mongoose.model("Message", MessageSchema);

// -----------------------------------------------------------------------------
// | API Endpoints (Adresy, na které se hra připojuje)                          |
// -----------------------------------------------------------------------------

// Endpoint pro ověření, že server běží
app.get("/", (req, res) => {
    res.send("Server pro Candle Clicker je online!");
});

// --- Autentizace ---
app.get("/register", async (req, res) => {
    try {
        const { username, password } = req.query;
        if (!username || !password) {
            return res.status(400).json({ message: "Chybí jméno nebo heslo." });
        }
        if (await User.findOne({ username })) {
            return res
                .status(409)
                .json({ message: "Uživatel s tímto jménem již existuje." });
        }
        const newUser = new User({ username, password });
        await newUser.save();
        res.status(201).json({
            message: "Registrace úspěšná!",
            userId: newUser._id,
        });
    } catch (error) {
        res.status(500).json({ message: "Chyba serveru při registraci." });
    }
});

app.get("/login", async (req, res) => {
    try {
        const { username, password } = req.query;
        if (!username || !password) {
            return res.status(400).json({ message: "Chybí jméno nebo heslo." });
        }
        const user = await User.findOne({ username });
        if (!user || user.password !== password) {
            return res
                .status(401)
                .json({ message: "Neplatné jméno nebo heslo." });
        }
        res.status(200).json({
            message: "Přihlášení úspěšné!",
            userId: user._id,
        });
    } catch (error) {
        res.status(500).json({ message: "Chyba serveru při přihlášení." });
    }
});

// --- Postup Hráče ---
app.post("/progress/:userId", async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.params.userId, {
            liveProgress: req.body,
        });
        res.status(200).json({ message: "Postup uložen." });
    } catch (error) {
        res.status(500).json({ message: "Chyba při ukládání postupu." });
    }
});

app.get("/progress/:userId", async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        res.status(200).json(user?.liveProgress || {});
    } catch (error) {
        res.status(500).json({ message: "Chyba při načítání postupu." });
    }
});

// --- Sociální Funkce ---
app.post("/publish/:userId", async (req, res) => {
    try {
        const newPublication = { progress: req.body };
        await User.findByIdAndUpdate(req.params.userId, {
            $push: { publications: newPublication },
        });
        res.status(200).json({ message: "Postup byl úspěšně zveřejněn." });
    } catch (error) {
        res.status(500).json({ message: "Chyba při zveřejňování postupu." });
    }
});

app.get("/users/search", async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) {
            return res
                .status(400)
                .json({ message: "Chybí parametr pro vyhledávání." });
        }
        const users = await User.find({
            username: new RegExp(`^${username}`, "i"),
        })
            .select("_id username profilePicture")
            .limit(10);
        res.status(200).json({ users: users }); // Zabaleno do objektu pro snazší parsování v Unity
    } catch (error) {
        res.status(500).json({ message: "Chyba při vyhledávání uživatelů." });
    }
});

app.get("/profile/:userId", async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select(
            "username publications profilePicture",
        );
        if (!user) {
            return res.status(404).json({ message: "Uživatel nenalezen." });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: "Chyba při načítání profilu." });
    }
});

// --- Zprávy ---
app.post("/messages/send", async (req, res) => {
    console.log("=========================================");
    console.log("DORAZIL POŽADAVEK NA /messages/send");
    console.log("Tělo požadavku (req.body):", req.body);
    console.log("=========================================");
    try {
        const { senderId, recipientId, senderUsername, content } = req.body;
        if (!senderId || !recipientId || !content || !senderUsername) {
            return res
                .status(400)
                .json({ message: "Chybí potřebná data pro odeslání zprávy." });
        }
        const newMessage = new Message({
            senderId,
            recipientId,
            senderUsername,
            content,
        });
        await newMessage.save();
        res.status(201).json({ message: "Zpráva úspěšně odeslána." });
    } catch (error) {
        res.status(500).json({
            message: "Chyba serveru při odesílání zprávy.",
        });
    }
});

app.get("/messages/conversation", async (req, res) => {
    try {
        const { user1Id, user2Id } = req.query; // Načteme ID obou uživatelů

        if (!user1Id || !user2Id) {
            return res.status(400).json({ message: "Chybí ID uživatelů." });
        }

        const messages = await Message.find({
            $or: [
                { senderId: user1Id, recipientId: user2Id },
                { senderId: user2Id, recipientId: user1Id },
            ],
        }).sort({ createdAt: 1 }); // Seřadíme od nejstarší po nejnovější

        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ message: "Chyba při načítání konverzace." });
    }
});

app.post("/profile/picture/:userId", async (req, res) => {
    try {
        const { imageBase64 } = req.body;
        // Serverová pojistka: kontrola velikosti textu (cca 32 KB)
        if (!imageBase64 || imageBase64.length > 32 * 1024) {
            return res
                .status(400)
                .json({ message: "Obrázek je příliš velký nebo chybí." });
        }
        await User.findByIdAndUpdate(req.params.userId, {
            profilePicture: imageBase64,
        });
        res.status(200).json({ message: "Profilový obrázek aktualizován." });
    } catch (error) {
        res.status(500).json({ message: "Chyba při nahrávání obrázku." });
    }
});

// Krok 6: Spuštění serveru
app.listen(port, () => {
    console.log(
        `🚀 Server poslouchá na portu ${port}. Aplikace je připravena.`,
    );
});
