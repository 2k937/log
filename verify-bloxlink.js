const fetch = require("node-fetch");
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");
require("dotenv").config();

module.exports = {
    name: "verify",
    async execute(message, args, client) {

        if (message.author.bot) return;

        const userId = message.author.id;

        // Call Bloxlink API
        const response = await fetch(`https://api.blox.link/v2/user/${userId}`, {
            headers: { Authorization: process.env.BLOXLINK_API_KEY }
        });

        const data = await response.json();
 if (!data || data.status !== "ok") {
    return message.reply(
        "❌ You are **not verified** with Bloxlink.\n\n" +
        "To verify instantly, please use the Bloxlink website:\n" +
        "🔗 **https://blox.link/dashboard/user/verifications/verify**"
    );
}


        const robloxId = data.primaryAccount;
        const robloxUsername = data.robloxUsername || "Unknown";
        const displayName = data.robloxDisplayName || robloxUsername;

        const profileURL = `https://www.roblox.com/users/${robloxId}/profile`;

        // Roblox avatar images
        const headshot = `https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=420&height=420&format=png`;
        const fullBody = `https://thumbnails.roblox.com/v1/users/avatar?userIds=${robloxId}&size=720x720&format=Png&isCircular=false`;

        // Change nickname
        try { await message.member.setNickname(robloxUsername).catch(() => {}); } 
        catch (err) { console.log("Nickname error:", err); }

        // Embed
        const embed = new EmbedBuilder()
            .setColor("#00A2FF")
            .setTitle("✅ Bloxlink Verification")
            .setThumbnail(headshot)
            .setImage(fullBody)
            .addFields(
                { name: "Roblox Username", value: robloxUsername, inline: true },
                { name: "Display Name", value: displayName, inline: true },
                { name: "Roblox ID", value: robloxId.toString(), inline: true }
            )
           .setFooter({ text: `${message.guild.name} Verification` })
            .setTimestamp();

        // Buttons
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("View Profile")
                .setStyle(ButtonStyle.Link)
                .setURL(profileURL),

            new ButtonBuilder()
                .setCustomId(`unverify_${userId}`)
                .setLabel("Unverify")
                .setStyle(ButtonStyle.Danger)
        );

        const sentMessage = await message.reply({ embeds: [embed], components: [row] });

        // Button handler
        const collector = sentMessage.createMessageComponentCollector({ componentType: "BUTTON", time: 15 * 60 * 1000 });

        collector.on("collect", async (interaction) => {
            if (interaction.user.id !== userId) {
                return interaction.reply({ content: "❌ You cannot use someone else’s buttons.", ephemeral: true });
            }

            const [action] = interaction.customId.split("_");

            if (action === "unverify") {
                // Reset nickname
                interaction.member.setNickname(null).catch(() => {});
                await interaction.update({ content: "❌ You have been unverified. You can now verify a new Roblox account.", embeds: [], components: [] });
            }
        });
    }
};
