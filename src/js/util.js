// Utility helpers
const getById = (id) => {
    return document.getElementById(id)
}

const createTag = (e) => {
    return document.createElement(e)
}

const isSpineSkeletonPath = (p) => /\.(json|skel)$/i.test(p)

const isSpineAssetPath = (p) => /\.(json|skel|atlas|webp|png|jpe?g)$/i.test(p)

const pathFromLoaderUrl = (urlOrKey) => {
    let path = urlOrKey.split('?')[0]
    try {
        const idx = path.indexOf('://')
        if (idx >= 0) path = path.slice(path.indexOf('/', idx + 3) + 1)
        path = decodeURIComponent(path)
    } catch (_) { /* keep path */ }
    return path.replace(/\\/g, '/').toLowerCase()
}

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

const getFileUrl = async (filePath) => {
    const port = await preload.port()
    const norm = filePath.replaceAll('\\', '/')
    // Encode each path segment but keep "/" so URLs look like /C%3A/Users/.../file.json.
    // If the whole path were one encoded blob (%2F for slashes), pixi-spine's baseUrl logic
    // (lastIndexOf("/") on the URL) breaks and textures load from the wrong folder → blank mesh.
    const parts = norm.split('/')
    const encoded = parts.map((seg) => (seg === '' ? '' : encodeURIComponent(seg))).join('/')
    const pathname = encoded.startsWith('/') ? encoded : `/${encoded}`
    return `http://localhost:${port}${pathname}`
}

const getUrlsByPaths = async (paths) => {
    let filePromises = paths.map(async p => await getFileUrl(p));
    return await Promise.all(filePromises)
}

