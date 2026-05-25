import { rGetCartWithCreation, rGetCartItems, rAddToCart, rRemoveFromCart } from '../repositories/cartRepository'

function mapCartItemsImages(items) {
    if (!items) return items;
    return items.map(item => {

        
        if (!item.product) return item;
        let main = null;
        if (item.product.product_images && item.product.product_images.length > 0) {
            const primary = item.product.product_images.find(img => img.is_primary);
            if (primary && primary.image_url) main = primary.image_url;
            else if (item.product.product_images[0]?.image_url) main = item.product.product_images[0].image_url;
        } else if (item.product.image_url) {
            main = item.product.image_url;
        }
        item.product.image_url = main;
        item.product.main_image = main;
        return item;
    });
}

export async function sGetCart(profileId) {
    try {
        const cart = await rGetCartWithCreation(profileId)
        const items = await rGetCartItems(cart.id)
        return { cart, items: mapCartItemsImages(items) }
    } catch (error) {
        throw error
    }
}

export async function sAddToCart(profileId, productId) {
    try {
        // Ensure cart exists
        const cart = await rGetCartWithCreation(profileId)
        await rAddToCart(cart.id, productId)
        // Return updated cart items
        const items = await rGetCartItems(cart.id)
        return mapCartItemsImages(items)
    } catch (error) {
        throw error
    }
}

export async function sRemoveFromCart(itemId) {
    try {
        await rRemoveFromCart(itemId)
    } catch (error) {
        throw error
    }
}
