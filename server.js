const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const path = require("path");
const fetch = require("node-fetch"); // npm install node-fetch
require("dotenv").config();

const bot = require("./bot.js");
const { banUser, unbanUser, kickUser, timeoutUser, removeTimeout, warnUser, getWarnings, unwarnUser } = require("./bot");

const app = express();

// Body parser & session
app.use(bodyParser.json());
app.use(session({ secret: process.env.SESSION_SECRET || "erlc-dashboard", resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Determine environment
const isProduction = process.env.RENDER === "true";
const callbackURL = isProduction ? process.env.CALLBACK_URL_PROD : process.env.CALLBACK_URL;

// Discord OAuth2 Strategy
passport.use(new DiscordStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: callbackURL,
  scope: ["identify", "guilds"]
}, (accessToken, refreshToken, profile, done) => done(null, profile)));

// Auth routes
app.get("/auth/discord", passport.authenticate("discord"));
app.get("/auth/discord/callback", passport.authenticate("discord", { failureRedirect: "/" }), (req, res) => {
  res.redirect("/dashboard");
});

// Staff role check middleware
async function checkAuth(req, res, next) {
  if (!req.isAuthenticated()) return res.redirect("/");

  try {
    const guildId = process.env.GUILD_ID;
    const userId = req.user.id;

    // Fetch guild member info using bot token
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
      headers: { Authorization: `Bot ${process.env.TOKEN}` }
    });

    if (!response.ok) {
      console.error("Failed to fetch member:", await response.text());
      return res.send("Error fetching member info from Discord");
    }

    const member = await response.json();

    // Allowed staff roles
    const allowedRoles = [process.env.STAFF_ROLE_1, process.env.STAFF_ROLE_2];
    if (!member.roles.some(r => allowedRoles.includes(r))) {
      return res.status(403).send("No permission");
    }

    // User is staff
    next();
  } catch (err) {
    console.error(err);
    return res.send("Error verifying staff role");
  }
}

// Serve static files / dashboard
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/dashboard", checkAuth, (req, res) => res.sendFile(path.join(__dirname, "index.html")));

// API to check login status
app.get("/api/check-auth", (req, res) => {
  if (req.isAuthenticated()) return res.status(200).json({ loggedIn: true });
  res.status(401).json({ loggedIn: false });
});

// API routes
app.post("/api/ban", checkAuth, async (req, res) => { await banUser(req.body.userId, process.env.GUILD_ID); res.json({ message: `Banned ${req.body.userId}` }); });
app.post("/api/unban", checkAuth, async (req, res) => { await unbanUser(req.body.userId, process.env.GUILD_ID); res.json({ message: `Unbanned ${req.body.userId}` }); });
app.post("/api/kick", checkAuth, async (req, res) => { await kickUser(req.body.userId, process.env.GUILD_ID); res.json({ message: `Kicked ${req.body.userId}` }); });
app.post("/api/timeout", checkAuth, async (req, res) => { await timeoutUser(req.body.userId, process.env.GUILD_ID); res.json({ message: `Timeout ${req.body.userId}` }); });
app.post("/api/untimeout", checkAuth, async (req, res) => { await removeTimeout(req.body.userId, process.env.GUILD_ID); res.json({ message: `Removed timeout ${req.body.userId}` }); });
app.post("/api/warn", checkAuth, (req, res) => { warnUser(req.body.userId, req.body.reason); res.json({ message: `Warned ${req.body.userId}` }); });
app.get("/api/warnings/:id", checkAuth, (req, res) => res.json(getWarnings(req.params.id)));
app.post("/api/unwarn", checkAuth, (req, res) => { unwarnUser(req.body.userId); res.json({ message: `Cleared warnings for ${req.body.userId}` }); });

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Dashboard running at http://localhost:${port}`));

require("./page.js");
