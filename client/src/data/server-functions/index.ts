import { getGlobalData } from './global'
import { getPageBySlug } from './page'
import { getArticleBySlug, getArticles, getBlogPageData } from './articles'
import { getProductBySlug, getProductPageData, getProducts } from './products'
import {
  getAuthServerFunction,
  getCurrentUserServerFunction,
  loginUserServerFunction,
  logoutUserServerFunction,
  registerUserServerFunction,
} from './auth'
import { getDraftMode } from './draft'

export const strapiApi = {
  global: {
    getGlobalData,
  },
  page: {
    getPageBySlug,
  },
  articles: {
    getArticles,
    getArticleBySlug,
    getBlogPageData,
  },
  products: {
    getProducts,
    getProductBySlug,
    getProductPageData,
  },
  auth: {
    registerUserServerFunction,
    loginUserServerFunction,
    logoutUserServerFunction,
    getCurrentUserServerFunction,
    getAuthServerFunction,
  },
  draft: {
    getDraftMode,
  },
}
