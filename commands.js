const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Shows the bot latency and Discord API latency'),

    // Prefix command info
    name: 'ping',
    description: 'Shows the bot latency and Discord API latency',

    async execute(context) {
        const isSlash = context.isCommand || context.commandType === 'slash';

        const botLatency = Date.now() - context.createdTimestamp;
        const apiLatency = Math.round(context.client.ws.ping);

        const replyText = `🏓 Pong!\nBot latency: ${botLatency}ms\nDiscord API latency: ${apiLatency}ms`;

        if (isSlash) {
            await context.reply(replyText);
        } else {
            await context.channel.send(replyText);
        }
    },
};

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits
} = require('discord.js');

module.exports = {

  // Slash command
  data: new SlashCommandBuilder()
    .setName('setup-rules')
    .setDescription('Post the server rules dropdown (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // Prefix command
  name: 'setup',
  description: 'Setup server rules (admin only)',

  async execute(context) {
    const isSlash = context.isCommand || context.commandType === 'slash';

    // Admin check for PREFIX commands
    if (!isSlash && !context.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return context.reply?.('❌ You must be an administrator.');
    }

    // Channel logic
    const channel = isSlash
      ? context.channel
      : context.channel;

    // Dropdown
    const dropdown = new StringSelectMenuBuilder()
      .setCustomId('rules_dropdown')
      .setPlaceholder('📜 View Server Rules')
      .addOptions([
        {
          label: 'View Rules',
          value: 'view_rules'
        }
      ]);

    const row = new ActionRowBuilder().addComponents(dropdown);

    await channel.send({
      content: '📜 **Check our rules to avoid moderation actions.**',
      components: [row]
    });

    // Confirmation
    if (isSlash) {
      await context.reply({
        content: '✅ Rules dropdown posted.',
        ephemeral: true
      });
    } else {
      await context.channel.send('✅ Rules dropdown posted.');
    }
  },

  // 🔽 Dropdown interaction (same file)
  async interactionCreate(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== 'rules_dropdown') return;

    const rulesEmbed = new EmbedBuilder()
      .setTitle(`📜 ${interaction.guild.name} — Server Rules`)
      .setDescription(
        '1️⃣ Be respectful\n' +
        '2️⃣ No spam or advertising\n' +
        '3️⃣ No NSFW content\n' +
        '4️⃣ Follow Discord Terms of Service\n' +
        '5️⃣ Staff decisions are final'
      )
      .setColor(0x5865F2)
      .setFooter({
        text: 'Check our rules to avoid moderation'
      });

    await interaction.reply({
      embeds: [rulesEmbed],
      ephemeral: true // ONLY the clicker sees it
    });
  }
};
