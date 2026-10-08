// Spine control helpers
const setZoom = (scale) => {
    forEachSpine(spine => {
        spine.scale.x = spine.scale.y = scale
    })
}

const resetZoom = () => {
    setZoom(1)
    zoomInput.value = 100
    getById('zoom-show').innerText = '100%'
}

const setSpeed = (speed) => {
    forEachSpine(spine => {
        spine.state.timeScale = speed
    })
}

const resetSpeed = () => {
    setSpeed(1)
    speedInput.value = 1
    getById('speed-show').innerText = '1.00x'
}


const setMix = (mix) => {
    forEachSpine(spine => {
        spine.state.data.defaultMix = mix
    })
}

const resetMix = () => {
    setMix(0)
    mixInput.value = 0
    getById('default-mix-show').innerText = '0.0s'
}

const mapAlphaModeToPixi = (mode) => {
    switch (Number(mode)) {
        case 0:
            return 'no-premultiply-alpha'
        case 2:
            return 'premultiplied-alpha'
        case 1:
        default:
            return 'premultiply-alpha-on-upload'
    }
}

const setAlphaMode = (mode) => {
    const pixiAlphaMode = mapAlphaModeToPixi(mode)
    const managedTextures = app.renderer?.texture?.managedTextures
    if (!managedTextures || typeof managedTextures.forEach !== 'function') return
    managedTextures.forEach(t => {
        const textureSource = t?.source || t
        if (!textureSource) return
        textureSource.alphaMode = pixiAlphaMode
        if (typeof textureSource.update === 'function') {
            textureSource.update()
        }
    })
}


const setSkin = (skin) => {
    forEachSpine(spine => setSkeletonSkin(spine.skeleton, skin))
}

const resetPosition = () => {
    forEachSpine(spine => spine.position.set(scene.clientWidth / 2, scene.clientHeight / 2))
}

const playAnimation = (track, animation, loop, timeScaleOverride) => {
    forEachSpine(spine => {
        if (timeScaleOverride !== undefined) {
            spine.state.timeScale = timeScaleOverride
        } else {
            spine.state.timeScale = timelinePaused ? 0 : +speedInput.value
        }
        spine.state.setAnimation(track, animation, loop)
    })
}

const clearAnimation = (trackIndex) => {
    forEachSpine(spine => spine.state.setEmptyAnimation(trackIndex))
}

const getAnimationDuration = (name) => {
    const animation = availableAnimations.find(a => a.name === name)
    return animation ? +animation.duration : 0
}

const getTimelineState = () => {
    const trackIndex = track.current
    const animationName = track[trackIndex]
    if (!animationName) return null

    const spineInstance = getStageSpines()[0]
    if (!spineInstance?.state) return null

    const entry = getAnimationTrackEntry(spineInstance.state, trackIndex)
    if (!entry?.animation) return null

    const duration = entry.animation.duration
    const time = duration > 0 ? entry.trackTime % duration : entry.trackTime
    const skeleton = spineInstance.skeleton
    return {
        time,
        duration,
        animationName: entry.animation.name || animationName,
        loopCount: duration > 0 ? Math.floor(entry.trackTime / duration) : 0,
        skin: skeleton?.skin?.name || skeleton?.data?.defaultSkin?.name || '',
        bones: skeleton?.bones?.length ?? 0,
        slots: skeleton?.slots?.length ?? 0,
    }
}

const TIMELINE_FPS = 30

const getFrameFromTime = (time, duration) => {
    const totalFrames = Math.max(Math.round(duration * TIMELINE_FPS), 1)
    if (duration <= 0) return {current: 0, total: 0}
    const currentFrame = Math.min(Math.floor(time * TIMELINE_FPS) + 1, totalFrames)
    return {current: currentFrame, total: totalFrames}
}

