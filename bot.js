const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require("discord.js");
const fs = require("fs");
require("dotenv").config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

let warnings = {};
const WARN_FILE = "./warnings.json";

// Load warnings
if (fs.existsSync(WARN_FILE)) warnings = JSON.parse(fs.readFileSync(WARN_FILE, "utf8"));
function saveWarnings() { fs.writeFileSync(WARN_FILE, JSON.stringify(warnings, null, 2)); }

// Moderation functions
async function banUser(userId, guildId) { 
  try { 
    const g = await client.guilds.fetch(guildId); 
    await g.members.ban(userId, { reason: "Dashboard/Command ban" }); 
  } catch (e) { console.error(e); } 
}
async function unbanUser(userId, guildId) { 
  try { 
    const g = await client.guilds.fetch(guildId); 
    await g.bans.remove(userId, "Dashboard/Command unban"); 
  } catch (e) { console.error(e); } 
}
async function kickUser(userId, guildId) { 
  try { 
    const g = await client.guilds.fetch(guildId); 
    const m = await g.members.fetch(userId); 
    await m.kick("Dashboard/Command kick"); 
  } catch (e) { console.error(e); } 
}
async function timeoutUser(userId, guildId) { 
  try { 
    const g = await client.guilds.fetch(guildId); 
    const m = await g.members.fetch(userId); 
    await m.timeout(10 * 60 * 1000, "Dashboard/Command timeout"); 
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
  warnings[userId].push(reason || "No reason"); 
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
  new SlashCommandBuilder().setName("ban").setDescription("Ban a user").addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("unban").setDescription("Unban a user").addStringOption(o => o.setName("userid").setDescription("User ID").setRequired(true)),
  new SlashCommandBuilder().setName("kick").setDescription("Kick a user").addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("timeout").setDescription("Timeout a user (10m)").addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("untimeout").setDescription("Remove timeout").addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("warn").setDescription("Warn a user").addUserOption(o => o.setName("user").setDescription("User").setRequired(true)).addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false)),
  new SlashCommandBuilder().setName("warnings").setDescription("Check warnings").addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("unwarn").setDescription("Clear warnings").addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
].map(c => c.toJSON());

// Register slash commands
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setActivity("ERLC FRSP", { type: 3 });

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID), { body: commands });
  console.log("✅ Slash commands registered");
});

// Interaction handler
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const staffRoles = ["1403175043353284638", "1414300431924072589"];
  if (!interaction.member.roles.cache.some(r => staffRoles.includes(r.id))) {
    return interaction.reply({ content: "❌ No permission", ephemeral: true });
  }

  // Defer reply to prevent Unknown Interaction errors
  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  const user = interaction.options.getUser("user");
  const embed = new EmbedBuilder().setFooter({ text: "ERLC FRSP Dashboard" }).setTimestamp();

  try {
    switch (interaction.commandName) {
      case "ban":
        await banUser(user.id, interaction.guild.id);
        embed.setTitle("User Banned").setDescription(`🔨 Banned **${user.tag}**`).setColor("#FF0000");
        break;

      case "unban":
        const unbanId = interaction.options.getString("userid");
        await unbanUser(unbanId, interaction.guild.id);
        embed.setTitle("User Unbanned").setDescription(`✅ Unbanned <@${unbanId}>`).setColor("#00FF00");
        break;

      case "kick":
        await kickUser(user.id, interaction.guild.id);
        embed.setTitle("User Kicked").setDescription(`👢 Kicked **${user.tag}**`).setColor("#FFA500");
        break;

      case "timeout":
        await timeoutUser(user.id, interaction.guild.id);
        embed.setTitle("User Timed Out").setDescription(`⏳ Timeout 10 minutes for **${user.tag}**`).setColor("#800080");
        break;

      case "untimeout":
        await removeTimeout(user.id, interaction.guild.id);
        embed.setTitle("Timeout Removed").setDescription(`✅ Removed timeout for **${user.tag}**`).setColor("#00FFFF");
        break;

      case "warn":
        const reason = interaction.options.getString("reason") || "No reason";
        warnUser(user.id, reason);
        embed.setTitle("User Warned").setDescription(`⚠️ Warned **${user.tag}**\nReason: ${reason}`).setColor("#FFA500");
        break;

      case "warnings":
        const warningsList = getWarnings(user.id).warnings;
        embed.setTitle("User Warnings")
          .setDescription(warningsList.length ? warningsList.map((w,i)=>`${i+1}. ${w}`).join("\n") : "No warnings")
          .setColor("#808080");
        break;

      case "unwarn":
        unwarnUser(user.id);
        embed.setTitle("Warnings Cleared").setDescription(`✅ Cleared warnings for **${user.tag}**`).setColor("#FF69B4");
        break;
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    await interaction.editReply({ content: "❌ Something went wrong", embeds: [] });
  }
});

module.exports = { banUser, unbanUser, kickUser, timeoutUser, removeTimeout, warnUser, getWarnings, unwarnUser };

client.login(process.env.TOKEN);

