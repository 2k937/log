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

// 🔹 Replace with your role IDs
const GENERAL_ROLE_ID = ""; 
const HIGH_RANK_ROLE_ID = "";
const PARTNERSHIP_ROLE_ID = "";

// File to store ticket counters
const fs = require("fs");
const TICKET_COUNTER_FILE = "./ticketCounters.json";
let ticketCounters = {};
if (fs.existsSync(TICKET_COUNTER_FILE)) ticketCounters = JSON.parse(fs.readFileSync(TICKET_COUNTER_FILE, "utf8"));

function saveCounters() {
  fs.writeFileSync(TICKET_COUNTER_FILE, JSON.stringify(ticketCounters, null, 2));
}

module.exports = (client) => {
  client.once("ready", () => {
    console.log("✅ Ticket system loaded!");

    const panelChannelId = ""; // Ticket panel channel
    const panelChannel = client.channels.cache.get(panelChannelId);
    if (panelChannel) {
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

      panelChannel.send({ embeds: [embed], components: [row] });
    }
  });

  client.on("interactionCreate", async (interaction) => {

    // --- Dropdown to open ticket ---
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
      const ticketType = interaction.values[0];

      // Open modal for user input
      const modal = new ModalBuilder()
        .setCustomId(`ticket_modal_${ticketType}`)
        .setTitle(`🎟️ ${ticketType.replace("_"," ").toUpperCase()} Ticket Form`);

      const questionInput = new TextInputBuilder()
        .setCustomId("question")
        .setLabel("Please describe your issue")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Write the details of your request...")
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(questionInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }

    // --- Modal submit for ticket ---
    if (interaction.isModalSubmit()) {
      const ticketType = interaction.customId.split("_")[2]; // get ticket type

      // Assign staff role
      let supportRole;
      if (ticketType === "general") supportRole = GENERAL_ROLE_ID;
      if (ticketType === "high") supportRole = HIGH_RANK_ROLE_ID;
      if (ticketType === "partnership") supportRole = PARTNERSHIP_ROLE_ID;

      // Increment ticket number
      if (!ticketCounters[ticketType]) ticketCounters[ticketType] = 1;
      else ticketCounters[ticketType]++;
      saveCounters();

      const ticketNumber = ticketCounters[ticketType].toString().padStart(3, "0");
      const ticketName = `${ticketType}-${ticketNumber}`;

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

      const embed = new EmbedBuilder()
        .setTitle("👋 Ticket Opened")
        .setDescription(
          `Hello ${interaction.user},\n\n**Ticket Type:** ${ticketType.replace("_"," ").toUpperCase()}\n` +
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

    // --- Button interactions ---
    if (interaction.isButton()) {
      if (interaction.customId === "close_ticket") {
        await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
          SendMessages: false,
          ViewChannel: true
        });
        await interaction.reply({ content: "🔒 Ticket closed!", ephemeral: true });
      }

      if (interaction.customId === "open_ticket") {
        await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
          SendMessages: true,
          ViewChannel: true
        });
        await interaction.reply({ content: "✅ Ticket reopened!", ephemeral: true });
      }

      if (interaction.customId === "claim_ticket") {
        const roleIds = [GENERAL_ROLE_ID, HIGH_RANK_ROLE_ID, PARTNERSHIP_ROLE_ID];
        for (const roleId of roleIds) {
          if (interaction.channel.permissionOverwrites.cache.has(roleId)) {
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
          .setDescription(`This ticket has been claimed by ${interaction.user}. Only the staff team and the user can reply now.`)
          .setColor("#ffaa00");

        await interaction.reply({ content: `✅ Ticket claimed by ${interaction.user}`, ephemeral: false });
        await interaction.channel.send({ embeds: [embedUpdate] });
      }
    }
  });
};



