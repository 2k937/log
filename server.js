const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const path = require("path");
const fetch = require("node-fetch");
const fs = require("fs");
require("dotenv").config();

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

/* -------------------- STATS SETUP (ADDED) -------------------- */
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
/* ------------------------------------------------------------- */

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

// Determine environment
const isProduction = process.env.RENDER === "true";
const callbackURL = isProduction
  ? process.env.CALLBACK_URL_PROD
  : process.env.CALLBACK_URL;

// Discord OAuth2 Strategy
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

/* -------------------- START SERVER -------------------- */
const port = process.env.PORT || 3000;
const hostURL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;

app.listen(port, () => {
  console.log(`✅ Dashboard running at ${hostURL}`);
});
