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
