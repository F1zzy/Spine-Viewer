// Utility helpers
const getById = (id) => {
    return document.getElementById(id)
}

const createTag = (e) => {
    return document.createElement(e)
}

const copyTextToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text)
        return true
    } catch (e) {
        const input = createTag('textarea')
        input.value = text
        input.setAttribute('readonly', '')
        input.style.position = 'fixed'
        input.style.left = '-9999px'
        document.body.appendChild(input)
        input.select()
        const ok = document.execCommand('copy')
        input.remove()
        return ok
    }
}

const COPY_NAME_ICON = '<svg class="copy-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><rect x="5.5" y="1.5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="1.5" y="5.5" width="9" height="9" rx="1.5" fill="currentColor" fill-opacity="0.12" stroke="currentColor" stroke-width="1.4"/></svg><svg class="copied-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'

const createCopyNameButton = (text, itemLabel = 'name') => {
    const copyBtn = createTag('button')
    const title = `Copy ${itemLabel}`
    copyBtn.type = 'button'
    copyBtn.classList.add('copy-list-name')
    copyBtn.title = title
    copyBtn.setAttribute('aria-label', `Copy ${text}`)
    copyBtn.innerHTML = COPY_NAME_ICON
    const preventToggle = (ev) => {
        ev.preventDefault()
        ev.stopPropagation()
    }
    copyBtn.addEventListener('mousedown', preventToggle)
    copyBtn.addEventListener('click', async (ev) => {
        preventToggle(ev)
        const ok = await copyTextToClipboard(text)
        if (!ok) return
        copyBtn.classList.add('copied')
        copyBtn.title = 'Copied'
        window.setTimeout(() => {
            copyBtn.classList.remove('copied')
            copyBtn.title = title
        }, 1200)
    })
    return copyBtn
}

const createListNameWithCopy = (name, itemLabel = 'name') => {
    const nameWrap = createTag('span')
    const nameText = createTag('span')
    nameWrap.classList.add('list-name-wrap')
    nameText.classList.add('list-name')
    nameText.innerText = name
    nameWrap.append(nameText)
    nameWrap.append(createCopyNameButton(name, itemLabel))
    return nameWrap
}

const isSpineSkeletonPath = (p) => /\.(json|skel)$/i.test(p)

const isSpineAssetPath = (p) => /\.(json|skel|atlas|webp|png|jpe?g)$/i.test(p)



const isSpineSkeletonResourceKey = (key) => {
    const p = pathFromLoaderUrl(key)
    return p.endsWith('.json') || p.endsWith('.skel')
}

const spineLoadRank = (url) => {
    const p = pathFromLoaderUrl(url)
    if (p.endsWith('.json') || p.endsWith('.skel')) return 0
    if (p.endsWith('.atlas')) return 1
    return 2
}

const sortSpineLoadUrls = (urls) => [...urls].sort((a, b) => spineLoadRank(a) - spineLoadRank(b))

const pathFromLoaderUrl = (urlOrKey) => {
    // Standardize slashes and remove the file:// protocol if present for internal lookups
    let path = urlOrKey.replace('file://', '');
    return path.replace(/\\/g, '/').toLowerCase();
}

const getFileUrl = async (filePath) => {
    // On Mac, a filePath looks like /Users/name/folder/file.json
    // We just need to ensure it's a valid file URL
    let norm = filePath.replaceAll('\\', '/');

    // Ensure it starts with exactly one leading slash for the protocol
    if (!norm.startsWith('/')) norm = '/' + norm;

    // Use the native file protocol
    return `file://${norm}`;
}

const getUrlsByPaths = async (paths) => {
    let filePromises = paths.map(async p => await getFileUrl(p));
    return await Promise.all(filePromises)
}

const getSlotSetupAlpha = (slot) => {
    const setupColor = slot.data.setupPose?.color ?? slot.data.color
    return setupColor?.a ?? 1
}

const getSlotColor = (slot) => slot.pose?.color ?? slot.color

const setSlotAlpha = (slot, alpha) => {
    const color = getSlotColor(slot)
    if (color) color.a = alpha
}

const getAnimationTrackEntry = (state, trackIndex) => {
    if (!state) return null
    if (typeof state.getTrack === 'function') return state.getTrack(trackIndex)
    if (typeof state.getCurrent === 'function') return state.getCurrent(trackIndex)
    return state.tracks?.[trackIndex] ?? null
}

const getStageSpines = () => app.stage.children.filter(child => child?.state && typeof child.update === 'function')

const forEachSpine = (callback) => getStageSpines().forEach(callback)

const getSkeletonData = (spineInstance) => spineInstance?.skeleton?.data ?? spineInstance?.skeletonData ?? null

const setSkeletonSkin = (skeleton, skinName) => {
    if (!skeleton?.data?.skins?.some(s => s.name === skinName)) return false
    if (typeof skeleton.setSkin === 'function') {
        skeleton.setSkin(skinName)
    } else {
        skeleton.setSkinByName(skinName)
    }
    if (typeof skeleton.setupPoseSlots === 'function') {
        skeleton.setupPoseSlots()
    } else if (typeof skeleton.setSlotsToSetupPose === 'function') {
        skeleton.setSlotsToSetupPose()
    }
    return true
}

const setTrackTime = (state, trackIndex, time) => {
    const entry = getAnimationTrackEntry(state, trackIndex)
    if (entry) entry.trackTime = time
}

const formatSpineLoadError = (error) => {
    const message = error?.message || String(error)
    if (/region not found in atlas/i.test(message)) {
        const match = message.match(/Region not found in atlas: ([^\s(]+)/i)
        const region = match?.[1] || 'unknown'
        return `Atlas is missing region "${region}". The export files don't fully match — Spine Viewer tried to patch the atlas automatically.`
    }
    if (/region not set/i.test(message)) {
        return 'Atlas regions do not match the skeleton JSON. Spine Viewer could not fully repair this export.'
    }
    if (/not found|404|failed to fetch/i.test(message)) {
        return 'Could not load one of the spine files. Drop the .json/.skel file — the viewer will pull in .atlas and textures from the same folder.'
    }
    return `Spine load failed: ${message}`
}

const showSpineLoadWarnings = (warnings) => {
    if (!Array.isArray(warnings) || warnings.length === 0) return
    const lines = warnings.map((warning) => {
        const patched = warning.addedRegions?.length
            ? `patched ${warning.addedRegions.join(', ')}`
            : ''
        const unresolved = warning.unresolvedRegions?.length
            ? `could not repair ${warning.unresolvedRegions.join(', ')}`
            : ''
        return [warning.skeleton, patched, unresolved].filter(Boolean).join(': ')
    })
    console.warn('Spine atlas repair:', lines.join('\n'))
}

const prepareSpineFilePaths = async (filePaths) => {
    const result = await preload.expandSpineAssetPaths(filePaths)
    const expanded = Array.isArray(result) ? result : result.paths
    showSpineLoadWarnings(result?.warnings)
    window.spineLoadWarnings = result?.warnings || []
    return [...new Set(expanded)].filter(isSpineAssetPath)
}
