const { 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder, 
  ChannelType, 
  PermissionsBitField 
} = require("discord.js");

// 🔹 Replace with your role IDs
const GENERAL_ROLE_ID = ""; 
const MANAGEMENT_ROLE_ID = "";
const INTERNAL_ROLE_ID = "";

module.exports = (client) => {
  client.once("ready", () => {
    console.log("✅ Ticket system loaded!");

    const channelId = ""; // Ticket panel channel
    const channel = client.channels.cache.get(channelId);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle("🎫 Support Ticket System")
        .setDescription("Need help? Open a ticket using the dropdown below.\n\n📌 Choose the type of support you need.")
        .setColor("#2b2d31");

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .setPlaceholder("Select a ticket type")
        .addOptions([
          { label: "General Support", value: "general", emoji: "💬" },
          { label: "Management Support", value: "management", emoji: "🛠️" },
          { label: "Internal Affairs", value: "internal", emoji: "⚖️" }
        ]);

      const row = new ActionRowBuilder().addComponents(menu);

      channel.send({ embeds: [embed], components: [row] });
    }
  });

  client.on("interactionCreate", async (interaction) => {
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
      const ticketType = interaction.values[0];
      const ticketName = `ticket-${ticketType}-${interaction.user.username}`;

      // 🔹 Role mapping
      let supportRole;
      if (ticketType === "general") supportRole = GENERAL_ROLE_ID;
      if (ticketType === "management") supportRole = MANAGEMENT_ROLE_ID;
      if (ticketType === "internal") supportRole = INTERNAL_ROLE_ID;

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
        .setTitle("👋 Welcome to Your Ticket")
        .setDescription(
          `Hello ${interaction.user},\n\n🎟️ Thank you for opening a **${ticketType}** ticket.\n\nOur **<@&${supportRole}>** team will be with you shortly. Please provide all details about your issue.`
        )
        .setColor("#00aaff");

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

      const row = new ActionRowBuilder().addComponents(closeButton, openButton, claimButton);

      await channel.send({ content: `${interaction.user} | <@&${supportRole}>`, embeds: [embed], components: [row] });
      await interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
    }

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
        const roleIds = [GENERAL_ROLE_ID, MANAGEMENT_ROLE_ID, INTERNAL_ROLE_ID];
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

        await interaction.reply({ content: `✅ Ticket claimed by ${interaction.user}`, ephemeral: false });

        const embedUpdate = new EmbedBuilder()
          .setTitle("🎟️ Ticket Claimed")
          .setDescription(`This ticket has been claimed by ${interaction.user}. Only the claimer and the opener can reply now.`)
          .setColor("#ffaa00");

        await interaction.channel.send({ embeds: [embedUpdate] });
      }
    }
  });
};



