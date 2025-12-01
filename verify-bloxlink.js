const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionsBitField } = require("discord.js");
const fetch = require("node-fetch");
require("dotenv").config();

module.exports = async (client) => {
    data: new SlashCommandBuilder()
        .setName("setup")
        .setDescription("Setup the Roblox verification panel in a specific channel")
        .addChannelOption(option =>
            option.setName("channel")
                .setDescription("The channel to send the verification panel")
                .setRequired(true)
        ),

    async execute(interaction, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: "❌ You need Administrator permission to use this command.", ephemeral: true });
        }

        const channel = interaction.options.getChannel("channel");
        const guild = interaction.guild;

        // Create Verified role if missing
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

        // Create Unverified role if missing
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

        // Embed for verification panel
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

        // Buttons row
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("verify_bloxlink")
                .setLabel("Verify")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId("unverify_bloxlink")
                .setLabel("Unverify")
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId("update_bloxlink")
                .setLabel("Update Me")
                .setStyle(ButtonStyle.Primary)
        );

        // Send the panel to the specified channel
        const panelMessage = await channel.send({ embeds: [embed], components: [row] });

        await interaction.reply({ content: `✅ Verification panel sent to ${channel}`, ephemeral: true });

        // Collector for button interactions
        const collector = panelMessage.createMessageComponentCollector({
            componentType: "BUTTON",
            time: 0 // runs indefinitely
        });

        collector.on("collect", async buttonInteraction => {
            const member = buttonInteraction.member;

            // Fetch Bloxlink data
            let data;
            try {
                const response = await fetch(`https://api.blox.link/v2/user/${buttonInteraction.user.id}`, {
                    headers: { Authorization: process.env.BLOXLINK_API_KEY }
                });
                data = await response.json();
            } catch {
                return buttonInteraction.reply({ content: "❌ Could not reach Bloxlink API.", ephemeral: true });
            }

            const robloxUsername = data?.robloxUsername || "Unknown";
            const displayName = data?.robloxDisplayName;
            const nickname = displayName && displayName !== robloxUsername
                ? `${displayName} (@${robloxUsername})`
                : robloxUsername;

            // VERIFY BUTTON
            if (buttonInteraction.customId === "verify_bloxlink") {
                if (!data || data.status !== "ok" || !data.primaryAccount) {
                    return buttonInteraction.reply({
                        content: "❌ You are not verified with Bloxlink.\n" +
                                 "Verify here: https://blox.link/dashboard/user/verifications/verify",
                        ephemeral: true
                    });
                }

                await member.setNickname(nickname).catch(() => {});
                await member.roles.add(verifiedRole).catch(() => {});
                await member.roles.remove(unverifiedRole).catch(() => {});

                return buttonInteraction.reply({ content: `✅ You are verified as **${nickname}** and assigned the Verified role.`, ephemeral: true });
            }

            // UNVERIFY BUTTON
            if (buttonInteraction.customId === "unverify_bloxlink") {
                await member.setNickname(null).catch(() => {});
                await member.roles.add(unverifiedRole).catch(() => {});
                await member.roles.remove(verifiedRole).catch(() => {});

                return buttonInteraction.reply({ content: "❌ You have been unverified. Assigned the Unverified role.", ephemeral: true });
            }

            // UPDATE ME BUTTON
            if (buttonInteraction.customId === "update_bloxlink") {
                if (!data || data.status !== "ok" || !data.primaryAccount) {
                    return buttonInteraction.reply({ content: "❌ You are not verified with Bloxlink. Use Verify first.", ephemeral: true });
                }

                await member.setNickname(nickname).catch(() => {});
                return buttonInteraction.reply({ content: `🔄 Your nickname and roles have been updated to **${nickname}**`, ephemeral: true });
            }
        });
    }
};


