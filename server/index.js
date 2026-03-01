const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.status(200).send('OK'));

// Serve static files
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// Temp and output directories
const tempDir = path.join(__dirname, '../temp');
const outputDir = path.join(__dirname, '../output');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

app.use('/output', express.static(outputDir));

const jobs = {};

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ─── Find yt-dlp binary ───────────────────────────────────────────────────────
function getYtDlpPath() {
    // On Railway (Linux), yt-dlp is installed via nixpacks
    if (process.platform !== 'win32') return 'yt-dlp';
    // On Windows (local dev), use the bundled exe
    const localExe = path.join(__dirname, '../yt-dlp.exe');
    if (fs.existsSync(localExe)) return localExe;
    return 'yt-dlp';
}

// ─── Find ffmpeg ──────────────────────────────────────────────────────────────
function getFfmpegPath() {
    if (process.platform === 'linux') return 'ffmpeg';
    try { return require('ffmpeg-static'); } catch (e) { return 'ffmpeg'; }
}

function getFfmpeg() {
    const ffmpeg = require('fluent-ffmpeg');
    ffmpeg.setFfmpegPath(getFfmpegPath());
    return ffmpeg;
}

// ─── Test Route ───────────────────────────────────────────────────────────────
app.get('/api/test', (req, res) => {
    const results = {
        platform: process.platform,
        nodeVersion: process.version,
        ytdlpPath: getYtDlpPath(),
        ffmpegPath: getFfmpegPath(),
        modules: {}
    };
    try { require('fluent-ffmpeg'); results.modules.fluent_ffmpeg = 'OK'; }
    catch (e) { results.modules.fluent_ffmpeg = 'FAIL: ' + e.message; }
    res.json(results);
});

// ─── Get video info using yt-dlp ──────────────────────────────────────────────
function getVideoInfo(url) {
    return new Promise((resolve, reject) => {
        const ytdlp = getYtDlpPath();
        const args = [
            '--dump-json',
            '--no-playlist',
            '--socket-timeout', '30',
            url
        ];
        console.log('[info] Running yt-dlp --dump-json...');
        const proc = spawn(ytdlp, args, { timeout: 60000 });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', d => stdout += d.toString());
        proc.stderr.on('data', d => stderr += d.toString());
        proc.on('close', code => {
            if (code === 0 && stdout.trim()) {
                try {
                    const info = JSON.parse(stdout.trim());
                    resolve(info);
                } catch (e) {
                    reject(new Error('Failed to parse video info: ' + e.message));
                }
            } else {
                console.error('[info error]', stderr.substring(0, 500));
                reject(new Error('yt-dlp info failed: ' + (stderr.substring(0, 300) || 'Unknown error')));
            }
        });
        proc.on('error', e => reject(new Error('yt-dlp not found: ' + e.message)));
    });
}

// ─── Download video using yt-dlp ─────────────────────────────────────────────
function downloadVideo(url, outputPath) {
    return new Promise((resolve, reject) => {
        const ytdlp = getYtDlpPath();
        const args = [
            '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            '--merge-output-format', 'mp4',
            '--socket-timeout', '30',
            '--retries', '3',
            '--no-playlist',
            '-o', outputPath,
            url
        ];
        console.log('[download] Starting yt-dlp download...');
        const proc = spawn(ytdlp, args, { timeout: 600000 });
        let stderr = '';
        proc.stdout.on('data', d => process.stdout.write(d));
        proc.stderr.on('data', d => {
            stderr += d.toString();
            process.stderr.write(d);
        });
        proc.on('close', code => {
            if (code === 0 && fs.existsSync(outputPath)) {
                console.log('[download] Done!');
                resolve();
            } else {
                // yt-dlp sometimes outputs to .mkv - check for it
                const mkvPath = outputPath.replace('.mp4', '.mkv');
                if (fs.existsSync(mkvPath)) {
                    resolve(); // will use ffmpeg to convert
                } else {
                    reject(new Error('Download failed (code ' + code + '): ' + stderr.substring(0, 400)));
                }
            }
        });
        proc.on('error', e => reject(new Error('yt-dlp spawn error: ' + e.message)));
    });
}

