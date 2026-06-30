const {app, BrowserWindow, ipcMain, Menu, MenuItem, dialog} = require('electron/main')
const path = require('path')
const http = require("http");
const fs = require("fs");
const {exec, execSync} = require('child_process')

app.commandLine.appendSwitch('charset', 'utf-8');

// Chromium cache errors ("Unable to move the cache: Access is denied", GPU cache -2) often come from
// Windows permission/sync issues (e.g. OneDrive). Force userData and disk caches under AppData\Roaming.
const userDataPath = path.join(app.getPath('appData'), 'Spine Viewer')
app.setPath('userData', userDataPath)
const diskCacheDir = path.join(userDataPath, 'chromium-disk-cache')
try {
    fs.mkdirSync(diskCacheDir, {recursive: true})
} catch (_) { /* ignore */ }
app.commandLine.appendSwitch('disk-cache-dir', diskCacheDir)
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')

process.env.CACHE_PATH = path.join(userDataPath, 'export-cache')
try {
    fs.mkdirSync(process.env.CACHE_PATH, {recursive: true})
} catch (_) { /* ignore */ }

function resolveBundledFfmpegPath() {
    const resourceRoot = process.resourcesPath || __dirname
    const ffmpegDir = path.join(resourceRoot, 'ffmpeg')
    const unpackedFfmpegDir = ffmpegDir.includes('app.asar')
        ? ffmpegDir.replace('app.asar', 'app.asar.unpacked')
        : path.join(__dirname, 'ffmpeg')
    const dirs = [unpackedFfmpegDir, ffmpegDir, path.join(__dirname, 'ffmpeg')]
    const candidates = []
    for (const dir of dirs) {
        candidates.push(
            ...(process.platform === 'win32'
                ? [path.join(dir, 'ffmpeg.exe'), path.join(dir, 'ffmpeg')]
                : [path.join(dir, 'ffmpeg'), path.join(dir, 'ffmpeg.exe')])
        )
    }
    return candidates.find(candidate => fs.existsSync(candidate)) || null
}

function resolveInstalledFfmpegPath() {
    try {
        const installer = require('@ffmpeg-installer/ffmpeg')
        if (installer?.path) {
            const ffmpegPath = installer.path.includes('app.asar')
                ? installer.path.replace('app.asar', 'app.asar.unpacked')
                : installer.path
            if (fs.existsSync(ffmpegPath)) {
                return ffmpegPath
            }
        }
    } catch (_) { /* optional dependency */ }

    const commonPaths = [
        '/opt/homebrew/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        '/usr/bin/ffmpeg'
    ]
    for (const candidate of commonPaths) {
        if (fs.existsSync(candidate)) return candidate
    }

    try {
        const shell = process.env.SHELL || '/bin/bash'
        const result = execSync(`${shell} -lc "command -v ffmpeg"`, {encoding: 'utf8'}).trim()
        if (result && fs.existsSync(result)) return result
    } catch (_) { /* not on PATH */ }

    return null
}

process.env.FFMPEG_PATH = resolveBundledFfmpegPath() || resolveInstalledFfmpegPath() || ''

function resolveFfmpegCommand() {
    if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
        return `"${process.env.FFMPEG_PATH}"`
    }
    return 'ffmpeg'
}

let win, sub;
let animation;

const createWindow = (log) => {
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false,
        minWidth: 400,
        minHeight: 40,
        fullscreenable: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })

    win.on('maximize', () => {
        win.webContents.send('set-maximized-icon')
    })

    win.on('unmaximize', () => {
        win.webContents.send('set-unmaximized-icon')
    })

    win.loadFile('./src/index.html').then(() => {
        win.webContents.send('debug', log)
        sub = new BrowserWindow({
            width: 450,
            height: 300,
            frame: false,
            parent: win,
            modal: true,
            show: false,
            resizable: false,
            minimizable: false,
            maximizable: false,
            fullscreenable: false,
            autoHideMenuBar: true,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js')
            }
        })
        sub.loadFile('./src/pages/export.html').then(() => {
            ipcMain.on('open-export-window', (ev, animations) => {
                sub.webContents.send('receive-export-animations', animations)
                sub.show()
            })
            ipcMain.on('close-export-window', () => {
                sub.hide()
                win.webContents.send('export-window-closed')
            })
            ipcMain.on('send-export-progress', (ev, data) => {
                sub.webContents.send('set-export-progress', data)
            })
            ipcMain.on('send-export-options', (ev, options) => {
                win.webContents.send('receive-export-options', options)
            })
        })
    })

}

function mimeTypeForFile(filePath) {
    const lower = filePath.toLowerCase()
    if (lower.endsWith('.json')) return 'application/json; charset=utf-8'
    if (lower.endsWith('.webp')) return 'image/webp'
    if (lower.endsWith('.png')) return 'image/png'
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
    if (lower.endsWith('.atlas') || lower.endsWith('.txt')) return 'text/plain; charset=utf-8'
    if (lower.endsWith('.skel')) return 'application/octet-stream'
    return 'application/octet-stream'
}

// Local HTTP server for loading project files
const server = http.createServer((req, res) => {
    let filePath = decodeURIComponent(req.url.slice(1))
    let fileExists;
    if (filePath.toLowerCase().endsWith('.atlas')) {
        let txtPath = filePath + '.txt'
        filePath = (fs.existsSync(filePath) && filePath) || (fs.existsSync(txtPath) && txtPath)
        fileExists = !!filePath
    } else {
        fileExists = fs.existsSync(filePath)
    }
    if (!fileExists) {
        res.writeHead(404);
        res.end('File not found');
        return;
    }

    const contentType = mimeTypeForFile(filePath)
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500);
            res.end('Error loading file');
            return;
        }
        res.writeHead(200, {'Content-Type': contentType});
        res.end(data);
    });
});

