// Utility helpers
const getById = (id) => {
    return document.getElementById(id)
}

const createTag = (e) => {
    return document.createElement(e)
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
