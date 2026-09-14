import {
  rAdminPublicPages,
  rCreateAdminPublicPage,
  rDeleteAdminPublicPage,
  rUpdateAdminPublicPage,
} from '../repositories/adminPublicPagesRepository'

export const getAdminPublicPages = () => rAdminPublicPages()
export const createAdminPublicPage = payload => rCreateAdminPublicPage(payload)
export const updateAdminPublicPage = (id, payload) => rUpdateAdminPublicPage(id, payload)
export const deleteAdminPublicPage = id => rDeleteAdminPublicPage(id)
