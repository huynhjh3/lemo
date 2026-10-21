// Lemo CRM — personal Gmail sync. Paste this into script.google.com while signed
// in to YOUR OWN @lemowellness.com Gmail (not the shared CRM mailbox).
//
// Every 5 minutes it looks at new mail in your account and sends the CRM ONLY
//   1. messages to or from someone saved as a contact in the CRM, and
//   2. any thread you've labelled "CRM" (use it for a cold email to a prospect
//      who isn't saved yet — it lands in CRM -> Inbox -> Replies).
// Everything else stays in your inbox and is never sent anywhere. Your Gmail
// signature, your Sent folder and how you write email don't change.

const ENDPOINT = 'https://lxmvtowhqzghmnkjtimo.supabase.co/functions/v1/mail-intake';
const SECRET = 'PASTE_YOUR_MAIL_WEBHOOK_SECRET_HERE';
const LABEL = 'CRM';

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

function addresses_(s) {
  return ((s || '').match(/[^\s<>"',;()]+@[^\s<>"',;()]+\.[^\s<>"',;()]+/g) || []).map(function (e) { return e.toLowerCase(); });
}

function post_(payload) {
  return UrlFetchApp.fetch(ENDPOINT, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'X-Webhook-Secret': SECRET },
    payload: JSON.stringify(payload),
  });
}

function syncToCrm() {
  const props = PropertiesService.getScriptProperties();
  const me = Session.getActiveUser().getEmail().toLowerCase();
  GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);

  // The CRM's list of saved contact emails — only mail involving one leaves this inbox.
  const list = post_({ action: 'contacts' });
  if (list.getResponseCode() !== 200) { console.error('Could not load contacts: ' + list.getResponseCode() + ' ' + list.getContentText()); return; }
  const known = {};
  JSON.parse(list.getContentText()).emails.forEach(function (e) { known[e] = true; });

  const last = Number(props.getProperty('lastSync')) || (Date.now() - 3 * 24 * 3600 * 1000);
  const threads = GmailApp.search('in:anywhere -in:spam -in:trash -in:chats after:' + Math.floor(last / 1000), 0, 100);

  const messages = [];
  let newest = last;
  threads.forEach(function (thread) {
    const labelled = thread.getLabels().some(function (l) { return l.getName() === LABEL; });
    thread.getMessages().forEach(function (m) {
      const t = m.getDate().getTime();
      if (t <= last || m.isDraft()) return;
      newest = Math.max(newest, t);
      const people = addresses_(m.getFrom() + ' ' + m.getTo() + ' ' + m.getCc()).filter(function (e) { return e !== me; });
      if (!labelled && !people.some(function (e) { return known[e]; })) return;
      messages.push({
        // Prefixed so ids from different people's mailboxes can never collide.
        message_id: me + ':' + m.getId(),
        from: m.getFrom(), to: m.getTo(), cc: m.getCc(),
        subject: m.getSubject(),
        date: m.getDate().toISOString(),
        body: newText_(m.getPlainBody()),
      });
    });
  });
  if (!messages.length) { props.setProperty('lastSync', String(newest)); return; }

  const res = post_({ messages: messages });
  console.log(res.getResponseCode() + ' ' + res.getContentText());
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

// Run by hand to look back 3 days again on the next sync.
function resetSync() {
  PropertiesService.getScriptProperties().deleteProperty('lastSync');
}
