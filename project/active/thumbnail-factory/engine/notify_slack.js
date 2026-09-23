const SLACK = process.env.SLACK_WEBHOOK;

async function notifySlack(text) {
  if (!SLACK) return false;
  const r = await fetch(SLACK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!r.ok) throw new Error(`slack ${r.status}: ${await r.text()}`);
  return true;
}

async function main() {
  const text = process.argv.slice(2).join(' ');
  if (!text) { console.error('usage: node notify_slack.js <message>'); process.exit(1); }
  console.log(await notifySlack(text) ? 'sent' : 'no webhook configured');
}
if (require.main === module) main();
module.exports = { notifySlack };
