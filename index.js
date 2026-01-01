const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField
} = require("discord.js");
const fs = require("fs");
const cron = require("node-cron");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// ⚠️ TOKEN WIRD ÜBER RAILWAY VARIABLE GESETZT
const TOKEN = process.env.TOKEN;

// ───── IDs ─────
const TICKET_LOG = "1449804920122249256";
const SHIFT_LOG = "1449804935448367125";
const TOP10_CHANNEL = "1454423281645129864";
const TOP10_ROLE = "1449789415114412040";

// ───── Dateien ─────
const shiftFile = "./data/shifts.json";
const aktenFile = "./data/akten.json";
const ticketFile = "./data/tickets.json";

if (!fs.existsSync("./data")) fs.mkdirSync("./data");
for (const f of [shiftFile, aktenFile, ticketFile]) {
  if (!fs.existsSync(f)) fs.writeFileSync(f, "{}");
}

const read = (f) => JSON.parse(fs.readFileSync(f));
const write = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

// ───────────────── TICKET SYSTEM ─────────────────
client.on("messageCreate", async (msg) => {
  if (msg.content !== "!ticket") return;

  const channel = await msg.guild.channels.create({
    name: `ticket-${msg.author.username}`,
    type: 0,
    permissionOverwrites: [
      { id: msg.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: msg.author.id, allow: [PermissionsBitField.Flags.ViewChannel] }
    ]
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Ticket schließen")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `🎫 Ticket von <@${msg.author.id}>`,
    components: [row]
  });

  const log = msg.guild.channels.cache.get(TICKET_LOG);
  if (log) log.send(`📁 Neues Ticket von <@${msg.author.id}>`);

  msg.reply("✅ Ticket erstellt!");
});

client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;
  if (i.customId !== "ticket_close") return;

  await i.reply({ content: "🔒 Ticket wird geschlossen...", ephemeral: true });

  const log = i.guild.channels.cache.get(TICKET_LOG);
  if (log) log.send(`❌ Ticket **${i.channel.name}** geschlossen`);

  setTimeout(() => i.channel.delete(), 3000);
});

// ───────────────── PERSONALAKTEN ─────────────────
client.on("messageCreate", (msg) => {
  if (!msg.content.startsWith("!akte")) return;

  const args = msg.content.split(" ");
  const user = msg.mentions.users.first();
  if (!user) return msg.reply("❌ Bitte User erwähnen.");

  const akten = read(aktenFile);
  const id = user.id;

  if (args[1] === "create") {
    akten[id] = { text: args.slice(3).join(" ") || "Leer" };
    write(aktenFile, akten);
    msg.reply("✅ Akte erstellt");
  }

  if (args[1] === "show") {
    if (!akten[id]) return msg.reply("❌ Keine Akte vorhanden");
    msg.reply(`📄 **Akte von <@${id}>**\n${akten[id].text}`);
  }

  if (args[1] === "edit") {
    if (!akten[id]) return msg.reply("❌ Keine Akte vorhanden");
    akten[id].text = args.slice(3).join(" ");
    write(aktenFile, akten);
    msg.reply("✏️ Akte bearbeitet");
  }

  if (args[1] === "delete") {
    delete akten[id];
    write(aktenFile, akten);
    msg.reply("🗑️ Akte gelöscht");
  }
});

// ───────────────── SHIFT SYSTEM ─────────────────
client.on("messageCreate", (msg) => {
  const shifts = read(shiftFile);
  const id = msg.author.id;

  if (msg.content === "!dienst start") {
    shifts[id] = shifts[id] || { total: 0 };
    shifts[id].start = Date.now();
    write(shiftFile, shifts);
    msg.reply("🟢 Dienst gestartet");
  }

  if (msg.content === "!dienst pause") {
    if (!shifts[id]?.start) return;
    shifts[id].total += Date.now() - shifts[id].start;
    shifts[id].start = null;
    write(shiftFile, shifts);
    msg.reply("⏸️ Dienst pausiert");
  }

  if (msg.content === "!dienst end") {
    if (shifts[id]?.start)
      shifts[id].total += Date.now() - shifts[id].start;

    shifts[id].start = null;
    write(shiftFile, shifts);

    const log = msg.guild.channels.cache.get(SHIFT_LOG);
    if (log) log.send(`🕒 <@${id}> hat den Dienst beendet`);

    msg.reply("🔴 Dienst beendet");
  }
});

// ───────────────── TOP 10 WÖCHENTLICH ─────────────────
cron.schedule("0 18 * * 0", async () => {
  const shifts = read(shiftFile);

  const top = Object.entries(shifts)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10);

  if (top.length === 0) return;

  const text = top
    .map(
      (u, i) =>
        `**${i + 1}.** <@${u[0]}> – ${(u[1].total / 3600000).toFixed(2)}h`
    )
    .join("\n");

  const ch = await client.channels.fetch(TOP10_CHANNEL);
  ch.send(`<@&${TOP10_ROLE}>\n🏆 **Top 10 Dienstzeiten (Woche)**\n${text}`);
});

client.once("ready", () => {
  console.log(`✅ Eingeloggt als ${client.user.tag}`);
});

client.login(TOKEN);
