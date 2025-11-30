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

    // --- BLOCK LINKS EXCEPT GIFS ---
    const linkRegex = /(https?:\/\/[^\s]+)/gi;
    const gifRegex = /\.(gif)(\?.*)?$/i;

    if (linkRegex.test(content) && !gifRegex.test(content)) {
      await handleViolation(message, "Posting non-GIF links", "#ff0000");
      return;
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
  //  BUTTON HANDLING
  // ==========================
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    const action = interaction.customId;
    const userId = interaction.message.embeds[0]?.fields?.find(f => f.name === "User")?.value?.replace(/[<@>]/g, "");

    if (!userId) {
      return interaction.reply({ content: "Missing user ID.", ephemeral: true });
    }

    if (action === "ignore") {
      return interaction.reply({ content: "Ignored.", ephemeral: true });
    }

    // ---- OPEN MODAL FOR BAN/KICK/WARN/TIMEOUT ----
    const modal = new ModalBuilder()
      .setCustomId(`mod_${action}_${userId}`)
      .setTitle(`Confirm ${action.toUpperCase()}`);

    const reasonInput = new TextInputBuilder()
      .setCustomId("reason")
      .setLabel("Reason")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(reasonInput)
    );

    await interaction.showModal(modal);
  });

  // ==========================
  //  MODAL SUBMISSION
  // ==========================
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isModalSubmit()) return;

    const [_, type, userId] = interaction.customId.split("_");
    const reason = interaction.fields.getTextInputValue("reason");

    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) return interaction.reply({ content: "User not found.", ephemeral: true });

    if (type === "ban") {
      await member.ban({ reason });
      return interaction.reply({ content: `Banned ${member.user.tag}`, ephemeral: true });
    }

    if (type === "kick") {
      await member.kick(reason);
      return interaction.reply({ content: `Kicked ${member.user.tag}`, ephemeral: true });
    }

    if (type === "warn") {
      if (!warnings[userId]) warnings[userId] = [];
      warnings[userId].push({ reason, date: new Date().toISOString() });
      saveWarnings();

      await member.send(`⚠️ You were warned: **${reason}**`);
      return interaction.reply({ content: `Warned ${member.user.tag}`, ephemeral: true });
    }

    if (type === "timeout") {
      await member.timeout(10 * 60 * 1000, reason); // 10 min default
      return interaction.reply({ content: `Timed out ${member.user.tag}`, ephemeral: true });
    }
  });

  // ==========================
  //  MAIN HANDLE FUNCTION
  // ==========================
  async function handleViolation(message, reason, color) {
    try {
      await message.delete();

      const id = message.author.id;

      // Add warning
      if (!warnings[id]) warnings[id] = [];
      warnings[id].push({ reason, date: new Date().toISOString() });
      saveWarnings();

      // DM user
      await message.author.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("⚠️ Auto Warning")
            .setDescription(`You were warned for: **${reason}**`)
            .setColor(color)
        ]
      }).catch(() => {});

      // Log embed
      const log = message.guild.channels.cache.get(MOD_LOG);
      if (log) {
        const embed = new EmbedBuilder()
          .setTitle("🚨 AutoMod Violation")
          .setColor(color)
          .addFields(
            { name: "User", value: `<@${id}>`, inline: true },
            { name: "Reason", value: reason, inline: true }
          )
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("ignore").setLabel("Ignore").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("ban").setLabel("Ban").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("kick").setLabel("Kick").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("warn").setLabel("Warn").setStyle(ButtonStyle.Warning),
          new ButtonBuilder().setCustomId("timeout").setLabel("Timeout").setStyle(ButtonStyle.Success),
        );

        await log.send({ embeds: [embed], components: [row] });
      }

    } catch (err) {
      console.log("Automod error:", err);
    }
  }
};
