const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const path = require("path");
require("dotenv").config();

const { banUser, unbanUser, kickUser, timeoutUser, removeTimeout, warnUser, getWarnings, unwarnUser } = require("./bot");

const app = express();
app.use(bodyParser.json());
app.use(session({ secret: "erlc-dashboard", resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: process.env.CALLBACK_URL,
  scope: ["identify", "guilds", "guilds.members.read"]
}, (accessToken, refreshToken, profile, done) => {
  return done(null, profile);
}));

// Auth routes
app.get("/auth/discord", passport.authenticate("discord"));
app.get("/auth/discord/callback", passport.authenticate("discord", { failureRedirect: "/" }), (req, res) => {
  res.redirect("/dashboard");
});

function checkAuth(req, res, next) {
  if (!req.isAuthenticated()) return res.redirect("/");
  const roles = req.user.guilds.find(g => g.id === process.env.GUILD_ID)?.roles || [];
  const allowedRoles = ["1308099417315999804", "1308100754778886287"];
  if (!roles.some(r => allowedRoles.includes(r))) return res.status(403).send("No permission");
  next();
}

// Serve files
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/dashboard", checkAuth, (req, res) => res.sendFile(path.join(__dirname, "index.html")));

// API routes
app.post("/api/ban", checkAuth, async (req, res) => { await banUser(req.body.userId, process.env.GUILD_ID); res.json({ message: `Banned ${req.body.userId}` }); });
app.post("/api/unban", checkAuth, async (req, res) => { await unbanUser(req.body.userId, process.env.GUILD_ID); res.json({ message: `Unbanned ${req.body.userId}` }); });
app.post("/api/kick", checkAuth, async (req, res) => { await kickUser(req.body.userId, process.env.GUILD_ID); res.json({ message: `Kicked ${req.body.userId}` }); });
app.post("/api/timeout", checkAuth, async (req, res) => { await timeoutUser(req.body.userId, process.env.GUILD_ID); res.json({ message: `Timeout ${req.body.userId}` }); });
app.post("/api/untimeout", checkAuth, async (req, res) => { await removeTimeout(req.body.userId, process.env.GUILD_ID); res.json({ message: `Removed timeout ${req.body.userId}` }); });
app.post("/api/warn", checkAuth, (req, res) => { warnUser(req.body.userId, req.body.reason); res.json({ message: `Warned ${req.body.userId}` }); });
app.get("/api/warnings/:id", checkAuth, (req, res) => res.json(getWarnings(req.params.id)));
app.post("/api/unwarn", checkAuth, (req, res) => { unwarnUser(req.body.userId); res.json({ message: `Cleared warnings for ${req.body.userId}` }); });

app.listen(3000, () => console.log("✅ Dashboard running at http://localhost:3000"));
