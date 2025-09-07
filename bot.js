const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require("discord.js");
const fs = require("fs");
require("dotenv").config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

let warnings = {};
const WARN_FILE = "./warnings.json";

// Load warnings
if (fs.existsSync(WARN_FILE)) warnings = JSON.parse(fs.readFileSync(WARN_FILE, "utf8"));
function saveWarnings() { fs.writeFileSync(WARN_FILE, JSON.stringify(warnings, null, 2)); }

// Mod functions
async function banUser(userId, guildId) { try { const g = await client.guilds.fetch(guildId); await g.members.ban(userId, { reason: "Dashboard/Command ban" }); } catch (e) { console.error(e); } }
async function unbanUser(userId, guildId) { try { const g = await client.guilds.fetch(guildId); await g.bans.remove(userId, "Dashboard/Command unban"); } catch (e) { console.error(e); } }
async function kickUser(userId, guildId) { try { const g = await client.guilds.fetch(guildId); const m = await g.members.fetch(userId); await m.kick("Dashboard/Command kick"); } catch (e) { console.error(e); } }
async function timeoutUser(userId, guildId) { try { const g = await client.guilds.fetch(guildId); const m = await g.members.fetch(userId); await m.timeout(10 * 60 * 1000, "Dashboard/Command timeout"); } catch (e) { console.error(e); } }
async function removeTimeout(userId, guildId) { try { const g = await client.guilds.fetch(guildId); const m = await g.members.fetch(userId); await m.timeout(null); } catch (e) { console.error(e); } }
function warnUser(userId, reason) { if (!warnings[userId]) warnings[userId] = []; warnings[userId].push(reason || "No reason"); saveWarnings(); }
function getWarnings(userId) { return { userId, warnings: warnings[userId] || [] }; }
function unwarnUser(userId) { warnings[userId] = []; saveWarnings(); }

// Slash commands
const commands = [
  new SlashCommandBuilder().setName("ban").setDescription("Ban a user").addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("unban").setDescription("Unban a user").addStringOption(o => o.setName("userid").setDescription("User ID").setRequired(true)),
  new SlashCommandBuilder().setName("kick").setDescription("Kick a user").addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("timeout").setDescription("Timeout a user (10m)").addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("untimeout").setDescription("Remove timeout").addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("warn").setDescription("Warn a user").addUserOption(o => o.setName("user").setDescription("User").setRequired(true)).addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false)),
  new SlashCommandBuilder().setName("warnings").setDescription("Check warnings").addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("unwarn").setDescription("Clear warnings").addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
].map(c => c.toJSON());

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setActivity("ERLC FRSP", { type: 3 });
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID), { body: commands });
  console.log("✅ Slash commands registered");
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const staffRoles = ["1308100754778886287", "1308100754778886287"];
  if (!interaction.member.roles.cache.some(r => staffRoles.includes(r.id))) return interaction.reply({ content: "❌ No permission", ephemeral: true });

  const user = interaction.options.getUser("user");
  switch (interaction.commandName) {
    case "ban": await banUser(user.id, interaction.guild.id); return interaction.reply(`🔨 Banned ${user.tag}`);
    case "unban": await unbanUser(interaction.options.getString("userid"), interaction.guild.id); return interaction.reply(`✅ Unbanned`);
    case "kick": await kickUser(user.id, interaction.guild.id); return interaction.reply(`👢 Kicked ${user.tag}`);
    case "timeout": await timeoutUser(user.id, interaction.guild.id); return interaction.reply(`⏳ Timeout ${user.tag}`);
    case "untimeout": await removeTimeout(user.id, interaction.guild.id); return interaction.reply(`✅ Removed timeout from ${user.tag}`);
    case "warn": warnUser(user.id, interaction.options.getString("reason")); return interaction.reply(`⚠️ Warned ${user.tag}`);
    case "warnings": return interaction.reply(`📋 Warnings: ${JSON.stringify(getWarnings(user.id).warnings)}`);
    case "unwarn": unwarnUser(user.id); return interaction.reply(`✅ Cleared warnings for ${user.tag}`);
  }
});

module.exports = { banUser, unbanUser, kickUser, timeoutUser, removeTimeout, warnUser, getWarnings, unwarnUser };
client.login(process.env.TOKEN);
