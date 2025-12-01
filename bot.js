const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require("discord.js");
const fs = require("fs");
require("dotenv").config();


const PREFIX = "!"; // Prefix commands
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    
});


require("./ticket.js")(client); // load ticket system
const AutoMod = require("./automod.js");
AutoMod(client);
require("./verify-bloxlink.js")(client);
let warnings = {};
const WARN_FILE = "./warnings.json";

// Load warnings from file
if (fs.existsSync(WARN_FILE)) warnings = JSON.parse(fs.readFileSync(WARN_FILE, "utf8"));
function saveWarnings() { fs.writeFileSync(WARN_FILE, JSON.stringify(warnings, null, 2)); }

// Moderation functions
async function banUser(userId, guildId) {
    try {
        const g = await client.guilds.fetch(guildId);
        await g.members.ban(userId, { reason: "You have been banned by our moderation team for violating server rules. Contact moderators if you believe this was a mistake." });
    } catch (e) { console.error(e); }
}

async function unbanUser(userId, guildId) {
    try {
        const g = await client.guilds.fetch(guildId);
        await g.bans.remove(userId, "Your ban has been lifted by our moderation team. Please follow server rules moving forward.");
    } catch (e) { console.error(e); }
}

async function kickUser(userId, guildId) {
    try {
        const g = await client.guilds.fetch(guildId);
        const m = await g.members.fetch(userId);
        await m.kick("You have been removed from the server by the moderation team for violating server rules. Please review rules before rejoining.");
    } catch (e) { console.error(e); }
}

async function timeoutUser(userId, guildId, duration = 10 * 60 * 1000) {
    try {
        const g = await client.guilds.fetch(guildId);
        const m = await g.members.fetch(userId);
        await m.timeout(duration, "You have been temporarily timed out by the moderation team for violating server rules. Review rules before participating again.");
    } catch (e) { console.error(e); }
}

async function removeTimeout(userId, guildId) {
    try {
        const g = await client.guilds.fetch(guildId);
        const m = await g.members.fetch(userId);
        await m.timeout(null);
    } catch (e) { console.error(e); }
}

function warnUser(userId, reason) {
    if (!warnings[userId]) warnings[userId] = [];
    warnings[userId].push(reason || "Violation of server rules");
    saveWarnings();
}

function getWarnings(userId) {
    return { userId, warnings: warnings[userId] || [] };
}

function unwarnUser(userId) {
    warnings[userId] = [];
    saveWarnings();
}

// Slash commands
const commands = [
    new SlashCommandBuilder().setName("ban").setDescription("Ban a user").addStringOption(o => o.setName("user").setDescription("User mention or ID").setRequired(true)),
    new SlashCommandBuilder().setName("unban").setDescription("Unban a user").addStringOption(o => o.setName("user").setDescription("User ID").setRequired(true)),
    new SlashCommandBuilder().setName("kick").setDescription("Kick a user").addStringOption(o => o.setName("user").setDescription("User mention or ID").setRequired(true)),
    new SlashCommandBuilder().setName("timeout").setDescription("Timeout a user (10m)").addStringOption(o => o.setName("user").setDescription("User mention or ID").setRequired(true)),
    new SlashCommandBuilder().setName("untimeout").setDescription("Remove timeout").addStringOption(o => o.setName("user").setDescription("User mention or ID").setRequired(true)),
    new SlashCommandBuilder().setName("warn").setDescription("Warn a user").addStringOption(o => o.setName("user").setDescription("User mention or ID").setRequired(true)).addStringOption(o => o.setName("reason").setDescription("Reason")),
    new SlashCommandBuilder().setName("warnings").setDescription("Check warnings").addStringOption(o => o.setName("user").setDescription("User mention or ID").setRequired(true)),
    new SlashCommandBuilder().setName("unwarn").setDescription("Clear warnings").addStringOption(o => o.setName("user").setDescription("User mention or ID").setRequired(true))
].map(c => c.toJSON());



// Register slash commands and set rotating statuses
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // List of rotating statuses
  const statuses = [
    { name: `${s.name} Moderation`, type: 0 },   // Playing
    { name: `over staff team`, type: 3 },     // Watching
    { name: `over server`, type: 3 }      // Watching
  ];

  let i = 0;
  setInterval(() => {
    const status = statuses[i];
    client.user.setActivity(status.name, { type: status.type });
    i = (i + 1) % statuses.length; // Loop through statuses
  }, 10000); // Change every 10 seconds

  // Register slash commands
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("✅ Slash commands registered");
  } catch (error) {
    console.error(error);
  }
});

// Helper to resolve user from mention or ID
async function resolveUser(guild, str) {
    let id = str.replace(/[<@!>]/g, "");
    try { return await guild.members.fetch(id); } catch { return null; }
}

// Interaction handler
client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

const staffRoles = [
  process.env.STAFF_ROLE_1,
  process.env.STAFF_ROLE_2
];

