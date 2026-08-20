import { supabase } from '../utils/supabase'
import { rAll, rUpsertSection, rUploadAsset } from '../repositories/welcomeRepository'
import {
    WELCOME_SECTION_KEYS,
    mergeWelcomeContent,
} from '../utils/welcomeContent'

export async function sAll() {
    return mergeWelcomeContent(await rAll())
}

export async function sSaveAll(content) {
    const normalized = mergeWelcomeContent(content)
    const savedRows = await Promise.all(
        WELCOME_SECTION_KEYS.map((section) => rUpsertSection(section, normalized[section]))
    )

    return mergeWelcomeContent(
        Object.fromEntries(savedRows.map((row) => [row.section, row.content]))
    )
}

const MAX_ASSET_SIZE = 5 * 1024 * 1024
const ALLOWED_ASSET_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export async function sUploadWelcomeAsset(file, folder = 'general') {
    if (!file) throw new Error('Choose an image first.')
    if (!ALLOWED_ASSET_TYPES.has(file.type)) {
        throw new Error('Image must be JPG, PNG, WEBP, or GIF.')
    }
    if (file.size > MAX_ASSET_SIZE) {
        throw new Error('Image must be 5 MB or smaller.')
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) throw new Error('You must be signed in as an admin.')

    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
    const safeFolder = String(folder || 'general').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40)
    const safeName = String(file.name || 'image')
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'image'
    const filePath = `${session.user.id}/${safeFolder}/${Date.now()}-${safeName}.${extension}`

    return rUploadAsset(filePath, file)
}
