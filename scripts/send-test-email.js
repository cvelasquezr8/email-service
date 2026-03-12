const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

function parseDotEnv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const env = {};
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    let key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }

    env[key] = val;
  }

  return env;
}

async function main() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('.env not found at', envPath);
    process.exit(1);
  }

  const env = parseDotEnv(envPath);
  const host = env.EMAIL_HOST;
  const port = Number(env.EMAIL_PORT) || 587;
  const secure = String(env.EMAIL_SECURE).toLowerCase() === 'true';
  const user = env.EMAIL_USER;
  const pass = env.EMAIL_PASSWORD;

  if (!host || !user || !pass) {
    console.error('Missing EMAIL_HOST, EMAIL_USER or EMAIL_PASSWORD in .env');
    process.exit(1);
  }

  console.log('Using SMTP:', host, port, 'secure=', secure);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });

  try {
    await transporter.verify();
    console.log('SMTP connection verified');
  } catch (err) {
    console.error('SMTP verification failed:', err && err.message ? err.message : err);
  }

  const now = new Date();

  const variants = [
    {
      name: 'minimal-plain-no-reply',
      mail: {
        from: `"Test" <${user}>`,
        to: user,
        subject: 'Test (minimal plain)',
        text: 'This is a minimal plain-text test message.',
        headers: {
          'Message-ID': `<${Date.now()}.${Math.random().toString(36).slice(2)}@${user.split('@')[1]}>`,
          Date: now.toUTCString(),
        },
      },
    },
    {
      name: 'html-with-unsubscribe',
      mail: {
        from: `"Test" <${user}>`,
        to: user,
        subject: 'Test (html + List-Unsubscribe)',
        text: 'This is a plain fallback for html test.',
        html: '<p>This is a <strong>HTML</strong> test message.</p>',
        headers: {
          'Message-ID': `<${Date.now()}.${Math.random().toString(36).slice(2)}@${user.split('@')[1]}>`,
          Date: now.toUTCString(),
          'List-Unsubscribe': `<mailto:${user}?subject=unsubscribe>`,
        },
      },
    },
    {
      name: 'reply-to-no-reply',
      mail: {
        from: `"Test" <${user}>`,
        to: user,
        subject: 'Test (reply-to no-reply)',
        text: 'Test with reply-to set to no-reply.',
        replyTo: `no-reply@${user.split('@')[1]}`,
        headers: {
          'Message-ID': `<${Date.now()}.${Math.random().toString(36).slice(2)}@${user.split('@')[1]}>`,
          Date: now.toUTCString(),
        },
      },
    },
  ];

  // additional variants: try using NO_REPLY_EMAIL, add Sender header, and explicit envelope returnPath
  const noReply = env.NO_REPLY_EMAIL || `no-reply@${user.split('@')[1]}`;
  variants.push(
    {
      name: 'no-reply-envelope',
      mail: {
        from: `"No Reply" <${noReply}>`,
        to: user,
        subject: 'Test (no-reply envelope)',
        text: 'Testing with NO_REPLY_EMAIL as From and envelope.',
        headers: {
          'Message-ID': `<${Date.now()}.${Math.random().toString(36).slice(2)}@${user.split('@')[1]}>`,
          Date: now.toUTCString(),
        },
        envelope: { from: noReply, to: [user] },
      },
    },
    {
      name: 'sender-header-auth',
      mail: {
        from: `"Website" <${noReply}>`,
        to: user,
        subject: 'Test (Sender header set to auth user)',
        text: 'Testing with Sender header set to authenticated user.',
        headers: {
          'Message-ID': `<${Date.now()}.${Math.random().toString(36).slice(2)}@${user.split('@')[1]}>`,
          Date: now.toUTCString(),
          Sender: user,
        },
      },
    },
    {
      name: 'return-path-envelope',
      mail: {
        from: `"Test" <${user}>`,
        to: user,
        subject: 'Test (explicit return-path/envelope)',
        text: 'Testing explicit return-path via envelope.from',
        headers: {
          'Message-ID': `<${Date.now()}.${Math.random().toString(36).slice(2)}@${user.split('@')[1]}>`,
          Date: now.toUTCString(),
        },
        envelope: { from: user, to: [user] },
      },
    },
  );

  for (const v of variants) {
    console.log('\n--- Attempting variant:', v.name, '---');
    try {
      const info = await transporter.sendMail(v.mail);
      console.log('Variant send result:', v.name, info);
      // If one succeeds, stop further attempts.
      break;
    } catch (err) {
      console.error('Variant failed:', v.name, err && err.message ? err.message : err);
      if (err && err.response) console.error('Server response:', err.response);
    }

    // small delay between attempts
    await new Promise((res) => setTimeout(res, 1200));
  }

  process.exit(0);
}

main();
