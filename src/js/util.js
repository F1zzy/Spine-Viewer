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

const getSlotAttachment = (slot) => {
    return slot?.appliedPose?.attachment
        ?? (typeof slot?.getAttachment === 'function' ? slot.getAttachment() : null)
        ?? slot?.attachment
        ?? null
}

const skinHasSlotAttachments = (skin, slotIndex) => {
    if (!skin || slotIndex < 0) return false
    if (typeof skin.getAttachmentsForSlot === 'function') {
        const entries = []
        skin.getAttachmentsForSlot(slotIndex, entries)
        if (entries.length > 0) return true
    }
    const byIndex = skin.attachments?.[slotIndex]
    return !!(byIndex && Object.keys(byIndex).length)
}

const isSlotUsed = (slot, skeleton) => {
    if (!slot) return false
    if (slot.data?.visible === false) return false
    if (getSlotAttachment(slot)) return true
    const slotIndex = slot.data?.index ?? skeleton?.slots?.indexOf?.(slot) ?? -1
    const skins = [skeleton?.skin, skeleton?.data?.defaultSkin].filter((skin, index, list) => skin && list.indexOf(skin) === index)
    if (skins.some(skin => skinHasSlotAttachments(skin, slotIndex))) return true
    return !!slot.data?.attachmentName
}

const getDrawOrderSlots = (skeleton) => {
    const drawOrder = skeleton?.drawOrder
    if (Array.isArray(drawOrder?.appliedPose)) return drawOrder.appliedPose
    if (Array.isArray(drawOrder?.pose)) return drawOrder.pose
    if (Array.isArray(drawOrder)) return drawOrder
    if (Array.isArray(skeleton?.slots)) return skeleton.slots
    return []
}

const isRegionAttachment = (attachment) => typeof attachment?.getOffsets === 'function'

const isMeshAttachment = (attachment) => Number(attachment?.worldVerticesLength) > 0 && attachment?.triangles

const computeAttachmentVertices = (spineInstance, slot, attachment) => {
    try {
        if (isRegionAttachment(attachment)) {
            const vertices = new Float32Array(8)
            const pose = slot.appliedPose || slot
            attachment.computeWorldVertices(slot, attachment.getOffsets(pose), vertices, 0, 2)
            return {vertices, triangles: [0, 1, 2, 0, 2, 3], hullLength: 8}
        }
        if (isMeshAttachment(attachment) || Number(attachment?.worldVerticesLength) > 0) {
            const count = attachment.worldVerticesLength
            const vertices = new Float32Array(count)
            attachment.computeWorldVertices(spineInstance.skeleton, slot, 0, count, vertices, 0, 2)
            return {vertices, triangles: attachment.triangles || null, hullLength: attachment.hullLength || 0}
        }
    } catch (e) {
        const cached = spineInstance?._getCachedData?.(slot, attachment)
        if (cached?.vertices && cached.vertices.length >= 6) {
            const clipped = cached.clipped && cached.clippedData?.vertices?.length >= 6
            return {
                vertices: clipped ? cached.clippedData.vertices : cached.vertices,
                triangles: clipped ? cached.clippedData.indices : (cached.indices || attachment.triangles || null),
                hullLength: attachment.hullLength || 0
            }
        }
        return null
    }
    return null
}

const pointInPolygon = (x, y, vertices) => {
    let inside = false
    const count = Math.floor(vertices.length / 2)
    for (let i = 0, j = count - 1; i < count; j = i++) {
        const xi = vertices[i * 2]
        const yi = vertices[i * 2 + 1]
        const xj = vertices[j * 2]
        const yj = vertices[j * 2 + 1]
        const denom = yj - yi
        if (denom !== 0 && (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / denom + xi) {
            inside = !inside
        }
    }
    return inside
}

const pointInTriangle = (px, py, ax, ay, bx, by, cx, cy) => {
    const v0x = cx - ax
    const v0y = cy - ay
    const v1x = bx - ax
    const v1y = by - ay
    const v2x = px - ax
    const v2y = py - ay
    const dot00 = v0x * v0x + v0y * v0y
    const dot01 = v0x * v1x + v0y * v1y
    const dot02 = v0x * v2x + v0y * v2y
    const dot11 = v1x * v1x + v1y * v1y
    const dot12 = v1x * v2x + v1y * v2y
    const denom = dot00 * dot11 - dot01 * dot01
    if (denom === 0) return false
    const u = (dot11 * dot02 - dot01 * dot12) / denom
    const v = (dot00 * dot12 - dot01 * dot02) / denom
    return u >= 0 && v >= 0 && u + v <= 1
}

const attachmentContainsPoint = (geometry, x, y) => {
    if (!geometry?.vertices) return false
    const {vertices, triangles} = geometry
    if (triangles && triangles.length >= 3) {
        for (let i = 0; i < triangles.length; i += 3) {
            const a = triangles[i] * 2
            const b = triangles[i + 1] * 2
            const c = triangles[i + 2] * 2
            if (pointInTriangle(x, y, vertices[a], vertices[a + 1], vertices[b], vertices[b + 1], vertices[c], vertices[c + 1])) {
                return true
            }
        }
        return false
    }
    return pointInPolygon(x, y, vertices)
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