if (!interaction.member.roles.cache.some(r => staffRoles.includes(r.id))) {
    return interaction.reply({ content: "❌ No permission", ephemeral: true });
}



    const userInput = interaction.options.getString("user");
    const userMember = await resolveUser(interaction.guild, userInput);
    if (!userMember && interaction.commandName !== "unban") {
        return interaction.reply({ content: "❌ User not found" });
    }

    const embed = new EmbedBuilder().setFooter({ text: "Made by idkk" }).setTimestamp();

    try {
        switch (interaction.commandName) {
            case "ban":
                await banUser(userMember.id, interaction.guild.id);
                embed.setTitle("User Banned").setDescription(`🔨 Banned **${userMember.user.tag}**`).setColor("#FF0000");
                break;
            case "unban":
                await unbanUser(userInput, interaction.guild.id);
                embed.setTitle("User Unbanned").setDescription(`✅ Unbanned <@${userInput}>`).setColor("#00FF00");
                break;
            case "kick":
                await kickUser(userMember.id, interaction.guild.id);
                embed.setTitle("User Kicked").setDescription(`👢 Kicked **${userMember.user.tag}**`).setColor("#FFA500");
                break;
            case "timeout":
                await timeoutUser(userMember.id, interaction.guild.id);
                embed.setTitle("User Timed Out").setDescription(`⏳ Timeout 10 minutes for **${userMember.user.tag}**`).setColor("#800080");
                break;
            case "untimeout":
                await removeTimeout(userMember.id, interaction.guild.id);
                embed.setTitle("Timeout Removed").setDescription(`✅ Removed timeout for **${userMember.user.tag}**`).setColor("#00FFFF");
                break;
            case "warn":
                const reason = interaction.options.getString("reason") || "No reason";
                warnUser(userMember.id, reason);
                embed.setTitle("User Warned").setDescription(`⚠️ Warned **${userMember.user.tag}**\nReason: ${reason}`).setColor("#FFA500");
                break;
            case "warnings":
                const warningsList = getWarnings(userMember.id).warnings;
                embed.setTitle("User Warnings").setDescription(warningsList.length ? warningsList.map((w,i)=>`${i+1}. ${w}`).join("\n") : "No warnings").setColor("#808080");
                break;
            case "unwarn":
                unwarnUser(userMember.id);
                embed.setTitle("Warnings Cleared").setDescription(`✅ Cleared warnings for **${userMember.user.tag}**`).setColor("#FF69B4");
                break;
        }
        await interaction.reply({ embeds: [embed] });
    } catch (err) {
        console.error(err);
        await interaction.reply({ content: "❌ Something went wrong" });
    }
});

// Prefix command support
client.on("messageCreate", async message => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/g);
    const cmd = args.shift().toLowerCase();
const staffRoles = [
  process.env.STAFF_ROLE_1,
  process.env.STAFF_ROLE_2
];

if (!message.member.roles.cache.some(r => staffRoles.includes(r.id))) {
    return message.channel.send("❌ You don't have permission to use this command.");
}


const targetArg = args[0];
if (!targetArg) return message.channel.send("❌ Please provide a user mention or ID");

const targetId = targetArg.replace(/[<@!>]/g, ""); // safe now
const targetMember = await resolveUser(message.guild, targetArg); // resolves mention or ID
const reason = args.slice(1).join(" ") || "No reason";

    const embed = new EmbedBuilder().setFooter({ text: "Made by idkk" }).setTimestamp();

    try {
        switch (cmd) {
            case "ban":
                if (!targetMember) return message.channel.send("❌ User not found");
                await banUser(targetMember.id, message.guild.id);
                embed.setTitle("User Banned").setDescription(`🔨 Banned **${targetMember.user.tag}**`).setColor("#FF0000");
                break;
            case "unban":
                if (!targetId) return message.channel.send("❌ Provide user ID");
                await unbanUser(targetId, message.guild.id);
                embed.setTitle("User Unbanned").setDescription(`✅ Unbanned <@${targetId}>`).setColor("#00FF00");
                break;
            case "kick":
                if (!targetMember) return message.channel.send("❌ User not found");
                await kickUser(targetMember.id, message.guild.id);
                embed.setTitle("User Kicked").setDescription(`👢 Kicked **${targetMember.user.tag}**`).setColor("#FFA500");
                break;
            case "timeout":
                if (!targetMember) return message.channel.send("❌ User not found");
                await timeoutUser(targetMember.id, message.guild.id);
                embed.setTitle("User Timed Out").setDescription(`⏳ Timeout 10 minutes for **${targetMember.user.tag}**`).setColor("#800080");
                break;
            case "untimeout":
                if (!targetMember) return message.channel.send("❌ User not found");
                await removeTimeout(targetMember.id, message.guild.id);
                embed.setTitle("Timeout Removed").setDescription(`✅ Removed timeout for **${targetMember.user.tag}**`).setColor("#00FFFF");
                break;
            case "warn":
                if (!targetMember) return message.channel.send("❌ User not found");
                warnUser(targetMember.id, reason);
                embed.setTitle("User Warned").setDescription(`⚠️ Warned **${targetMember.user.tag}**\nReason: ${reason}`).setColor("#FFA500");
                break;
            case "warnings":
                if (!targetMember) return message.channel.send("❌ User not found");
                const warningsList = getWarnings(targetMember.id).warnings;
                embed.setTitle("User Warnings").setDescription(warningsList.length ? warningsList.map((w,i)=>`${i+1}. ${w}`).join("\n") : "No warnings").setColor("#808080");
                break;
            case "unwarn":
                if (!targetMember) return message.channel.send("❌ User not found");
                unwarnUser(targetMember.id);
                embed.setTitle("Warnings Cleared").setDescription(`✅ Cleared warnings for **${targetMember.user.tag}**`).setColor("#FF69B4");
                break;
            default:
                return;
        }
        await message.channel.send({ embeds: [embed] });
    } catch (err) {
        console.error(err);
        message.channel.send("❌ Something went wrong");
    }
});

module.exports = { banUser, unbanUser, kickUser, timeoutUser, removeTimeout, warnUser, getWarnings, unwarnUser };
client.login(process.env.TOKEN);
