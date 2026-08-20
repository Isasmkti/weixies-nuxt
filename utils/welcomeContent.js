export const WELCOME_SECTION_KEYS = [
  'navbar',
  'hero',
  'features',
  'about',
  'testimonials',
  'cta',
  'footer',
]

export const WELCOME_CONTENT_DEFAULTS = {
  navbar: {
    brandName: 'Weixies',
    loginLabel: 'Login',
    signupLabel: 'Sign Up',
    dashboardLabel: 'Dashboard',
  },
  hero: {
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1920&q=80',
    title: 'Welcome to Weixies',
    description: 'Discover premium products crafted for the modern lifestyle. Shop smart, live better.',
    primaryLabel: 'Browse Catalog',
    primaryUrl: '/products',
    secondaryLabel: 'Learn More',
    secondaryUrl: '#about',
  },
  features: {
    eyebrow: 'Why Choose Us',
    title: 'A better way to shop online',
    description: 'We prioritize your experience with top-tier services and premium quality products.',
    items: [
      { id: 'global-shipping', name: 'Global Shipping', description: 'Fast and reliable delivery to over 120 countries worldwide.', icon: 'globe' },
      { id: 'best-prices', name: 'Best Prices', description: 'Competitive pricing with regular sales and exclusive member deals.', icon: 'scale' },
      { id: 'lightning-fast', name: 'Lightning Fast', description: 'Optimized checkout in seconds. Your time is precious.', icon: 'lightning' },
      { id: 'secure-safe', name: 'Secure & Safe', description: 'End-to-end encrypted payments and buyer protection on every order.', icon: 'shield' },
    ],
  },
  about: {
    title: 'About Us',
    subtitle: 'We exist to make great products accessible to everyone.',
    description: 'Weixies was founded with one simple belief — everyone deserves access to quality products at fair prices. We partner with the best brands and artisans to bring you a curated selection of goods that make life a little better every day.',
  },
  testimonials: {
    eyebrow: 'Testimonials',
    title: 'Trusted by industry leading',
    highlight: 'innovators',
    description: 'Join 1,000+ companies worldwide who rely on Weixies for high-performance web products.',
    items: [
      {
        id: 'sarah-johnson',
        quote: 'Weixies transformed how our team shops for office supplies. Fast delivery, great prices, and the quality is consistently outstanding.',
        image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80',
        author: 'Sarah Johnson',
        role: 'Operations Manager, TechCorp',
      },
      {
        id: 'michael-chen',
        quote: "I've been a loyal customer for two years. The curated selection and seamless checkout experience keeps me coming back.",
        image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80',
        author: 'Michael Chen',
        role: 'Founder, Design Studio',
      },
      {
        id: 'emma-williams',
        quote: 'The product quality exceeded my expectations. Customer support was responsive and resolved my query within minutes.',
        image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&q=80',
        author: 'Emma Williams',
        role: 'Creative Director, Brand Co.',
      },
    ],
  },
  cta: {
    eyebrow: 'Call to action',
    title: 'Start shopping today.',
    subtitle: 'No subscriptions. Just great products.',
    primaryLabel: 'Browse Catalog',
    primaryUrl: '/products',
    secondaryLabel: 'Learn More',
    secondaryUrl: '#about',
  },
  footer: {
    brandName: 'Weixies',
    description: 'Making web development simple, fast, and accessible for everyone. Build your dream project today.',
    facebookUrl: '#',
    githubUrl: '#',
    columns: [
      { title: 'Products', links: [{ label: 'Website Templates', url: '/products' }, { label: 'Landing Pages', url: '/products' }, { label: 'UI Kits', url: '/products' }, { label: 'Admin Dashboards', url: '/products' }] },
      { title: 'Help & Support', links: [{ label: 'Pricing', url: '#' }, { label: 'Documentation', url: '#' }, { label: 'Tutorials', url: '#' }, { label: 'Contact Support', url: '#' }] },
      { title: 'Company', links: [{ label: 'About Us', url: '#about' }, { label: 'Blog', url: '#' }, { label: 'Careers', url: '#' }, { label: 'Affiliates', url: '#' }] },
      { title: 'Legal', links: [{ label: 'License', url: '#' }, { label: 'Refund Policy', url: '#' }, { label: 'Privacy Policy', url: '#' }, { label: 'Terms & Conditions', url: '#' }] },
    ],
    copyright: '© 2026 Weixies Webshop. All rights reserved.',
    designedText: 'Designed with love for the community.',
  },
}

export function cloneWelcomeContent(value = WELCOME_CONTENT_DEFAULTS) {
  return JSON.parse(JSON.stringify(value))
}

export function mergeWelcomeContent(content = {}) {
  const defaults = cloneWelcomeContent()

  for (const section of WELCOME_SECTION_KEYS) {
    if (content[section] && typeof content[section] === 'object' && !Array.isArray(content[section])) {
      defaults[section] = { ...defaults[section], ...content[section] }
    }
  }

  return defaults
}
