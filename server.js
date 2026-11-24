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

// Cookies dari Railway Variable
if (process.env.YT_COOKIES) {
  try {
    fs.writeFileSync(COOKIES_PATH, process.env.YT_COOKIES);
    console.log('Cookies berhasil ditulis dari environment variable');
  } catch (e) {
    console.error('Gagal menulis cookies:', e.message);
  }
}

function statusPayload() {
  return {
    status: 'Rezzz Audio API aktif',
    version: '2.3-fixed-bot',
    cookies: fs.existsSync(COOKIES_PATH) ? 'ada' : 'tidak ada',
    pot: process.env.POT_URL ? 'ada' : 'tidak ada',
    proxy: process.env.YT_PROXY ? 'ada' : 'tidak ada'
  };
}

app.get('/api/status', (req, res) => res.json(statusPayload()));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/qris.png', (req, res) => {
  const f = path.join(__dirname, 'qris.png');
  if (fs.existsSync(f)) return res.sendFile(f);
  res.status(404).end();
});

app.get('/', (req, res) => {
  const candidates = [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'Index.htm'),
    path.join(__dirname, 'public', 'index.html')
  ];
  const found = candidates.find(f => fs.existsSync(f));
  if (found) return res.sendFile(found);
  res.json(statusPayload());
});

function buildArgs(url, useCookies = true) {
  const id = uuidv4().slice(0, 8);
  const outputTemplate = path.join(TEMP, `rezzz-${id}.%(ext)s`);

  const args = [
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '0',
    '-o', outputTemplate,
    '--no-playlist',
    '--force-ipv4',
    '--retries', '10',
    '--fragment-retries', '10',
    '--sleep-requests', '1',
    '--sleep-interval', '2',
    '--max-sleep-interval', '5',
    '--no-warnings',
    // Player client yang lebih tahan bot (urutan penting)
    '--extractor-args', 'youtube:player_client=android,tv,ios,web_embedded,mweb,web',
  ];

  // JS Runtime
  if (process.env.JS_RUNTIME === 'deno') {
    args.push('--js-runtimes', 'deno');
  } else {
    args.push('--js-runtimes', 'node');
  }

  // Proxy
  if (process.env.YT_PROXY) {
    args.push('--proxy', process.env.YT_PROXY);
  }

  // PO Token (bgutil)
  if (process.env.POT_URL) {
    args.push('--extractor-args', `youtubepot-bgutilhttp:base_url=${process.env.POT_URL}`);
  }

  // Cookies
  if (useCookies && fs.existsSync(COOKIES_PATH)) {
    args.push('--cookies', COOKIES_PATH);
  }

  args.push(url);
  return { args, id };
}

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    execFile('yt-dlp', args, {
      timeout: 240000,
      maxBuffer: 8 * 1024 * 1024
    }, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stderr: stderr || '', stdout: stdout || '' });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

function findDownloadedFile(id) {
  try {
    const files = fs.readdirSync(TEMP).filter(
      f => f.startsWith(`rezzz-${id}.`) && !f.endsWith('.part') && !f.endsWith('.ytdl')
    );
    return files.length ? path.join(TEMP, files[0]) : null;
  } catch {
    return null;
  }
}

app.post(['/download', '/api/download'], async (req, res) => {
  const body = req.body || {};
  let url = body.url;

  console.log('===== DOWNLOAD REQUEST =====');
  console.log('URL:', url);

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

  const hasCookies = fs.existsSync(COOKIES_PATH);
  console.log('Cookies tersedia:', hasCookies ? 'YA' : 'TIDAK');

  // ===== PERCOBAAN 1: Dengan Cookies (prioritas) =====
  if (hasCookies) {
    try {
      console.log('Mencoba DENGAN cookies...');
      const { args, id } = buildArgs(url, true);
      await runYtDlp(args);

      const filePath = findDownloadedFile(id);
      if (filePath) {
        console.log('Berhasil dengan cookies');
        return res.download(filePath, path.basename(filePath), err => {
          fs.unlink(filePath, () => {});
          if (err) console.error('Response error:', err.message);
        });
      }
    } catch (err) {
      const errMsg = (err.stderr || '') + (err.error?.message || '');
      console.log('Gagal dengan cookies:', errMsg.slice(0, 400));

      // Kalau error bot verification, jangan langsung kasih tau user terlalu teknis
      if (errMsg.includes('Sign in to confirm') || errMsg.includes('not a bot')) {
        console.log('→ Terdeteksi bot verification');
      }
    }
  }

  // ===== PERCOBAAN 2: Tanpa Cookies =====
  try {
    console.log('Mencoba TANPA cookies...');
    const { args, id } = buildArgs(url, false);
    await runYtDlp(args);

    const filePath = findDownloadedFile(id);
    if (filePath) {
      console.log('Berhasil tanpa cookies');
      return res.download(filePath, path.basename(filePath), err => {
        fs.unlink(filePath, () => {});
        if (err) console.error('Response error:', err.message);
      });
    }

    return res.status(500).json({
      error: 'File tidak ditemukan setelah download'
    });
  } catch (err) {
    const fullError = (err.error?.message || '') + '\n' + (err.stderr || '');
    console.error('Gagal total:', fullError.slice(0, 600));

    let userMessage = 'Gagal mengambil audio';

    if (fullError.includes('Sign in to confirm') || fullError.includes('not a bot')) {
      userMessage = 'YouTube minta verifikasi bot. Coba update cookies atau hubungi admin.';
    } else if (fullError.includes('Private video') || fullError.includes('This video is private')) {
      userMessage = 'Video bersifat private';
    } else if (fullError.includes('Video unavailable')) {
      userMessage = 'Video tidak tersedia';
    }

    return res.status(500).json({
      error: userMessage,
      detail: process.env.NODE_ENV === 'development' ? fullError.slice(0, 800) : undefined
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Rezzz Audio API running on port ${PORT}`);
  console.log('Cookies status:', fs.existsSync(COOKIES_PATH) ? 'ADA' : 'TIDAK ADA');
  console.log('POT status:', process.env.POT_URL ? 'ADA' : 'TIDAK ADA');
  console.log('Proxy status:', process.env.YT_PROXY ? 'ADA' : 'TIDAK ADA');
});