const updateSceneOverlay = (time, duration) => {
    const state = getTimelineState()
    const currentTime = time ?? state?.time ?? 0
    const currentDuration = duration ?? state?.duration ?? 0
    const {current, total} = getFrameFromTime(currentTime, currentDuration)
    const percent = currentDuration > 0 ? Math.min((currentTime / currentDuration) * 100, 100) : 0
    const fps = Math.round(app?.ticker?.FPS || 0)

    getById('frame-current').innerText = `${current}`
    getById('frame-total').innerText = `${total}`
    getById('overlay-animation').innerText = state?.animationName || '—'
    getById('overlay-time').innerText = `${currentTime.toFixed(2)} / ${currentDuration.toFixed(2)}s  ${percent.toFixed(0)}%`
    getById('overlay-speed').innerText = `${(+speedInput.value).toFixed(2)}x`
    getById('overlay-fps').innerText = fps > 0 ? `${fps}` : '—'
    getById('overlay-paused').classList.toggle('visible', timelinePaused)

    const metaParts = []
    if (state?.skin) metaParts.push(state.skin)
    if (state?.bones) metaParts.push(`${state.bones} bones`)
    if (state?.slots) metaParts.push(`${state.slots} slots`)
    if (state?.loopCount > 0) metaParts.push(`loop ${state.loopCount}`)
    getById('overlay-meta').innerText = metaParts.join(' · ') || '—'
}

const updateTimelineDisplay = (time, duration) => {
    getById('timeline-show').innerText = `${time.toFixed(2)} / ${duration.toFixed(2)}s`
    updateSceneOverlay(time, duration)
}

const initTimeline = (duration) => {
    currentAnimationDuration = duration
    timelinePaused = false
    timelineScrubbing = false
    const timelineBar = getById('timeline-bar')
    const timelineInput = getById('timeline')
    timelineBar.style.display = 'flex'
    getById('scene-overlay').style.display = 'block'
    timelineInput.disabled = false
    timelineInput.max = Math.max(Math.round(duration * 1000), 1)
    timelineInput.value = 0
    getById('timeline-play').innerText = '⏸'
    updateTimelineDisplay(0, duration)
    setSpeed(+speedInput.value)
}

const hideTimeline = () => {
    getById('timeline-bar').style.display = 'none'
    getById('scene-overlay').style.display = 'none'
    getById('timeline').disabled = true
    currentAnimationDuration = 0
    timelinePaused = false
    timelineScrubbing = false
}

const seekAnimation = (time) => {
    const trackIndex = track.current
    forEachSpine(spine => setTrackTime(spine.state, trackIndex, time))
}

const setTimelinePaused = (paused) => {
    timelinePaused = paused
    getById('timeline-play').innerText = paused ? '▶' : '⏸'
    setSpeed(paused ? 0 : +speedInput.value)
}

const toggleTimelinePlayback = () => {
    setTimelinePaused(!timelinePaused)
}

const pauseAnimation = () => {
    const speed = speedInput.value
    if (currentSpeed.toString() === speed) {
        setTimelinePaused(true)
        speedInput.value = 0
        getById('speed-show').innerText = '0.00x'
    } else {
        currentSpeed = +speed
        setTimelinePaused(false)
        speedInput.value = currentSpeed
        getById('speed-show').innerText = currentSpeed.toFixed(2) + 'x'
    }
}

const syncTimelineFromState = () => {
    if (timelineScrubbing || isExporting || currentAnimationDuration <= 0) return
    const state = getTimelineState()
    if (!state) return
    const timelineInput = getById('timeline')
    timelineInput.max = Math.max(Math.round(state.duration * 1000), 1)
    timelineInput.value = Math.round(state.time * 1000)
    updateTimelineDisplay(state.time, state.duration)
}

const resetSlots = () => {
    slots.forEach(sd => {
        const alpha = getSlotSetupAlpha(sd.slot)
        setSlotAlpha(sd.slot, alpha)
        sd.inputTag.value = (alpha * 100).toFixed()
        sd.valueTag.innerText = alpha.toFixed(2)
    })
}

const canvasPointFromEvent = (event) => {
    const rect = app.canvas.getBoundingClientRect()
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    }
}

const toSkeletonPoint = (spineInstance, canvasX, canvasY) => {
    const point = {x: canvasX, y: canvasY}
    if (typeof spineInstance.pixiWorldCoordinatesToSkeleton === 'function') {
        spineInstance.pixiWorldCoordinatesToSkeleton(point)
        return point
    }
    const local = spineInstance.toLocal?.(new PIXI.Point(canvasX, canvasY))
    if (local) return {x: local.x, y: local.y}
    const scaleX = spineInstance.scale.x || 1
    const scaleY = spineInstance.scale.y || 1
    return {
        x: (canvasX - spineInstance.x) / scaleX,
        y: (canvasY - spineInstance.y) / scaleY
    }
}

