// Sends "Schedule a call" requests from the website to the Clearwork inbox via Resend.
// Environment variables (set in Vercel → Project → Settings → Environment Variables):
//   RESEND_API_KEY  (required) your Resend API key
//   CONTACT_TO      (optional) where requests go; defaults to clearworkstudiollc@gmail.com
//   CONTACT_FROM    (optional) sender; defaults to Resend's test sender until your domain is verified

const esc = (s) =>
  String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let data = req.body;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { data = {}; }
  }
  data = data || {};

  // Hidden honeypot field: real visitors leave it empty, bots fill it in.
  if (data.company_site) return res.status(200).json({ ok: true });

  const name = String(data.name || "").trim().slice(0, 200);
  const business = String(data.business || "").trim().slice(0, 200);
  const contact = String(data.contact || "").trim().slice(0, 200);
  const info = String(data.info || "").trim().slice(0, 5000);

  if (!name || !business || !contact) {
    return res.status(400).json({ error: "Name, type of business and contact are required." });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ error: "Email is not configured." });

  const to = process.env.CONTACT_TO || "clearworkstudiollc@gmail.com";
  const from = process.env.CONTACT_FROM || "Clearwork Website <onboarding@resend.dev>";
  const replyTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? contact : undefined;

  const html = `
    <h2 style="margin:0 0 12px">New intro call request</h2>
    <p><b>Name:</b> ${esc(name)}</p>
    <p><b>Type of business:</b> ${esc(business)}</p>
    <p><b>Email or phone:</b> ${esc(contact)}</p>
    <p><b>Additional information:</b><br>${esc(info || "(none)").replace(/\n/g, "<br>")}</p>
    <p style="color:#888;font-size:12px">Sent from the Schedule a call form on clearworkstudiohq.com</p>`;

  const text = `New intro call request\n\nName: ${name}\nType of business: ${business}\nEmail or phone: ${contact}\n\nAdditional information:\n${info || "(none)"}`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Intro call request: ${name} (${business})`,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!r.ok) {
      console.error("Resend error", r.status, await r.text());
      return res.status(502).json({ error: "Could not send right now." });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: "Could not send right now." });
  }
};
