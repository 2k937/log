const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const fetch = require("node-fetch");
require("dotenv").config();

module.exports = {
    name: "setup",
    async execute(message, args, client) {
        if (!message.member.permissions.has("Administrator")) {
            return message.reply("❌ You need Administrator permission to use this command.");
        }

        const guild = message.guild;

        // Create roles if they don't exist
        let verifiedRole = guild.roles.cache.find(r => r.name === "Verified");
        let unverifiedRole = guild.roles.cache.find(r => r.name === "Unverified");

        if (!verifiedRole) {
            verifiedRole = await guild.roles.create({
                name: "Verified",
                color: "Green",
                reason: "Created for Roblox verification system"
            });
        }

        if (!unverifiedRole) {
            unverifiedRole = await guild.roles.create({
                name: "Unverified",
                color: "Red",
                reason: "Created for Roblox verification system"
            });
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

        const panelMessage = await message.channel.send({ embeds: [embed], components: [row] });

        const collector = panelMessage.createMessageComponentCollector({
            componentType: "BUTTON",
            time: 0 // runs indefinitely
        });

        collector.on("collect", async interaction => {
            const userId = interaction.user.id;
            const member = interaction.member;

            // Fetch Bloxlink data
            let data;
            try {
                const response = await fetch(`https://api.blox.link/v2/user/${userId}`, {
                    headers: { Authorization: process.env.BLOXLINK_API_KEY }
                });
                data = await response.json();
            } catch (err) {
                return interaction.reply({ content: "❌ Could not reach Bloxlink API.", ephemeral: true });
            }

            // VERIFY BUTTON
            if (interaction.customId === "verify_bloxlink") {
                if (!data || data.status !== "ok" || !data.primaryAccount) {
                    return interaction.reply({
                        content: "❌ You are not verified with Bloxlink.\n" +
                                 "Verify here: https://blox.link/dashboard/user/verifications/verify",
                        ephemeral: true
                    });
                }

                const robloxUsername = data.robloxUsername || "Unknown";
                const displayName = data.robloxDisplayName;
                const nickname = displayName && displayName !== robloxUsername
                    ? `${displayName} (@${robloxUsername})`
                    : robloxUsername;

                // Set nickname
                await member.setNickname(nickname).catch(() => {});

                // Assign roles
                await member.roles.add(verifiedRole).catch(() => {});
                await member.roles.remove(unverifiedRole).catch(() => {});

                return interaction.reply({
                    content: `✅ You are verified as **${nickname}** and assigned the Verified role.`,
                    ephemeral: true
                });
            }

            // UNVERIFY BUTTON
            if (interaction.customId === "unverify_bloxlink") {
                await member.setNickname(null).catch(() => {});

                // Assign roles
                await member.roles.add(unverifiedRole).catch(() => {});
                await member.roles.remove(verifiedRole).catch(() => {});

                return interaction.reply({
                    content: "❌ You have been unverified. Assigned the Unverified role.",
                    ephemeral: true
                });
            }

            // UPDATE ME BUTTON
            if (interaction.customId === "update_bloxlink") {
                if (!data || data.status !== "ok" || !data.primaryAccount) {
                    return interaction.reply({
                        content: "❌ You are not verified with Bloxlink. Use Verify first.",
                        ephemeral: true
                    });
                }

                const robloxUsername = data.robloxUsername || "Unknown";
                const displayName = data.robloxDisplayName;
                const nickname = displayName && displayName !== robloxUsername
                    ? `${displayName} (@${robloxUsername})`
                    : robloxUsername;

                // Set nickname
                await member.setNickname(nickname).catch(() => {});

                return interaction.reply({
                    content: `🔄 Your nickname and roles have been updated to **${nickname}**`,
                    ephemeral: true
                });
            }
        });
    }
};

