// Event listeners

// Drag-and-drop files
getById('main').addEventListener('dragover', (ev) => {
    if (isExporting) return
    ev.preventDefault()
    getById('mask').style.display = 'flex'
})

getById('mask').addEventListener('dragleave', (ev) => {
    ev.preventDefault()
    getById('mask').style.display = 'none'
})

getById('main').addEventListener('drop', async (ev) => {
    if (isExporting) return
    ev.preventDefault()
    getById('mask').style.display = 'none'
    const filePaths = Array.from(ev.dataTransfer.files).map(f => f.path).filter(isSpineAssetPath)
    if (filePaths.length > 0 && filePaths.some(isSpineSkeletonPath)) {
        const fileUrls = await getUrlsByPaths(filePaths)
        window.fileUrls = fileUrls
        loadFiles(fileUrls)
    }
})

// Stack mode checkbox
getById('superposition').addEventListener('click', (ev) => {
    superposition = ev.target.checked
})

// File picker
fileInput.addEventListener('change', async () => {
    if (fileInput.files.length > 0) {
        let filePaths = Array.from(fileInput.files).map(f => f.path).filter(isSpineAssetPath)
        if (filePaths.length === 0 || !filePaths.some(isSpineSkeletonPath)) return
        let fileUrls = await getUrlsByPaths(filePaths)
        window.fileUrls = fileUrls
        loadFiles(fileUrls)
    }
})

// Background color
colorInput.addEventListener('input', () => {
    app.renderer.backgroundColor = parseInt(colorInput.value.slice(1), 16)
})

// Window / scene resize
let resizeTimer, resizeTimer2;
const sceneObserver = new ResizeObserver(() => {
    clearTimeout(resizeTimer)
    clearTimeout(resizeTimer2)
    app.view.style.opacity = '0'
    getById('resolution').style.display = 'block'
    getById('resolution-width').innerText = app.renderer.width
    getById('resolution-height').innerText = app.renderer.height
    resizeTimer = setTimeout(() => {
        getById('resolution').style.display = 'none'
    }, 1500)
    resizeTimer2 = setTimeout(() => {
        app.view.style.opacity = '1'
    }, 100)
});
sceneObserver.observe(scene);

// Alpha mode (texture premultiply)
const alphaModeOptions = document.querySelectorAll('input[name="alpha-mode"]')
alphaModeOptions.forEach((radio) => {
    radio.addEventListener('click', (ev) => {
        if (ev.target.checked) {
            alphaMode = +ev.target.value
            setAlphaMode(alphaMode)
            getById(ev.target.id + '-label').classList.add('checked')
            alphaModeOptions.forEach(option => {
                if (option !== ev.target) {
                    getById(option.id + '-label').classList.remove('checked')
                }
            })
        }
    })
})

// Transparent background toggle
getById('bg-transparent').addEventListener('click', (ev) => {
    if (ev.target.checked) {
        app.renderer.backgroundColor = 0
        app.renderer.backgroundAlpha = 0
        colorInput.disabled = true
    } else {
        app.renderer.backgroundColor = parseInt(colorInput.value.slice(1), 16)
        app.renderer.backgroundAlpha = 1
        colorInput.disabled = false
    }
})

// Zoom slider
zoomInput.addEventListener('input', () => {
    let scale = +zoomInput.value / 100
    setZoom(scale)
    getById('zoom-show').innerText = zoomInput.value + '%'
})

// Speed slider
speedInput.addEventListener('input', () => {
    let speed = +speedInput.value
    setSpeed(speed)
    currentSpeed = speed
    getById('speed-show').innerText = (+speedInput.value).toFixed(2) + 'x'
})

// Default mix time slider
mixInput.addEventListener('input', () => {
    let mix = +mixInput.value
    setMix(mix)
    getById('default-mix-show').innerText = mix.toFixed(1) + 's'
})

// Animation track selection
document.querySelectorAll('input[name="track"]').forEach(t => {
    t.addEventListener('change', () => {
        track.current = +t.value
        const selected = track[t.value]
        document.querySelectorAll('input[name="animation"]').forEach(a => {
            a.checked = a.value === selected
        })
    })
})


// Wheel zoom and drag on canvas
let isDragging = false;
let mouseX, mouseY, deltaX, deltaY;
app.view.addEventListener('pointerdown', (event) => {
    if (event.button === 0) {
        isDragging = true;
        mouseX = event.clientX;
        mouseY = event.clientY;
    }
});
app.view.addEventListener('pointermove', (event) => {
    if (isDragging) {
        deltaX = event.clientX - mouseX;
        deltaY = event.clientY - mouseY;

        app.stage.children.forEach(skeleton => {
            skeleton.x += deltaX;
            skeleton.y += deltaY;
        })

        mouseX = event.clientX;
        mouseY = event.clientY;
    }
});
app.view.addEventListener('pointerup', () => {
    isDragging = false;
});
app.view.addEventListener('pointerout', () => {
    isDragging = false;
});

app.view.addEventListener('wheel', (event) => {
    event.preventDefault();
    const noEmpty = app.stage.children.length > 0
    const originalScale = noEmpty ? app.stage.children[0].scale.x : +(zoomInput.value / 100);
    const scaleFactor = event.deltaY > 0 ? 0.95 : 1.05; // scale by wheel direction
    const minScale = 0.1, maxScale = 5;
    const newScale = Math.min(Math.max(originalScale * scaleFactor, minScale), maxScale)

    if (noEmpty) {
        app.stage.children.forEach(skeleton => {
            skeleton.scale.x = skeleton.scale.y = newScale
            skeleton.x -= (event.offsetX - skeleton.x) * (skeleton.scale.x / originalScale - 1);
            skeleton.y -= (event.offsetY - skeleton.y) * (skeleton.scale.y / originalScale - 1);
        })
    }

    zoomInput.value = +newScale.toFixed(2) * 100
    getById('zoom-show').innerText = zoomInput.value + '%'
});

// Context menu
scene.addEventListener('contextmenu', (ev) => {
    ev.preventDefault()
    preload.showContextMenu(ev)
})

preload.onCopyImage(() => {
    app.view.toBlob(blob => {
        navigator.clipboard.write([new ClipboardItem({'image/png': blob})])
    })
})

// Export options from export window
preload.onReceiveExportOptions(exportAnimation)

// Maximize / restore window chrome
preload.onMaximize(() => {
    getById('maximize-icon').innerText = '❐'
})

preload.onUnMaximize(() => {
    getById('maximize-icon').innerText = '▢'
})

preload.onExportComplete(() => {
    app.stage.children.forEach(a => a.autoUpdate = true)
})

preload.onExportWindowClosed(() => {
    isExporting = false
})

preload.onDebug(console.log)