<script setup>
import { reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
    List,
    ArrowLeft,
    BadgeCheck,
    ChevronDown,
    FileText,
    House,
    Images,
    LayoutDashboard,
    LogOut,
    MessageSquareWarning,
    PanelLeftClose,
    PanelLeftOpen,
    PanelsTopLeft,
    ShoppingBag,
    Users,
    Wallet,
    LibraryBig,
    FileBox,
    Folder
} from 'lucide-vue-next'
import { useAuth } from '../../composables/useAuth'

const router = useRouter()
const route = useRoute()
const { profile, signOut } = useAuth()
const isCollapsed = ref(false)
const openGroups = reactive({
    content: ['/admin/home-carousel', '/admin/signup-banner', '/admin/welcome', '/admin/public-pages'].some(path => route.path.startsWith(path)),
    products: route.path.startsWith('/admin/products')
})

const handleLogout = async () => {
    try {
        await signOut()
    } finally {
        await router.replace('/welcome')
    }
}

const menuItems = [
    {
        name: 'Dashboard',
        to: '/admin',
        exact: true,
        icon: LayoutDashboard
    },
    {
        name: 'Content',
        to: '/admin/home-carousel',
        group: 'content',
        icon: Folder,
        children: [
            {
                name: 'Home Carousel',
                to: '/admin/home-carousel',
                icon: Images
            },
            {
                name: 'Sign-up Banner',
                to: '/admin/signup-banner',
                icon: PanelsTopLeft
            },
            {
                name: 'Welcome Page',
                to: '/admin/welcome',
                icon: House
            },
            {
                name: 'Public Pages',
                to: '/admin/public-pages',
                icon: FileText
            }
        ]
    },
    {
        name: 'Products',
        to: '/admin/products',
        group: 'products',
        icon: FileBox,
        children: [
            {
                name: 'All Products',
                to: '/admin/products',
                exact: true,
                icon: List
            },
            {
                name: 'Product Review',
                to: '/admin/products/review',
                icon: BadgeCheck
            }
        ]
    },
    {
        name: 'Sellers',
        to: '/admin/sellers',
        icon: Users
    },
    {
        name: 'Chat Reports',
        to: '/admin/chat-reports',
        icon: MessageSquareWarning
    },
    {
        name: 'Activity Logs',
        to: '/admin/logs',
        icon: List
    },
    {
        name: 'Orders & Refunds',
        to: '/admin/orders',
        icon: ShoppingBag
    },
    {
        name: 'AI Knowledge',
        to: '/admin/ai/knowledge',
        icon: LibraryBig
    },
    {
        name: 'Payouts',
        to: '/admin/payouts',
        icon: Wallet
    },
    {
        name: 'Back to Shop',
        to: '/',
        icon: ArrowLeft
    }
]

const routeIsActive = (item) => item.exact
    ? route.path === item.to
    : route.path === item.to || route.path.startsWith(`${item.to}/`)

const groupIsActive = item => item.children?.some(child => routeIsActive(child))
const groupIsOpen = item => Boolean(openGroups[item.group])
const toggleGroup = item => {
    openGroups[item.group] = !openGroups[item.group]
}

watch(() => route.path, (path) => {
    for (const item of menuItems) {
        if (item.children?.some(child => path === child.to || path.startsWith(`${child.to}/`))) {
            openGroups[item.group] = true
        }
    }
})
</script>

