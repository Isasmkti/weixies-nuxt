import * as categoriesRepository from '../repositories/categoriesRepository'

export async function sAll() {
    try {
        return await categoriesRepository.rAll()
    } catch (error) {
        throw error
    }
}

export async function sGetById(id) {
    try {
        return await categoriesRepository.rGetById(id)
    } catch (error) {
        throw error
    }
}

export async function sBySlug(slug) {
    try {
        return await categoriesRepository.rGetBySlug(slug)
    } catch (error) {
        throw error
    }
}
