// ==========================
//        AUTO MOD
// ==========================
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const fs = require("fs");

// Warnings Database
let warnings = {};
if (fs.existsSync("warnings.json")) {
  warnings = JSON.parse(fs.readFileSync("warnings.json"));
}
function saveWarnings() {
  fs.writeFileSync("warnings.json", JSON.stringify(warnings, null, 2));
}

// SET YOUR LOG CHANNEL HERE
const MOD_LOG = "YOUR_MOD_LOG_CHANNEL_ID";

module.exports = (client) => {
  console.log("⚙️ AutoMod Enabled");

  // ==========================
  //  MESSAGE AUTOMOD
  // ==========================
  client.on("messageCreate", async (message) => {
    if (!message.guild) return;
    if (message.author.bot) return;

    const content = message.content;

    // ✅ Bug 4 Fix: Fresh regex instances per message to avoid lastIndex drift
    const linkRegex = /(https?:\/\/[^\s]+)/gi;
    const gifExtRegex = /\.(gif)(\?.*)?$/i;

    // ✅ Bug 5 Fix: Whitelist known GIF domains (tenor, giphy) in addition to .gif extension
    const gifDomainRegex = /https?:\/\/(www\.)?(tenor\.com|giphy\.com|media\.giphy\.com)\//i;

    if (linkRegex.test(content)) {
      // Re-extract the matched URLs to check each one
      const urls = content.match(/(https?:\/\/[^\s]+)/gi) || [];
      const allAreGifs = urls.every(url => gifExtRegex.test(url) || gifDomainRegex.test(url));

      if (!allAreGifs) {
        await handleViolation(message, "Posting non-GIF links", "#ff0000");
        return;
      }
    }

    // --- EMOJI SPAM ---
    const emojiRegex = /<a?:\w+:\d+>|[\u{1F300}-\u{1FAFF}]/gu;
    const emojis = content.match(emojiRegex);

    if (emojis && emojis.length >= 8) {
      await handleViolation(message, `Emoji spam (${emojis.length} emojis)`, "#ff9900");
      return;
    }
  });

  // ==========================
  //  INTERACTIONS (merged)
  // ✅ Bug 3 Fix: Single interactionCreate handler instead of two
  // ==========================
  client.on("interactionCreate", async (interaction) => {

    // --- BUTTON HANDLING ---
    if (interaction.isButton()) {
      const action = interaction.customId;

      // Extract user ID from embed field
      const userId = interaction.message.embeds[0]?.fields
        ?.find(f => f.name === "User")
        ?.value
        ?.replace(/[<@>]/g, "");

      if (!userId) {
        return interaction.reply({ content: "Missing user ID.", ephemeral: true });
      }

      if (action === "ignore") {
        return interaction.reply({ content: "Ignored.", ephemeral: true });
      }

      // Open modal for ban/kick/warn/timeout
      const modal = new ModalBuilder()
        .setCustomId(`mod_${action}_${userId}`)
        .setTitle(`Confirm ${action.charAt(0).toUpperCase() + action.slice(1)}`);

      const reasonInput = new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("Reason")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      await interaction.showModal(modal);
    }

    // --- MODAL SUBMISSION ---
    if (interaction.isModalSubmit() && interaction.customId.startsWith("mod_")) {
      // ✅ Bug 1 Fix: Slice after first two underscores so userIds with _ are safe
      const withoutPrefix = interaction.customId.slice("mod_".length); // "ban_123456"
      const underscoreIndex = withoutPrefix.indexOf("_");
      const type = withoutPrefix.slice(0, underscoreIndex);           // "ban"
      const userId = withoutPrefix.slice(underscoreIndex + 1);        // "123456"

      const reason = interaction.fields.getTextInputValue("reason");
      const member = await interaction.guild.members.fetch(userId).catch(() => null);

      if (!member) {
        return interaction.reply({ content: "User not found.", ephemeral: true });
      }

      if (type === "ban") {
        await member.ban({ reason });
        return interaction.reply({ content: `✅ Banned **${member.user.tag}**`, ephemeral: true });
      }

      if (type === "kick") {
        await member.kick(reason);
        return interaction.reply({ content: `✅ Kicked **${member.user.tag}**`, ephemeral: true });
      }

      if (type === "warn") {
        if (!warnings[userId]) warnings[userId] = [];
        warnings[userId].push({ reason, date: new Date().toISOString() });
        saveWarnings();

        await member.send(`⚠️ You were warned in **${interaction.guild.name}**: **${reason}**`).catch(() => {});
        return interaction.reply({ content: `✅ Warned **${member.user.tag}**`, ephemeral: true });
      }

      if (type === "timeout") {
        await member.timeout(10 * 60 * 1000, reason);
        return interaction.reply({ content: `✅ Timed out **${member.user.tag}** for 10 minutes`, ephemeral: true });
      }
    }
  });

  // ==========================
  //  MAIN HANDLE FUNCTION
  // ==========================
  async function handleViolation(message, reason, color) {
    try {
      await message.delete();

      const id = message.author.id;

      if (!warnings[id]) warnings[id] = [];
      warnings[id].push({ reason, date: new Date().toISOString() });
      saveWarnings();

      // DM user
      await message.author.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("⚠️ Auto Warning")
            .setDescription(`You were warned in **${message.guild.name}** for: **${reason}**`)
            .setColor(color)
        ]
      }).catch(() => {});

      // Log embed
      const log = message.guild.channels.cache.get(MOD_LOG);
      if (!log) return;

      const embed = new EmbedBuilder()
        .setTitle("🚨 AutoMod Violation")
        .setColor(color)
        .addFields(
          { name: "User", value: `<@${id}>`, inline: true },
          { name: "Reason", value: reason, inline: true },
          { name: "Channel", value: `<#${message.channel.id}>`, inline: true }
        )
        .setTimestamp();

      // ✅ Bug 2 Fix: ButtonStyle.Warning doesn't exist — changed to ButtonStyle.Secondary
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ignore").setLabel("Ignore").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ban").setLabel("Ban").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("kick").setLabel("Kick").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("warn").setLabel("Warn").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("timeout").setLabel("Timeout").setStyle(ButtonStyle.Success),
      );

      await log.send({ embeds: [embed], components: [row] });

    } catch (err) {
      console.error("Automod error:", err);
    }
  }
};
