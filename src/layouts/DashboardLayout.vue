<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  Tag, 
  LogOut,
  Clock,
  Banknote
} from 'lucide-vue-next';

const router = useRouter();
const authStore = useAuthStore();

const isCollapsed = computed(() => true);

const navigation = computed(() => {
  if (authStore.isAdmin) {
    return [
      { name: 'Tableau de bord', href: '/', icon: LayoutDashboard },
      { name: 'Caisse', href: '/pos', icon: ShoppingCart },
      { name: 'Dettes', href: '/debts', icon: Banknote },
      { name: 'Produits', href: '/products', icon: Package },
      { name: 'Vendeurs', href: '/sellers', icon: Users },
      { name: 'Réductions', href: '/discounts', icon: Tag },
      { name: 'Historique des ventes', href: '/history', icon: Clock },
    ];
  } else {
    return [
      { name: 'Caisse', href: '/pos', icon: ShoppingCart },
      { name: 'Dettes', href: '/debts', icon: Banknote },
      { name: 'Historique', href: '/history', icon: Clock },
    ];
  }
});

const handleLogout = () => {
  authStore.logout();
  router.push('/login');
};
</script>

<template>
  <div class="flex h-screen bg-bg-base overflow-hidden">
    <!-- Sidebar -->
    <aside 
      class="bg-gray-900 text-white flex flex-col w-20 transition-all duration-300 ease-in-out shrink-0"
    >
      <div class="p-4 flex items-center justify-center">
        <div class="w-12 h-12 bg-white rounded-xl shadow flex items-center justify-center p-1">
          <img src="https://www.ccib38.fr/wp-content/uploads/2025/05/cropped-logoccib38-3-1.png" alt="CCIB38" class="max-w-full max-h-full object-contain" />
        </div>
      </div>

      <nav class="flex-1 mt-4 px-3 space-y-2">
        <router-link 
          v-for="item in navigation" 
          :key="item.name"
          :to="item.href"
          :title="item.name"
          class="flex items-center justify-center p-4 rounded-xl transition-colors group"
          :class="[
            $route.path === item.href 
              ? 'bg-primary-600 text-white' 
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          ]"
        >
          <component :is="item.icon" class="w-6 h-6 shrink-0" />
        </router-link>
      </nav>

      <div class="p-4 border-t border-gray-800">
        <button 
          @click="handleLogout"
          title="Déconnexion"
          class="flex items-center justify-center w-full p-4 rounded-xl text-gray-400 hover:bg-red-900/20 hover:text-red-400 transition-colors"
        >
          <LogOut class="w-6 h-6" />
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto p-0">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
@reference "@/index.css";

.router-link-active {
  @apply bg-primary-600 text-white shadow-lg shadow-primary-600/20;
}
</style>
