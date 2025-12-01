const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const path = require("path");
const fetch = require("node-fetch"); 
require("dotenv").config();

// Bot functions
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

// Body parser + Session
app.use(bodyParser.json());
app.use(session({
    secret: process.env.SESSION_SECRET || "mod-dashboard",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// Serialize / Deserialize
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Determine environment for callback URL
const isProduction = process.env.RENDER === "true";
const callbackURL = isProduction ? process.env.CALLBACK_URL_PROD : process.env.CALLBACK_URL;

// Discord OAuth2 Strategy
passport.use(
    new DiscordStrategy(
        {
            clientID: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
            callbackURL: callbackURL,
            scope: ["identify", "guilds"]
        },
        (accessToken, refreshToken, profile, done) => done(null, profile)
    )
);

// Auth Routes
app.get("/auth/discord", passport.authenticate("discord"));

app.get(
    "/auth/discord/callback",
    passport.authenticate("discord", { failureRedirect: "/" }),
    (req, res) => res.redirect("/dashboard")
);

// Middleware - Staff Role Check
async function checkAuth(req, res, next) {
    if (!req.isAuthenticated()) return res.redirect("/");

    try {
        const guildId = process.env.GUILD_ID;
        const userId = req.user.id;

        // Fetch user’s guild roles
        const response = await fetch(
            `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
            {
                headers: {
                    Authorization: `Bot ${process.env.TOKEN}`
                }
            }
        );

        if (!response.ok) {
            console.error("Member fetch failed:", await response.text());
            return res.send("Error fetching member info");
        }

        const member = await response.json();

        const allowedRoles = [
            process.env.STAFF_ROLE_1,
            process.env.STAFF_ROLE_2
        ];

        const hasPermission = member.roles.some(r => allowedRoles.includes(r));

        if (!hasPermission) {
            return res.status(403).send("No permission");
        }

        next();
    } catch (err) {
        console.error("Auth check error:", err);
        res.send("Error verifying staff roles");
    }
}

// Static pages
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/dashboard", checkAuth, (req, res) =>
    res.sendFile(path.join(__dirname, "index.html"))
);

// API - Check login status
app.get("/api/check-auth", (req, res) => {
    if (req.isAuthenticated())
        return res.json({ loggedIn: true, user: req.user });
    res.status(401).json({ loggedIn: false });
});

// Moderation API Routes
app.post("/api/ban", checkAuth, async (req, res) => {
    await banUser(req.body.userId, process.env.GUILD_ID);
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
    res.json({ message: `Timeout added to ${req.body.userId}` });
});

app.post("/api/untimeout", checkAuth, async (req, res) => {
    await removeTimeout(req.body.userId, process.env.GUILD_ID);
    res.json({ message: `Timeout removed for ${req.body.userId}` });
});

app.post("/api/warn", checkAuth, (req, res) => {
    warnUser(req.body.userId, req.body.reason);
    res.json({ message: `Warned ${req.body.userId}` });
});

app.get("/api/warnings/:id", checkAuth, (req, res) => {
    res.json(getWarnings(req.params.id));
});

app.post("/api/unwarn", checkAuth, (req, res) => {
    unwarnUser(req.body.userId);
    res.json({ message: `Cleared warnings for ${req.body.userId}` });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () =>
    console.log(`✅ Dashboard running at http://localhost:${port}`)
);

