const { 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder, 
  ChannelType, 
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle 
} = require("discord.js");

const GENERAL_ROLE_ID = ""; 
const HIGH_RANK_ROLE_ID = "";
const PARTNERSHIP_ROLE_ID = "";

const fs = require("fs");
const TICKET_COUNTER_FILE = "./ticketCounters.json";
const PANEL_ID_FILE = "./panelMessageId.json";

let ticketCounters = {};
if (fs.existsSync(TICKET_COUNTER_FILE)) ticketCounters = JSON.parse(fs.readFileSync(TICKET_COUNTER_FILE, "utf8"));

function saveCounters() {
  fs.writeFileSync(TICKET_COUNTER_FILE, JSON.stringify(ticketCounters, null, 2));
}

// Track ticket owners: channelId -> userId
const ticketOwners = {};

module.exports = (client) => {
  client.once("ready", async () => {
    console.log("✅ Ticket system loaded!");

    const panelChannelId = "";
    const panelChannel = client.channels.cache.get(panelChannelId);
    if (!panelChannel) return;

    // ✅ Bug 4 Fix: Don't re-send panel on restart
    let existingPanelId = null;
    if (fs.existsSync(PANEL_ID_FILE)) {
      existingPanelId = JSON.parse(fs.readFileSync(PANEL_ID_FILE, "utf8")).messageId;
    }

    if (existingPanelId) {
      try {
        await panelChannel.messages.fetch(existingPanelId);
        console.log("Panel already exists, skipping send.");
        return;
      } catch {
        // Message no longer exists, send a new one
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("🎫 Support System Hub")
      .setDescription(
        `Welcome to the **${panelChannel.guild.name}** assistance area! We hope our amazing staff team can help you with what you need to handle.\n` +
        `Information about our support system is below. Any other questions of course, can be answered in a ticket!\n\n` +
        `• **General Support**\nGeneral inquiries\nConcerns\n\n` +
        `• **High Ranking Support**\nReport a Staff member\nReport a Member\nClaiming Prizes or Perks\nDepartment inquiries\n\n` +
        `• **Partnership Support**\nAffiliate Questions or Concerns\nPaid Advertisement\nBasic Partnerships\n\n` +
        `Thank you for letting us help you today! Please make sure before you partner you check our affiliation requirements!`
      )
      .setColor("#2b2d31");

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_select")
      .setPlaceholder("Select a ticket type")
      .addOptions([
        { label: "General Support", value: "general", emoji: "💬" },
        { label: "High Ranking Support", value: "high_rank", emoji: "🛠️" },
        { label: "Partnership Support", value: "partnership", emoji: "⚖️" }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);
    const sentPanel = await panelChannel.send({ embeds: [embed], components: [row] });

    fs.writeFileSync(PANEL_ID_FILE, JSON.stringify({ messageId: sentPanel.id }, null, 2));
  });

  client.on("interactionCreate", async (interaction) => {

    // --- Dropdown ---
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
      const ticketType = interaction.values[0];

      const modal = new ModalBuilder()
        .setCustomId(`ticket_modal_${ticketType}`)
        .setTitle(`🎟️ ${ticketType.replace(/_/g, " ").toUpperCase()} Ticket Form`);

      const questionInput = new TextInputBuilder()
        .setCustomId("question")
        .setLabel("Please describe your issue")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Write the details of your request...")
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(questionInput));
      await interaction.showModal(modal);
    }

    // --- Modal Submit ---
    if (interaction.isModalSubmit() && interaction.customId.startsWith("ticket_modal_")) {
      // ✅ Bug 1 Fix: correctly extract ticket type including underscores
      const ticketType = interaction.customId.replace("ticket_modal_", "");

      // ✅ Bug 2 Fix: "high_rank" not "high"
      let supportRole;
      if (ticketType === "general") supportRole = GENERAL_ROLE_ID;
      if (ticketType === "high_rank") supportRole = HIGH_RANK_ROLE_ID;
      if (ticketType === "partnership") supportRole = PARTNERSHIP_ROLE_ID;

      if (!supportRole) {
        return interaction.reply({ content: "❌ Unknown ticket type.", ephemeral: true });
      }

      if (!ticketCounters[ticketType]) ticketCounters[ticketType] = 1;
      else ticketCounters[ticketType]++;
      saveCounters();

      const ticketNumber = ticketCounters[ticketType].toString().padStart(3, "0");
      const ticketName = `${ticketType.replace("_", "-")}-${ticketNumber}`;
      const answer = interaction.fields.getTextInputValue("question");

      const channel = await interaction.guild.channels.create({
        name: ticketName,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: supportRole, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageMessages] }
        ]
      });

      // ✅ Bug 3 Fix: store ticket owner so buttons reference the right person
      ticketOwners[channel.id] = interaction.user.id;

      const embed = new EmbedBuilder()
        .setTitle("👋 Ticket Opened")
        .setDescription(
          `Hello ${interaction.user},\n\n**Ticket Type:** ${ticketType.replace(/_/g, " ").toUpperCase()}\n` +
          `**Server:** ${interaction.guild.name}\n\n` +
          `**Issue Details:**\n${answer}`
        )
        .setColor("#00aaff")
        .setFooter({ text: "Support Team" })
        .setTimestamp();

      const closeButton = new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger);

      const openButton = new ButtonBuilder()
        .setCustomId("open_ticket")
        .setLabel("Re-Open Ticket")
        .setStyle(ButtonStyle.Success);

      const claimButton = new ButtonBuilder()
        .setCustomId("claim_ticket")
        .setLabel("Claim Ticket")
        .setStyle(ButtonStyle.Primary);

      const buttonRow = new ActionRowBuilder().addComponents(closeButton, openButton, claimButton);

      await channel.send({ content: `<@${interaction.user.id}> | <@&${supportRole}>`, embeds: [embed], components: [buttonRow] });
      await interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
    }

    // --- Buttons ---
    if (interaction.isButton()) {
      // ✅ Bug 3 Fix: use stored owner ID for open/close, not the button clicker
      const ownerId = ticketOwners[interaction.channel.id];

      if (interaction.customId === "close_ticket") {
        if (ownerId) {
          await interaction.channel.permissionOverwrites.edit(ownerId, {
            SendMessages: false,
            ViewChannel: true
          });
        }
        await interaction.reply({ content: "🔒 Ticket closed!" });
      }

      if (interaction.customId === "open_ticket") {
        if (ownerId) {
          await interaction.channel.permissionOverwrites.edit(ownerId, {
            SendMessages: true,
            ViewChannel: true
          });
        }
        await interaction.reply({ content: "✅ Ticket reopened!" });
      }

      if (interaction.customId === "claim_ticket") {
        const roleIds = [GENERAL_ROLE_ID, HIGH_RANK_ROLE_ID, PARTNERSHIP_ROLE_ID];
        for (const roleId of roleIds) {
          if (roleId && interaction.channel.permissionOverwrites.cache.has(roleId)) {
            await interaction.channel.permissionOverwrites.edit(roleId, {
              SendMessages: false,
              ViewChannel: true
            });
          }
        }

        await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
          SendMessages: true,
          ViewChannel: true,
          ManageMessages: true
        });

        const embedUpdate = new EmbedBuilder()
          .setTitle("🎟️ Ticket Claimed")
          .setDescription(`This ticket has been claimed by ${interaction.user}. Only they and the ticket owner can reply now.`)
          .setColor("#ffaa00");

        await interaction.reply({ content: `✅ Ticket claimed by ${interaction.user}` });
        await interaction.channel.send({ embeds: [embedUpdate] });
      }
    }
  });
};
