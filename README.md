# EmberScroll Backend

Server pro mobilní hru EmberScroll. Zajišťuje sdílený žebříček (Leaderboard) a globální události na trhu.

## Jak to nasadit na Render.com

1. **GitHub:**
   - Vytvoř si nový repozitář na GitHubu.
   - Nahraj tam obsah této složky `backend` (přímo tyto soubory, ne celou složku).
   
2. **Render:**
   - Přihlas se na [Render.com](https://render.com).
   - Klikni na **New +** -> **Web Service**.
   - Vyber svůj GitHub repozitář.
   - Nastavení:
     - **Runtime:** `Node`
     - **Build Command:** `npm install`
     - **Start Command:** `node server.js`
   - Klikni na **Create Web Service**.

3. **Android App:**
   - Jakmile Render dokončí build, zkopíruj si URL (např. `https://tvuj-projekt.onrender.com`).
   - Otevři v Android projektu soubor `LeaderboardRepository.kt`.
   - Změň `BASE_URL` na tvoji novou adresu.
   - Sestav aplikaci znovu.

## API Endpoints

- `GET /api/v1/leaderboard` - Vrátí TOP 50 hráčů.
- `POST /api/v1/leaderboard` - Uloží skóre hráče.
- `GET /api/v1/market/events` - Vrátí aktuální globální událost.
