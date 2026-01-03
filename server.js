const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const path = require("path");
const fetch = require("node-fetch");
const fs = require("fs");
require("dotenv").config();

// NGROK
const ngrok = require("ngrok");

const bot = require("./bot.js");
const {
  banUser,
  unbanUser,
  kickUser,
  timeoutUser,
  removeTimeout,
  warnUser,
  getWarnings,
  unwarnUser
} = require("./bot");

const app = express();

/* -------------------- STATS SETUP -------------------- */
const STATS_FILE = "./stats.json";
if (!fs.existsSync(STATS_FILE)) {
  fs.writeFileSync(STATS_FILE, JSON.stringify({}));
}

function logStat(type) {
  const stats = JSON.parse(fs.readFileSync(STATS_FILE));
  const today = new Date().toISOString().split("T")[0];

  if (!stats[today]) {
    stats[today] = { warn: 0, timeout: 0, ban: 0 };
  }

  stats[today][type]++;
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}
/* ----------------------------------------------------- */

// Body parser & session
app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET || "mod-dashboard",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Discord OAuth2 Strategy
let callbackURL = process.env.CALLBACK_URL || "http://localhost:3000/api/auth/discord/callback";
passport.use(new DiscordStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL,
  scope: ["identify", "guilds"]
}, (accessToken, refreshToken, profile, done) => done(null, profile)));

// Auth routes
app.get("/auth/discord", passport.authenticate("discord"));
app.get("/auth/discord/callback",
  passport.authenticate("discord", { failureRedirect: "/" }),
  (req, res) => res.redirect("/dashboard")
);

// Staff role check middleware
async function checkAuth(req, res, next) {
  if (!req.isAuthenticated()) return res.redirect("/");

  try {
    const guildId = process.env.GUILD_ID;
    const userId = req.user.id;

    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
      { headers: { Authorization: `Bot ${process.env.TOKEN}` } }
    );

    if (!response.ok) return res.status(500).send("Discord API error");

    const member = await response.json();
    const allowedRoles = [
      process.env.STAFF_ROLE_1,
      process.env.STAFF_ROLE_2
    ];

    if (!member.roles.some(r => allowedRoles.includes(r))) {
      return res.status(403).send("No permission");
    }

    next();
  } catch (err) {
    console.error(err);
    res.send("Error verifying staff role");
  }
}

// Serve dashboard
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);
app.get("/dashboard", checkAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);

// Auth status
app.get("/api/check-auth", (req, res) => {
  if (req.isAuthenticated()) return res.json({ loggedIn: true });
  res.status(401).json({ loggedIn: false });
});

/* -------------------- MODERATION ROUTES -------------------- */
app.post("/api/ban", checkAuth, async (req, res) => {
  await banUser(req.body.userId, process.env.GUILD_ID);
  logStat("ban");
  res.json({ message: `Banned ${req.body.userId}` });
});

app.post("/api/unban", checkAuth, async (req, res) => {
  await unbanUser(req.body.userId, process.env.GUILD_ID);
  res.json({ message: `Unbanned ${req.body.userId}` });
});

app.post("/api/kick", checkAuth, async (req, res) => {
  await kickUser(req.body.userId, process.env.GUILD_ID);
  res.json({ message: `Kicked ${req.body.userId}` });
});

app.post("/api/timeout", checkAuth, async (req, res) => {
  await timeoutUser(req.body.userId, process.env.GUILD_ID);
  logStat("timeout");
  res.json({ message: `Timeout ${req.body.userId}` });
});

app.post("/api/untimeout", checkAuth, async (req, res) => {
  await removeTimeout(req.body.userId, process.env.GUILD_ID);
  res.json({ message: `Removed timeout ${req.body.userId}` });
});

app.post("/api/warn", checkAuth, (req, res) => {
  warnUser(req.body.userId, req.body.reason);
  logStat("warn");
  res.json({ message: `Warned ${req.body.userId}` });
});

app.get("/api/warnings/:id", checkAuth, (req, res) => {
  res.json(getWarnings(req.params.id));
});

app.post("/api/unwarn", checkAuth, (req, res) => {
  unwarnUser(req.body.userId);
  res.json({ message: `Cleared warnings for ${req.body.userId}` });
});

/* -------------------- STATS ENDPOINT -------------------- */
app.get("/api/stats", checkAuth, (req, res) => {
  const stats = JSON.parse(fs.readFileSync(STATS_FILE));
  const labels = Object.keys(stats);

  res.json({
    labels,
    warns: labels.map(d => stats[d].warn),
    timeouts: labels.map(d => stats[d].timeout),
    bans: labels.map(d => stats[d].ban)
  });
});

/* -------------------- RESOLVE USER ROUTE -------------------- */
app.post("/api/resolve-user", checkAuth, async (req, res) => {
  const { query } = req.body;

  if (!query) return res.status(400).json({ error: "No query provided" });

  try {
    const guildId = process.env.GUILD_ID;
    let userData;

    // First, try fetching by user ID
    if (/^\d+$/.test(query)) {
      const response = await fetch(`https://discord.com/api/v10/users/${query}`, {
        headers: { Authorization: `Bot ${process.env.TOKEN}` }
      });

      if (response.ok) {
        userData = await response.json();
        return res.json({ id: userData.id, username: userData.username });
      }
    }

    // Otherwise, search guild members by username (case-insensitive)
    const membersResp = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`,
      { headers: { Authorization: `Bot ${process.env.TOKEN}` } }
    );
    const members = await membersResp.json();

    const member = members.find(
      m => m.user.username.toLowerCase() === query.toLowerCase() ||
           `${m.user.username}#${m.user.discriminator}`.toLowerCase() === query.toLowerCase()
    );

    if (!member) return res.json({}); // not found

    userData = { id: member.user.id, username: member.user.username };
    res.json(userData);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to resolve user" });
  }
});

/* -------------------- START SERVER + NGROK -------------------- */
const port = process.env.PORT || 3000;

(async () => {
  const server = app.listen(port, async () => {
    console.log(`✅ Dashboard running locally on port ${port}`);

    // NGROK setup
    try {
      // Kill any leftover tunnels first
      await ngrok.kill();

      // Retry logic in case ngrok fails
      let url;
      const maxRetries = 3;
      for (let i = 0; i < maxRetries; i++) {
        try {
          url = await ngrok.connect({
            addr: port,
            proto: "http", // HTTP tunnel
            authtoken: process.env.NGROK_AUTH_TOKEN || undefined // optional
          });
          break; // success
        } catch (err) {
          console.warn(`⚠️ Ngrok attempt ${i + 1} failed: ${err.message || err}`);
          if (i === maxRetries - 1) throw err; // give up after retries
        }
      }

      console.log(`🚀 Public URL: ${url}`);
      console.log(`✅ Discord OAuth callback: ${url}/auth/discord/callback`);

      // Update callbackURL dynamically
      callbackURL = `${url}/auth/discord/callback`;

    } catch (err) {
      console.error("⚠️ Failed to start ngrok after retries:", err.message || err);
      console.log("ℹ️ You can still access your website locally at http://localhost:" + port);
    }
  });
})();
