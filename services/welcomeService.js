import { rAll } from '../repositories/welcomeRepository'

export async function sAll() {
    try {
        const data = await rAll()
        //console.log(data)
        return data
    } catch (error) {
        console.error('Error occurred while fetching welcome data:', error)
    }

}