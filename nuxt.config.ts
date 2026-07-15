import { resolveMidtransIsProduction } from './utils/midtrans';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@pinia/nuxt',
    '@nuxtjs/tailwindcss',
  ],

  css: [
    '~/assets/css/main.css',
    'sweetalert2/dist/sweetalert2.min.css',
  ],

  app: {
    head: {
      title: 'Weixies Webshop',
      meta: [
        { name: 'description', content: 'A simple ecommerce' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/weixies-logo.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap',
        },
      ],
      script: [
        {
          innerHTML: `(() => {
            try {
              const saved = localStorage.getItem('theme') || 'system'
              const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
              const dark = saved === 'dark' || (saved === 'system' && prefersDark)
              document.documentElement.classList.toggle('dark', dark)
              document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
            } catch (err) {
              console.error('Error occurred while setting theme:', err)
            }
          })()`,
        },
      ],
    },
    pageTransition: {
      name: 'page-slide',
      mode: 'out-in',
    },
  },

  tailwindcss: {
    configPath: '~/tailwind.config.js',
  },

  nitro: {
    routeRules: {
      '/**': {
        headers: {
          'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.sandbox.midtrans.com https://app.midtrans.com https://snap-assets.sandbox.midtrans.com https://api.sandbox.midtrans.com https://api.midtrans.com https://pay.google.com https://gwk.gopayapi.com/sdk/stable/gp-container.min.js https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; img-src 'self' data: blob: https://*.midtrans.com https://*.googleusercontent.com https://*.supabase.co https://*.pinimg.com; font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; connect-src 'self' https://api.sandbox.midtrans.com https://app.sandbox.midtrans.com https://api.midtrans.com https://app.midtrans.com https://*.midtrans.com https://*.supabase.co; frame-src 'self' https://app.sandbox.midtrans.com https://app.midtrans.com https://pay.google.com https://gwk.gopayapi.com; object-src 'self'"
        }
      }
    }
  },

  vite: {
    optimizeDeps: {
      include: [
        '@supabase/supabase-js',
        '@vueuse/motion',
        'vue3-apexcharts',
        'apexcharts',
      ]
    }
  },

  runtimeConfig: {
    midtransServerKey: process.env.MIDTRANS_SERVER_KEY,
    // Server-only: used for trusted database writes from Midtrans webhooks.
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    public: {
      midtransIsProduction: resolveMidtransIsProduction(process.env.MIDTRANS_IS_PRODUCTION),
      supabaseUrl: 'https://fvqvdcsbbklxmnqusrlb.supabase.co',
      supabaseAnonKey: 'sb_publishable_WCN1OssVUJja7c159tuslQ_ouBV5LGC',
      midtransClientKey: process.env.MIDTRANS_CLIENT_KEY,
    },
  },
})
