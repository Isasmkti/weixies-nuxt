import { rGetWishlists, rAddWishlist, rRemoveWishlist } from '../repositories/wishlistRepository'

function mapWishlistImages(items) {
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

export async function sGetWishlists(profileId) {
    try {
        const items = await rGetWishlists(profileId)
        return mapWishlistImages(items)
    } catch (error) {
        throw error
    }
}

export async function sToggleWishlist(profileId, productId, isWishlisted) {
    try {
        if (isWishlisted) {
            await rRemoveWishlist(profileId, productId)
            return false // not wishlisted anymore
        } else {
            await rAddWishlist(profileId, productId)
            return true // wishlisted
        }
    } catch (error) {
        throw error
    }
}
