// Spine control helpers
const setZoom = (scale) => {
    app.stage.children.forEach(a => {
        a.scale.x = a.scale.y = scale
    })
}

const resetZoom = () => {
    setZoom(1)
    zoomInput.value = 100
    getById('zoom-show').innerText = '100%'
}

const setSpeed = (speed) => {
    app.stage.children.forEach(a => {
        a.state.timeScale = speed
    })
}

const resetSpeed = () => {
    setSpeed(1)
    speedInput.value = 1
    getById('speed-show').innerText = '1.00x'
}


const setMix = (mix) => {
    app.stage.children.forEach(a => {
        a.state.data.defaultMix = mix
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
    app.stage.children.forEach(a => {
        if (a.skeleton.data.skins.some(s => s.name === skin)) {
            a.skeleton.setSkinByName(skin)
            a.skeleton.setSlotsToSetupPose()
        }
    })
}

const resetPosition = () => {
    app.stage.children.forEach(a => a.position.set(scene.clientWidth / 2, scene.clientHeight / 2))
}

const playAnimation = (track, animation, loop, timeScaleOverride) => {
    app.stage.children.forEach(a => {
        if (timeScaleOverride !== undefined) {
            a.state.timeScale = timeScaleOverride
        } else {
            a.state.timeScale = timelinePaused ? 0 : +speedInput.value
        }
        a.state.setAnimation(track, animation, loop)
    })
}

const clearAnimation = (trackIndex) => {
    app.stage.children.forEach(a => a.state.setEmptyAnimation(trackIndex))
}

const getAnimationDuration = (name) => {
    const animation = availableAnimations.find(a => a.name === name)
    return animation ? +animation.duration : 0
}

const getTimelineState = () => {
    const trackIndex = track.current
    const animationName = track[trackIndex]
    if (!animationName || app.stage.children.length === 0) return null

    const spineInstance = app.stage.children[0]
    if (!spineInstance?.state) return null

    const entry = getAnimationTrackEntry(spineInstance.state, trackIndex)
    if (!entry?.animation) return null

    const duration = entry.animation.duration
    const time = duration > 0 ? entry.trackTime % duration : entry.trackTime
    return {time, duration}
}

const updateTimelineDisplay = (time, duration) => {
    getById('timeline-show').innerText = `${time.toFixed(2)} / ${duration.toFixed(2)}s`
}

const initTimeline = (duration) => {
    currentAnimationDuration = duration
    timelinePaused = false
    timelineScrubbing = false
    const timelineBar = getById('timeline-bar')
    const timelineInput = getById('timeline')
    timelineBar.style.display = 'flex'
    timelineInput.disabled = false
    timelineInput.max = Math.max(Math.round(duration * 1000), 1)
    timelineInput.value = 0
    getById('timeline-play').innerText = '⏸'
    updateTimelineDisplay(0, duration)
    setSpeed(+speedInput.value)
}

const hideTimeline = () => {
    getById('timeline-bar').style.display = 'none'
    getById('timeline').disabled = true
    currentAnimationDuration = 0
    timelinePaused = false
    timelineScrubbing = false
}

const seekAnimation = (time) => {
    const trackIndex = track.current
    app.stage.children.forEach(skeleton => {
        const entry = getAnimationTrackEntry(skeleton.state, trackIndex)
        if (entry) entry.trackTime = time
    })
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
    // app.stage.children.forEach(a => a.skeleton.setSlotsToSetupPose())
    slots.forEach(sd => {
        const alpha = getSlotSetupAlpha(sd.slot)
        setSlotAlpha(sd.slot, alpha)
        sd.inputTag.value = (alpha * 100).toFixed()
        sd.valueTag.innerText = alpha.toFixed(2)
    })
}