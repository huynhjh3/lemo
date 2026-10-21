// Lemo CRM mailbox reader — paste this into script.google.com while signed in
// as the shared CRM mailbox (lemowellness@gmail.com).
//
// Every 5 minutes it sends any new messages to the CRM's mail-intake function,
// which logs replies from known contacts onto their company and holds the
// rest for you in CRM -> Inbox -> Replies.

const ENDPOINT = 'https://lxmvtowhqzghmnkjtimo.supabase.co/functions/v1/mail-intake';
const SECRET = 'PASTE_YOUR_MAIL_WEBHOOK_SECRET_HERE';

// Drops the quoted history under a reply so only the new text is stored.
function newText_(body) {
  const lines = body.replace(/\r/g, '').split('\n');
  const out = [];
  for (const line of lines) {
    if (/^On .+ wrote:\s*$/.test(line) || /^-{2,}\s*Original Message/i.test(line) || /^From:\s/.test(line) || line.startsWith('>')) break;
    out.push(line);
  }
  return out.join('\n').trim().slice(0, 5000);
}

function syncToCrm() {
  const props = PropertiesService.getScriptProperties();
  // First run looks back 3 days; after that, only what's new since the last run.
  const last = Number(props.getProperty('lastSync')) || (Date.now() - 3 * 24 * 3600 * 1000);
  const threads = GmailApp.search('in:anywhere -in:spam -in:trash after:' + Math.floor(last / 1000), 0, 50);

  const messages = [];
  let newest = last;
  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (m) {
      const t = m.getDate().getTime();
      if (t <= last) return;
      newest = Math.max(newest, t);
      messages.push({
        message_id: m.getId(),
        from: m.getFrom(), to: m.getTo(), cc: m.getCc(),
        subject: m.getSubject(),
        date: m.getDate().toISOString(),
        body: newText_(m.getPlainBody()),
        // A forward keeps the original message in its body — send it whole so the CRM can read who it was from.
        forwarded: /^\s*(fwd?|fw):/i.test(m.getSubject()) ? m.getPlainBody().slice(0, 12000) : '',
      });
    });
  });
  if (!messages.length) return;

  const res = UrlFetchApp.fetch(ENDPOINT, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'X-Webhook-Secret': SECRET },
    payload: JSON.stringify({ messages: messages }),
  });
  if (res.getResponseCode() === 200) {
    props.setProperty('lastSync', String(newest));
  } else {
    // Leave lastSync alone so the next run retries these messages.
    console.error('CRM sync failed: ' + res.getResponseCode() + ' ' + res.getContentText());
  }
}

// Run this once by hand to create the 5-minute schedule.
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncToCrm').timeBased().everyMinutes(5).create();
}