// ─── Main Processing Function ─────────────────────────────────────────────────
async function processVideo(jobId, url, numClips) {
    try {
        jobs[jobId].status = 'fetching_info';
        console.log('[' + jobId + '] Getting video info...');

        const info = await getVideoInfo(url);
        const duration = parseInt(info.duration || info.lengthSeconds || 0);
        jobs[jobId].title = info.title || 'Unknown Title';

        console.log('[' + jobId + '] Title:', jobs[jobId].title, '| Duration:', duration + 's');

        if (duration < 60) throw new Error('Video must be at least 1 minute long.');

        // Download
        const tempPath = path.join(tempDir, jobId + '_merged.mp4');
        jobs[jobId].status = 'downloading';
        await downloadVideo(url, tempPath);

        // If mp4 not found, check mkv
        let actualTempPath = tempPath;
        if (!fs.existsSync(tempPath)) {
            const mkvPath = tempPath.replace('.mp4', '.mkv');
            if (fs.existsSync(mkvPath)) actualTempPath = mkvPath;
            else throw new Error('Downloaded file not found after yt-dlp.');
        }

        console.log('[' + jobId + '] Downloaded to:', actualTempPath);

        // Calculate clip timings
        const interval = Math.floor(duration / numClips);
        const clipDuration = Math.max(20, Math.min(60, interval));
        const projectDir = path.join(outputDir, jobId);
        if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });

        jobs[jobId].status = 'segmenting';
        const ffmpegLib = getFfmpeg();

        for (let i = 0; i < numClips; i++) {
            const startTime = i * interval;
            const fileName = 'clip_' + (i + 1) + '.mp4';
            const outPath = path.join(projectDir, fileName);

            await new Promise((resolve, reject) => {
                ffmpegLib(actualTempPath)
                    .setStartTime(startTime)
                    .setDuration(clipDuration)
                    .videoFilters([
                        'crop=ih*9/16:ih:(iw-ih*9/16)/2:0',
                        'scale=1080:1920'
                    ])
                    .videoCodec('libx264')
                    .audioCodec('aac')
                    .audioBitrate('128k')
                    .outputOptions([
                        '-preset fast',
                        '-crf 23',
                        '-movflags +faststart',
                        '-pix_fmt yuv420p'
                    ])
                    .output(outPath)
                    .on('end', () => {
                        jobs[jobId].clips.push({
                            id: i,
                            url: '/output/' + jobId + '/' + fileName,
                            title: 'Clip ' + (i + 1),
                            startTime,
                            duration: clipDuration
                        });
                        jobs[jobId].progress = Math.round(((i + 1) / numClips) * 100);
                        console.log('[' + jobId + '] Clip ' + (i + 1) + '/' + numClips + ' done');
                        resolve();
                    })
                    .on('error', (err) => {
                        console.error('[ffmpeg error] Clip ' + (i + 1) + ':', err.message);
                        reject(new Error('FFmpeg error on clip ' + (i + 1) + ': ' + err.message));
                    })
                    .run();
            });
        }

        jobs[jobId].status = 'completed';

        // Cleanup temp file
        try {
            if (fs.existsSync(actualTempPath)) fs.unlinkSync(actualTempPath);
        } catch (e) { console.warn('Cleanup error:', e.message); }

        console.log('[' + jobId + '] All ' + numClips + ' clips done!');

    } catch (error) {
        console.error('[FAILED] Job ' + jobId + ':', error.message);
        jobs[jobId].status = 'failed';
        jobs[jobId].error = error.message;
    }
}

// ─── API Routes ───────────────────────────────────────────────────────────────
app.post('/api/process', async (req, res) => {
    const { url, numClips } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    // Basic YouTube URL check
    const youtubePattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/).+/;
    if (!youtubePattern.test(url)) {
        return res.status(400).json({ error: 'Invalid YouTube URL. Use format: https://youtube.com/watch?v=...' });
    }

    const clipsCount = Math.min(30, Math.max(1, parseInt(numClips) || 15));
    const jobId = generateId();
    jobs[jobId] = { status: 'starting', progress: 0, clips: [], title: 'Loading...', totalClips: clipsCount };
    res.json({ jobId });

    // Run async (don't await)
    processVideo(jobId, url, clipsCount);
});

app.get('/api/status/:jobId', (req, res) => {
    const job = jobs[req.params.jobId];
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
    console.log('ClipTube AI running on http://' + HOST + ':' + PORT);
    console.log('Platform: ' + process.platform + ' | Node: ' + process.version);
    console.log('yt-dlp path: ' + getYtDlpPath());
    console.log('ffmpeg path: ' + getFfmpegPath());
});