<template>
    <aside
        :class="['relative z-20 hidden h-screen border-r border-border bg-surface transition-all duration-300 md:flex md:flex-col', isCollapsed ? 'w-20' : 'w-72']">

        <!-- Header / Branding -->
        <div class="p-6 flex items-center gap-4">
            <div class="w-10 h-10 shrink-0 flex items-center justify-center">
                <img src="../../assets/weixies-logo.svg" alt="Weixies Logo" class="h-full w-full object-contain" />
            </div>
            <transition name="fade">
                <span v-if="!isCollapsed"
                    class="font-poppins font-bold text-2xl text-text-main tracking-tight">Admin</span>
            </transition>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 px-4 space-y-2 overflow-y-auto container no-scrollbar">
            <template v-for="item in menuItems" :key="item.name">
                <div v-if="item.children" class="space-y-1">
                    <NuxtLink v-if="isCollapsed" :to="item.to" :title="item.name"
                        :class="['group flex items-center justify-center rounded-ui-md px-4 py-3 transition-colors duration-200 hover:bg-bg hover:text-primary', groupIsActive(item) ? 'bg-primary/10 font-medium text-primary' : 'text-text-muted']">
                        <component :is="item.icon" class="h-5 w-5 shrink-0" aria-hidden="true" />
                    </NuxtLink>

                    <template v-else>
                        <button type="button" :aria-expanded="groupIsOpen(item)" :aria-controls="`admin-${item.group}-menu`"
                            :class="['group flex w-full items-center gap-3 rounded-ui-md px-4 py-3 transition-colors duration-200 hover:bg-bg hover:text-primary', groupIsActive(item) ? 'bg-primary/10 font-medium text-primary' : 'text-text-muted']"
                            @click="toggleGroup(item)">
                            <component :is="item.icon" class="h-5 w-5 shrink-0" aria-hidden="true" />
                            <span class="min-w-0 flex-1 text-left">{{ item.name }}</span>
                            <ChevronDown class="h-4 w-4 shrink-0 transition-transform duration-200" :class="groupIsOpen(item) ? 'rotate-180' : ''" aria-hidden="true" />
                        </button>

                        <Transition name="submenu">
                            <div v-if="groupIsOpen(item)" :id="`admin-${item.group}-menu`" class="ml-5 space-y-1 border-l border-border pl-3">
                                <NuxtLink v-for="child in item.children" :key="child.name" :to="child.to"
                                    :class="['group flex items-center gap-2.5 rounded-ui-sm px-3 py-2.5 text-sm transition-colors duration-200 hover:bg-bg hover:text-primary', routeIsActive(child) ? 'bg-primary/10 font-semibold text-primary' : 'text-text-muted']">
                                    <component :is="child.icon" class="h-4 w-4 shrink-0" aria-hidden="true" />
                                    <span>{{ child.name }}</span>
                                </NuxtLink>
                            </div>
                        </Transition>
                    </template>
                </div>

                <NuxtLink v-else :to="item.to" :title="isCollapsed ? item.name : undefined"
                    :class="['group flex items-center gap-3 rounded-ui-md px-4 py-3 transition-colors duration-200 hover:bg-bg hover:text-primary', isCollapsed ? 'justify-center' : '', routeIsActive(item) ? 'bg-primary/10 font-medium text-primary' : 'text-text-muted']">
                    <component :is="item.icon" class="h-5 w-5 shrink-0" aria-hidden="true" />
                    <transition name="fade">
                        <span v-if="!isCollapsed">{{ item.name }}</span>
                    </transition>
                </NuxtLink>
            </template>
        </nav>

        <!-- Footer / Logout -->
        <div class="p-4  flex flex-col gap-2 relative">
            <!-- User Profile Section -->
            <div v-if="profile"
                :class="['flex items-center gap-3 rounded-ui-md p-3 transition-all duration-300', isCollapsed ? 'justify-center p-2' : 'border border-border bg-bg']">
                <!-- Profile Image -->
                <div class="relative shrink-0">
                    <div
                        class="w-10 h-10 rounded-full bg-bg-alt flex items-center justify-center overflow-hidden">
                        <img v-if="profile.profile_img" :src="profile.profile_img" alt="Profile"
                            class="w-full h-full object-cover">
                        <span v-else class="text-text-muted font-bold text-sm">{{
                            profile.full_name?.charAt(0).toUpperCase() || 'A' }}</span>
                    </div>
                    <div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full ">
                    </div>
                </div>

                <!-- Text Info -->
                <transition name="fade">
                    <div v-if="!isCollapsed" class="overflow-hidden min-w-0 flex-1">
                        <h3 class="text-sm font-semibold text-text-main truncate">{{ profile.full_name || 'Admin' }}
                        </h3>
                        <p class="text-xs text-text-muted truncate">{{ profile.role || 'Administrator' }}</p>
                    </div>
                </transition>
            </div>

            <!-- Sign Out -->
            <button @click="handleLogout"
                :class="['group flex items-center gap-3 rounded-ui-sm px-3 py-2 text-danger transition-colors duration-200 hover:bg-danger/10', isCollapsed ? 'justify-center' : 'w-full']">
                <LogOut class="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
                <transition name="fade">
                    <span v-if="!isCollapsed" class="font-medium">Sign Out</span>
                </transition>
            </button>

            <!-- Collapse Toggle -->
            <button @click="isCollapsed = !isCollapsed"
                class="absolute -right-3 top-0 transform -translate-y-1/2 bg-surface shadow-md rounded-full p-1.5 text-text-muted hover:text-primary transition-colors cursor-pointer z-50">
                <PanelLeftClose v-if="!isCollapsed" class="h-4 w-4" aria-hidden="true" />
                <PanelLeftOpen v-else class="h-4 w-4" aria-hidden="true" />
            </button>
        </div>
    </aside>
</template>

<style scoped>
/* Smooth transition for text appearing/disappearing */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.submenu-enter-active,
.submenu-leave-active {
    overflow: hidden;
    transition: opacity 0.2s ease, transform 0.2s ease, max-height 0.25s ease;
    max-height: 180px;
}

.submenu-enter-from,
.submenu-leave-to {
    max-height: 0;
    opacity: 0;
    transform: translateY(-4px);
}

.no-scrollbar {
    scrollbar-width: none;
    /* Firefox */
    -ms-overflow-style: none;
    /* IE & Edge lama */
}

.no-scrollbar::-webkit-scrollbar {
    display: none;
    /* Chrome, Safari */
}

/* Ensure whitespace doesn't wrap awkwardly during transition */
span,
h3,
p {
    white-space: nowrap;
}
</style>
