const express = require('express');
const cors = require('cors');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 3000;
const TEMP = '/tmp';
const COOKIES_PATH = path.join(__dirname, 'cookies.txt');

app.get('/', (req, res) => {
  res.json({
    status: 'Rezzz Audio API aktif',
    version: '2.1-hybrid',
    cookies: fs.existsSync(COOKIES_PATH) ? 'ada' : 'tidak ada'
  });
});

function buildArgs(url, useCookies) {
  const id = uuidv4().slice(0, 8);
  const outputTemplate = path.join(TEMP, `rezzz-${id}.%(ext)s`);

  const args = [
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '0',
    '-o', outputTemplate,
    '--no-playlist',
    '--js-runtimes', 'node',
    '--no-warnings',
    '--extractor-args', 'youtube:player_client=ios,web,mweb,android',
    '--retries', '8',
    '--fragment-retries', '8'
  ];

  if (useCookies && fs.existsSync(COOKIES_PATH)) {
    args.push('--cookies', COOKIES_PATH);
  }

  args.push(url);
  return { args, id, outputTemplate };
}

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    execFile('yt-dlp', args, { timeout: 180000 }, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

app.post('/download', async (req, res) => {
  const body = req.body || {};
  let url = body.url;

  console.log('DOWNLOAD REQUEST:', url);

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL wajib diisi' });
  }

  url = url.trim();

  const supported =
    url.includes('youtube.com') ||
    url.includes('youtu.be') ||
    url.includes('tiktok.com') ||
    url.includes('soundcloud.com') ||
    url.includes('instagram.com') ||
    url.includes('twitter.com') ||
    url.includes('x.com');

  if (!supported) {
    return res.status(400).json({ error: 'Link tidak didukung' });
  }

  let lastError = null;

  // 1. Coba dengan cookies dulu (kalau ada)
  if (fs.existsSync(COOKIES_PATH)) {
    try {
      console.log('Mencoba dengan cookies...');
      const { args, id } = buildArgs(url, true);
      await runYtDlp(args);

      const files = fs.readdirSync(TEMP).filter(f => f.startsWith(`rezzz-${id}`));
      if (files.length > 0) {
        const filePath = path.join(TEMP, files[0]);
        return res.download(filePath, files[0], (err) => {
          fs.unlink(filePath, () => {});
        });
      }
    } catch (err) {
      console.log('Gagal dengan cookies, coba tanpa cookies...');
      lastError = err;
    }
  }

  // 2. Fallback tanpa cookies
  try {
    console.log('Mencoba tanpa cookies...');
    const { args, id } = buildArgs(url, false);
    await runYtDlp(args);

    const files = fs.readdirSync(TEMP).filter(f => f.startsWith(`rezzz-${id}`));
    if (files.length === 0) {
      return res.status(500).json({ error: 'File tidak ditemukan setelah download' });
    }

    const filePath = path.join(TEMP, files[0]);
    return res.download(filePath, files[0], (err) => {
      fs.unlink(filePath, () => {});
    });
  } catch (err) {
    console.error('Gagal total:', err.error?.message || err);
    return res.status(500).json({
      error: 'Gagal download',
      detail: (err.error?.message || '') + (err.stderr ? '\n' + err.stderr : '')
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Rezzz Audio API running on port ${PORT}`);
  console.log('Cookies status:', fs.existsSync(COOKIES_PATH) ? 'ADA' : 'TIDAK ADA');
});
