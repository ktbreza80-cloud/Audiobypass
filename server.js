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
const PUBLIC_DIR = path.join(__dirname, 'public');

// Sajikan frontend (public/index.html) kalau ada
app.use(express.static(PUBLIC_DIR));

function statusPayload() {
  return {
    status: 'Rezzz Audio API aktif',
    version: '2.1-hybrid-railway',
    cookies: fs.existsSync(COOKIES_PATH) ? 'ada' : 'tidak ada'
  };
}

app.get('/api/status', (req, res) => {
  res.json(statusPayload());
});

// Fallback: kalau public/index.html belum ada, tampil JSON status
app.get('/', (req, res) => {
  res.json(statusPayload());
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
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
  return { args, id };
}

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    execFile('yt-dlp', args, { timeout: 180000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stderr, stdout });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

function findDownloadedFile(id) {
  const files = fs.readdirSync(TEMP).filter(
    f => f.startsWith(`rezzz-${id}.`) && !f.endsWith('.part')
  );

  return files.length ? path.join(TEMP, files[0]) : null;
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

  if (fs.existsSync(COOKIES_PATH)) {
    try {
      console.log('Mencoba dengan cookies...');
      const { args, id } = buildArgs(url, true);
      await runYtDlp(args);

      const filePath = findDownloadedFile(id);

      if (filePath) {
        return res.download(filePath, path.basename(filePath), err => {
          fs.unlink(filePath, () => {});
          if (err) console.error('Download response error:', err.message);
        });
      }
    } catch (err) {
      console.log('Gagal dengan cookies, coba tanpa cookies...');
    }
  }

  try {
    console.log('Mencoba tanpa cookies...');
    const { args, id } = buildArgs(url, false);
    await runYtDlp(args);

    const filePath = findDownloadedFile(id);

    if (!filePath) {
      return res.status(500).json({
        error: 'File tidak ditemukan setelah download'
      });
    }

    return res.download(filePath, path.basename(filePath), err => {
      fs.unlink(filePath, () => {});
      if (err) console.error('Download response error:', err.message);
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
