<template>
  <footer class="bg-surface border-t border-bg-alt text-text transition-colors duration-300">
    <div class="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8">
      <div class="xl:grid xl:grid-cols-3 xl:gap-8">

        <!-- Brand Section -->
        <div class="space-y-8 xl:col-span-1">
          <span class="text-2xl font-bold text-text-main tracking-tight">Weixies</span>
          <p class="text-text-muted text-base leading-relaxed max-w-xs">
            Making web development simple, fast, and accessible for everyone. Build your dream project today.
          </p>
          <div class="flex space-x-6">
            <!-- Social Placeholders -->
            <a href="#" class="text-text-muted hover:text-primary transition">
              <span class="sr-only">Facebook</span>
              <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fill-rule="evenodd"
                  d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
                  clip-rule="evenodd" />
              </svg>
            </a>
            <a href="#" class="text-text-muted hover:text-primary transition">
              <span class="sr-only">GitHub</span>
              <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fill-rule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clip-rule="evenodd" />
              </svg>
            </a>
          </div>
        </div>

        <!-- Menus Grid -->
        <div class="mt-12 grid grid-cols-2 gap-8 xl:mt-0 xl:col-span-2">
          <div class="md:grid md:grid-cols-2 md:gap-8">
            <!-- Products -->
            <div>
              <h3 class="text-sm font-bold text-text-main tracking-wider uppercase">Products</h3>
              <ul role="list" class="mt-4 space-y-2">
                <li><a href="#" class="text-base text-text-muted hover:text-primary transition">Website Templates</a>
                </li>
                <li><a href="#" class="text-base text-text-muted hover:text-primary transition">Landing Pages</a></li>
                <li><a href="#" class="text-base text-text-muted hover:text-primary transition">UI Kits</a></li>
                <li><a href="#" class="text-base text-text-muted hover:text-primary transition">Admin Dashboards</a>
                </li>
              </ul>
            </div>

            <!-- Support -->
            <div class="mt-12 md:mt-0">
              <h3 class="text-sm font-bold text-text-main tracking-wider uppercase">Help & Support</h3>
              <ul role="list" class="mt-4 space-y-2">
                <li><a href="#" class="text-base text-text-muted hover:text-primary transition">Pricing</a></li>
                <li><a href="#" class="text-base text-text-muted hover:text-primary transition">Documentation</a></li>
                <li><a href="#" class="text-base text-text-muted hover:text-primary transition">Tutorials</a></li>
                <li><a href="#" class="text-base text-text-muted hover:text-primary transition">Contact Support</a></li>
              </ul>
            </div>
          </div>

          <div class="md:grid md:grid-cols-2 md:gap-8">

            <!-- Company -->
            <div>
              <h3 class="text-sm font-bold text-text-main tracking-wider uppercase">Company</h3>
              <ul role="list" class="mt-4 space-y-2">
                <li><a href="#" class="text-base text-text-muted hover:text-primary transition">About Us</a></li>
                <li><a href="#" class="text-base text-text-muted hover:text-primary transition">Blog</a></li>
                <li><a href="#" class="text-base text-text-muted hover:text-primary transition">Careers</a></li>
                <li><a href="#" class="text-base text-text-muted hover:text-primary transition">Affiliates</a></li>
              </ul>
            </div>

            <!-- Legal -->
            <div class="mt-12 md:mt-0">
              <h3 class="text-sm font-bold text-text-main tracking-wider uppercase">Legal</h3>
              <ul role="list" class="mt-4 space-y-2">
                <li><a href="#" class="text-base text-text-muted hover:text-primary transition">License</a></li>
                <li><a href="#" class="text-base text-text-muted hover:text-primary transition">Refund Policy</a></li>
                <li><a href="#" class="text-base text-text-muted hover:text-primary transition">Privacy Policy</a></li>
                <li><a href="#" class="text-base text-text-muted hover:text-primary transition">Terms & Conditions</a>
                </li>
              </ul>
            </div>
          </div>
        </div>

      </div>

      <!-- Bottom Bar -->
      <div class="mt-12 border-t border-bg-alt pt-8 flex flex-col md:flex-row justify-between items-center">
        <p class="text-base text-text-muted text-center md:text-left">
          &copy; 2026 Weixies Webshop. All rights reserved.
        </p>
        <p class="text-sm text-text-muted mt-4 md:mt-0">
          Designed with <span class="text-red-500">❤</span> for the community.
        </p>
      </div>
    </div>
  </footer>
</template>

<script>
export default {
  name: 'Footer',
};
</script>