server.listen(0, 'localhost', () => {
});


app.whenReady().then(() => {
    let log = {}
    if (!fs.existsSync(process.env.CACHE_PATH)) {
        fs.mkdirSync(process.env.CACHE_PATH, {recursive: true});
    }
    if (!process.env.FFMPEG_PATH || !fs.existsSync(process.env.FFMPEG_PATH)) {
        log.error = 'ffmpeg not found! Install ffmpeg or add it to the ffmpeg folder.'
    } else {
        log.ffmpeg = process.env.FFMPEG_PATH
    }

    createWindow(log)

    ipcMain.handle('port', () => server.address().port)
    ipcMain.on('minimize', () => win.minimize())
    ipcMain.on('toggle-maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize())
    ipcMain.on('close', () => win.close())
    ipcMain.on('show-context-menu', (ev) => {
        const contextMenu = new Menu();
        contextMenu.append(new MenuItem({
            label: 'Copy image',
            click: () => {
                win.webContents.send('copy-image')
            }
        }));
        contextMenu.popup(win, ev.x, ev.y);
    })

    // Export (GIF/APNG/MP4 via ffmpeg)
    ipcMain.handle('select-export-path', async (ev) => {
        const senderWindow = BrowserWindow.fromWebContents(ev.sender)
        const dialogWindow = senderWindow || sub || win
        const result = await dialog.showOpenDialog(dialogWindow, {
            title: 'Output folder',
            properties: ['openDirectory', 'createDirectory']
        })
        return result.canceled ? '' : (result.filePaths[0] ?? '')
    })
    ipcMain.handle('prepare-export', (ev, name) => {
        animation = name.replace(/[\\/:"*?<>|]/g, '_')
        const imagePath = path.join(process.env.CACHE_PATH, animation)
        if (fs.existsSync(imagePath)) {
            for (const file of fs.readdirSync(imagePath)) {
                fs.unlinkSync(path.join(imagePath, file))
            }
        }
        fs.mkdirSync(imagePath, {recursive: true})
    })
    ipcMain.handle('save-image', (ev, image) => saveBase64Image(image))
    ipcMain.handle('ffmpeg', (ev, options) => {
        const imagePath = path.join(process.env.CACHE_PATH, animation)
        const outputPath = options.output
        const ffmpegCmd = resolveFfmpegCommand()
        const safeAnimationName = options.animation.replace(/[\\/:"*?<>|]/g, '_')
        if (!process.env.FFMPEG_PATH || !fs.existsSync(process.env.FFMPEG_PATH)) {
            const result = {
                success: false,
                error: 'ffmpeg not found. Install ffmpeg globally or add a binary to the ffmpeg folder.'
            }
            sub?.webContents.send('export-complete', result)
            win?.webContents.send('export-complete', result)
            return result
        }
        const inputPattern = path.join(imagePath, '%05d.png')
        const outputFile = path.join(outputPath, `${safeAnimationName}.${options.format === 'MP4' ? 'mp4' : options.format === 'APNG' ? 'apng' : 'gif'}`)
        let instruction;
        switch (options.format) {
            case 'APNG':
                instruction = `${ffmpegCmd} -y -framerate ${options.framerate} -i "${inputPattern}" -vf "split[s0][s1];[s0]palettegen=reserve_transparent=1[p];[s1][p]paletteuse=alpha_threshold=128" -plays 0 "${outputFile}"`
                break
            case 'MP4':
                instruction = `${ffmpegCmd} -y -framerate ${options.framerate} -i "${inputPattern}" -vf "format=yuv420p" -crf 17 -pix_fmt yuv420p "${outputFile}"`
                break
            case 'GIF':
            default:
                instruction = `${ffmpegCmd} -y -framerate ${options.framerate} -i "${inputPattern}" -vf "split[s0][s1];[s0]palettegen=reserve_transparent=1[p];[s1][p]paletteuse=alpha_threshold=128" "${outputFile}"`
                break
        }
        return new Promise((resolve) => {
            exec(instruction, (error, stdout, stderr) => {
                const missingLocalBinary = !fs.existsSync(process.env.FFMPEG_PATH)
                const debugInfo = {stdout, stderr}
                if (error) {
                    debugInfo.error = error.message
                    if (missingLocalBinary) {
                        debugInfo.hint = `Local ffmpeg missing at ${process.env.FFMPEG_PATH}. Add ffmpeg to the ffmpeg folder or install ffmpeg globally and ensure it is on PATH.`
                    }
                }
                win.webContents.send('debug', debugInfo)
                try {
                    if (fs.existsSync(imagePath)) {
                        for (const file of fs.readdirSync(imagePath)) {
                            fs.unlinkSync(path.join(imagePath, file))
                        }
                        fs.rmdirSync(imagePath)
                    }
                } catch (cleanupError) {
                    debugInfo.cleanupError = cleanupError.message
                }
                const result = {success: !error, error: error ? (stderr || error.message) : undefined}
                sub.webContents.send('export-complete', result)
                win.webContents.send('export-complete', result)
                resolve(result)
            })
        })
    })

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})


// Save a base64-encoded frame to disk
function saveBase64Image(image) {
    const base64Image = image.data.split(';base64,').pop();
    const imageBuffer = Buffer.from(base64Image, 'base64');

    fs.writeFileSync(path.join(process.env.CACHE_PATH, animation, `${image.index}.png`), imageBuffer)

    return true
}