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
        { name: 'description', content: 'A simple ecommerce' }
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
    public: {
      supabaseUrl: 'https://fvqvdcsbbklxmnqusrlb.supabase.co',
      supabaseAnonKey: 'sb_publishable_WCN1OssVUJja7c159tuslQ_ouBV5LGC',
    },
  },
})
