const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionsBitField } = require("discord.js");
const fetch = require("node-fetch");
require("dotenv").config();

module.exports = async (client) => {

    // Register slash command on bot startup
    const commandData = new SlashCommandBuilder()
        .setName("setup")
        .setDescription("Setup the Roblox verification panel in a specific channel")
        .addChannelOption(option =>
            option.setName("channel")
                .setDescription("The channel to send the verification panel")
                .setRequired(true)
        );

  const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.commands.create(commandData.toJSON());
    console.log("✅ /setup command registered.");

    // Listen for interaction
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName !== "setup") return;

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: "❌ You need Administrator permission to use this command.", ephemeral: true });
        }

        const channel = interaction.options.getChannel("channel");
        const guild = interaction.guild;

        // Create roles
        let verifiedRole = guild.roles.cache.find(r => r.name === "Verified");
        if (!verifiedRole) {
            try {
                verifiedRole = await guild.roles.create({
                    name: "Verified",
                    color: "Green",
                    reason: "Created for Roblox verification system"
                });
            } catch {
                return interaction.reply({ content: "❌ Failed to create Verified role. Check my permissions.", ephemeral: true });
            }
        }

        let unverifiedRole = guild.roles.cache.find(r => r.name === "Unverified");
        if (!unverifiedRole) {
            try {
                unverifiedRole = await guild.roles.create({
                    name: "Unverified",
                    color: "Red",
                    reason: "Created for Roblox verification system"
                });
            } catch {
                return interaction.reply({ content: "❌ Failed to create Unverified role. Check my permissions.", ephemeral: true });
            }
        }

        // Embed + buttons
        const embed = new EmbedBuilder()
            .setTitle("🔹 Roblox Verification Panel")
            .setDescription(
                "Click **Verify** to verify your Roblox account with Bloxlink.\n" +
                "Click **Unverify** to remove your verification.\n" +
                "Click **Update Me** to refresh your Roblox display name, nickname, and roles."
            )
            .setColor("#00A2FF")
            .setFooter({ text: `${guild.name} Verification Panel` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("verify_bloxlink").setLabel("Verify").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("unverify_bloxlink").setLabel("Unverify").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("update_bloxlink").setLabel("Update Me").setStyle(ButtonStyle.Primary)
        );

        const panelMessage = await channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ Verification panel sent to ${channel}`, ephemeral: true });

        // Button collector
        const collector = panelMessage.createMessageComponentCollector({ componentType: "BUTTON", time: 0 });
        collector.on("collect", async buttonInteraction => {
            const member = buttonInteraction.member;
            let data;

            try {
                const res = await fetch(`https://api.blox.link/v2/user/${buttonInteraction.user.id}`, {
                    headers: { Authorization: process.env.BLOXLINK_API_KEY }
                });
                data = await res.json();
            } catch {
                return buttonInteraction.reply({ content: "❌ Could not reach Bloxlink API.", ephemeral: true });
            }

            const robloxUsername = data?.robloxUsername || "Unknown";
            const displayName = data?.robloxDisplayName;
            const nickname = displayName && displayName !== robloxUsername
                ? `${displayName} (@${robloxUsername})`
                : robloxUsername;

            if (buttonInteraction.customId === "verify_bloxlink") {
                if (!data?.primaryAccount) return buttonInteraction.reply({ content: "❌ You are not verified with Bloxlink.", ephemeral: true });
                await member.setNickname(nickname).catch(() => {});
                await member.roles.add(verifiedRole).catch(() => {});
                await member.roles.remove(unverifiedRole).catch(() => {});
                return buttonInteraction.reply({ content: `✅ Verified as **${nickname}**`, ephemeral: true });
            }

            if (buttonInteraction.customId === "unverify_bloxlink") {
                await member.setNickname(null).catch(() => {});
                await member.roles.add(unverifiedRole).catch(() => {});
                await member.roles.remove(verifiedRole).catch(() => {});
                return buttonInteraction.reply({ content: "❌ You have been unverified.", ephemeral: true });
            }

            if (buttonInteraction.customId === "update_bloxlink") {
                if (!data?.primaryAccount) return buttonInteraction.reply({ content: "❌ You are not verified with Bloxlink.", ephemeral: true });
                await member.setNickname(nickname).catch(() => {});
                return buttonInteraction.reply({ content: `🔄 Nickname and roles updated to **${nickname}**`, ephemeral: true });
            }
        });
    });

    console.log("✅ Roblox verification system loaded.");
};