const ensureSlotHighlight = (spineInstance) => {
    if (spineInstance.slotHighlight && !spineInstance.slotHighlight.destroyed) {
        if (spineInstance.slotHighlight.parent !== spineInstance) {
            spineInstance.addChild(spineInstance.slotHighlight)
        }
        return spineInstance.slotHighlight
    }
    const graphics = new PIXI.Graphics()
    graphics.eventMode = 'none'
    spineInstance.slotHighlight = graphics
    spineInstance.addChild(graphics)
    return graphics
}

const clearSvgHighlight = () => {
    const svg = getById('slot-highlight-svg')
    const poly = getById('slot-highlight-poly')
    if (svg) svg.style.display = 'none'
    if (poly) poly.setAttribute('points', '')
}

const clearSlotInspect = () => {
    forEachSpine(spineInstance => {
        if (spineInstance.slotHighlight && !spineInstance.slotHighlight.destroyed) {
            spineInstance.slotHighlight.clear()
        }
    })
    clearSvgHighlight()
    const tooltip = getById('slot-tooltip')
    if (tooltip) tooltip.style.display = 'none'
    if (hoveredSlotListItem) {
        hoveredSlotListItem.classList.remove('slot-list-hover')
        hoveredSlotListItem = null
    }
    slotInspectShowing = false
    inspectedSlotName = ''
}

const copyVisibleSlotNames = async () => {
    const names = slots
        .filter(sd => sd.inputTag?.isConnected)
        .map(sd => sd.slot?.data?.name || sd.slot?.name)
        .filter(Boolean)
    if (names.length === 0) return
    const ok = await copyTextToClipboard(names.join('\n'))
    const button = getById('copy-slots')
    if (!ok || !button) return
    const original = button.innerText
    button.innerText = 'Copied'
    window.setTimeout(() => {
        button.innerText = original
    }, 1200)
}

const setSlotInspectEnabled = (enabled) => {
    slotInspectEnabled = enabled
    if (app.canvas) app.canvas.style.cursor = enabled ? 'crosshair' : ''
    if (!enabled) {
        slotInspectPointer = null
        clearSlotInspect()
    }
}

const hitTestSpineSlots = (spineInstance, x, y) => {
    const skeleton = spineInstance.skeleton
    if (!skeleton) return null
    const order = getDrawOrderSlots(skeleton)
    for (let i = order.length - 1; i >= 0; i--) {
        const slot = order[i]
        if (slot?.bone && slot.bone.active === false) continue
        const attachment = getSlotAttachment(slot)
        if (!attachment) continue
        const geometry = computeAttachmentVertices(spineInstance, slot, attachment)
        if (!geometry || !attachmentContainsPoint(geometry, x, y)) continue
        return {slot, attachment, geometry, index: skeleton.slots.indexOf(slot)}
    }
    return null
}

const findSlotAtPoint = (canvasX, canvasY) => {
    const spines = getStageSpines()
    for (let i = spines.length - 1; i >= 0; i--) {
        const spineInstance = spines[i]
        const point = toSkeletonPoint(spineInstance, canvasX, canvasY)
        const hit = hitTestSpineSlots(spineInstance, point.x, point.y)
        if (hit) return {spineInstance, ...hit}
    }
    return null
}

const drawSlotHighlight = (spineInstance, geometry) => {
    forEachSpine(other => {
        if (other !== spineInstance && other.slotHighlight && !other.slotHighlight.destroyed) {
            other.slotHighlight.clear()
        }
    })
    const layer = ensureSlotHighlight(spineInstance)
    layer.clear()
    if (!geometry?.vertices || geometry.vertices.length < 6) return
    const vertices = geometry.vertices
    const scale = Math.max(Math.abs(spineInstance.scale?.x) || 1, 0.001)
    const fill = {color: 0x5ad1ff, alpha: 0.22}
    const stroke = {color: 0x7ae0ff, width: 2 / scale}
    const {triangles, hullLength} = geometry
    if (triangles && triangles.length >= 3) {
        for (let i = 0; i < triangles.length; i += 3) {
            const a = triangles[i] * 2
            const b = triangles[i + 1] * 2
            const c = triangles[i + 2] * 2
            if (a + 1 >= vertices.length || b + 1 >= vertices.length || c + 1 >= vertices.length) continue
            layer.poly([vertices[a], vertices[a + 1], vertices[b], vertices[b + 1], vertices[c], vertices[c + 1]])
            layer.fill(fill)
        }
        const hullCount = hullLength > 0 ? (hullLength >> 1) * 2 : 0
        if (hullCount >= 6) {
            const hull = []
            for (let i = 0; i < hullCount && i < vertices.length; i++) hull.push(vertices[i])
            layer.poly(hull)
            layer.stroke(stroke)
        }
    } else {
        layer.poly(Array.from(vertices))
        layer.fill(fill)
        layer.stroke(stroke)
    }

    const canvasRect = app.canvas.getBoundingClientRect()
    const sceneRect = scene.getBoundingClientRect()
    const ox = canvasRect.left - sceneRect.left
    const oy = canvasRect.top - sceneRect.top
    const hullCount = hullLength > 0 ? Math.min((hullLength >> 1) * 2, vertices.length) : vertices.length
    const points = []
    for (let i = 0; i < hullCount; i += 2) {
        const point = {x: vertices[i], y: vertices[i + 1]}
        if (typeof spineInstance.skeletonToPixiWorldCoordinates === 'function') {
            spineInstance.skeletonToPixiWorldCoordinates(point)
        } else {
            point.x = spineInstance.x + vertices[i] * (spineInstance.scale.x || 1)
            point.y = spineInstance.y + vertices[i + 1] * (spineInstance.scale.y || 1)
        }
        points.push(`${point.x + ox},${point.y + oy}`)
    }
    const poly = getById('slot-highlight-poly')
    const svg = getById('slot-highlight-svg')
    if (poly && svg && points.length >= 3) {
        svg.setAttribute('width', `${scene.clientWidth}`)
        svg.setAttribute('height', `${scene.clientHeight}`)
        svg.style.display = 'block'
        poly.setAttribute('points', points.join(' '))
    }
}

const updateSlotTooltip = (hit, pointer) => {
    const tooltip = getById('slot-tooltip')
    if (!tooltip) return
    const slotName = hit.slot.data?.name || hit.slot.name || 'Unknown slot'
    const attachmentName = hit.attachment?.name || '—'
    const boneName = hit.slot.bone?.data?.name || '—'
    inspectedSlotName = slotName
    getById('slot-tooltip-name').innerText = slotName
    getById('slot-tooltip-index').innerText = hit.index >= 0 ? `${hit.index}` : '—'
    getById('slot-tooltip-attachment').innerText = attachmentName
    getById('slot-tooltip-bone').innerText = boneName
    tooltip.style.display = 'block'

    const canvasRect = app.canvas.getBoundingClientRect()
    const sceneRect = scene.getBoundingClientRect()
    const x = pointer.x + (canvasRect.left - sceneRect.left)
    const y = pointer.y + (canvasRect.top - sceneRect.top)
    const offset = 14
    const maxX = scene.clientWidth - tooltip.offsetWidth - 8
    const maxY = scene.clientHeight - tooltip.offsetHeight - 8
    tooltip.style.left = `${Math.max(8, Math.min(x + offset, maxX))}px`
    tooltip.style.top = `${Math.max(8, Math.min(y + offset, maxY))}px`
}

const highlightSlotListItem = (slot) => {
    if (hoveredSlotListItem) hoveredSlotListItem.classList.remove('slot-list-hover')
    const slotData = slots.find(sd => sd.slot === slot && sd.inputTag?.isConnected)
    hoveredSlotListItem = slotData?.inputTag?.closest('li') || null
    if (hoveredSlotListItem) hoveredSlotListItem.classList.add('slot-list-hover')
}

const syncSlotInspect = () => {
    if (!slotInspectEnabled || isExporting || !slotInspectPointer) {
        if (slotInspectShowing) clearSlotInspect()
        return
    }
    const hit = findSlotAtPoint(slotInspectPointer.x, slotInspectPointer.y)
    if (!hit) {
        if (slotInspectShowing) clearSlotInspect()
        return
    }
    drawSlotHighlight(hit.spineInstance, hit.geometry)
    updateSlotTooltip(hit, slotInspectPointer)
    highlightSlotListItem(hit.slot)
    slotInspectShowing = true
}
