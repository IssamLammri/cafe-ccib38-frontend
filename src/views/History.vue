<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { 
  Search, 
  Filter, 
  Calendar,
  CreditCard,
  Clock,
  User,
  ShoppingBag,
  ChevronRight,
  Eye,
  Loader2,
  Trash2,
  ArrowUp,
  ArrowDown
} from 'lucide-vue-next';
import api from '@/api/api';

interface OrderItem {
  id?: number | string;
  quantity: number;
  unitPriceCents: number;
  product?: {
    name: string;
  } | string;
}

interface Order {
  '@id'?: string;
  id: number | string;
  createdAt: string;
  paymentMethod: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  items: OrderItem[];
  agent?: {
    '@id'?: string;
    id?: number | string;
    email: string;
    username?: string;
    firstName?: string;
    lastName?: string;
  } | string;
  discountBeneficiary?: {
    '@id'?: string;
    id?: number | string;
    title?: string;
    fullName?: string;
  } | string;
  debtAccount?: {
    '@id'?: string;
    id?: number | string;
    fullName: string;
  } | string;
}

const orders = ref<Order[]>([]);
const usersMap = ref<Record<string, { email: string, username?: string, firstName?: string, lastName?: string }>>({});
const loading = ref(true);
const error = ref('');
const searchQuery = ref('');

const filterPaymentMethod = ref('');
const filterAgent = ref('');
const filterDateFrom = ref('');
const filterDateTo = ref('');
const showFilters = ref(false);

const selectedOrder = ref<Order | null>(null);
const isModalOpen = ref(false);
const router = useRouter();

const tableContainer = ref<HTMLElement | null>(null);

const scrollUp = () => {
  if (tableContainer.value) {
    tableContainer.value.scrollBy({ top: -400, behavior: 'smooth' });
  }
};

const scrollDown = () => {
  if (tableContainer.value) {
    tableContainer.value.scrollBy({ top: 400, behavior: 'smooth' });
  }
};

const editOrderInPOS = () => {
  if (!selectedOrder.value) return;
  const itemsToSave = selectedOrder.value.items.map(item => {
    let productId = item.product;
    if (typeof item.product === 'object' && item.product !== null) {
      productId = item.product['@id'] || `/api/products/${item.product.id}`;
    }
    return {
      productId,
      quantity: item.quantity
    };
  });
  localStorage.setItem('edit_order_items', JSON.stringify(itemsToSave));
  router.push('/pos');
};

const getAgentDisplay = (agent: any) => {
  if (!agent) return 'Utilisateur';

  const formatName = (u: any) => {
    if (u.firstName || u.lastName) {
      return `${u.firstName || ''} ${u.lastName || ''}`.trim();
    }
    return u.username || u.email || 'Utilisateur';
  };

  if (typeof agent === 'string') {
    const user = usersMap.value[agent];
    if (user) {
      return formatName(user);
    }
    return 'Utilisateur';
  }
  return formatName(agent);
};

const availableAgents = computed(() => {
  const agents = new Map();
  // Filter out the keys that are not URIs to avoid duplicates if needed, or simply extract unique users
  Object.values(usersMap.value).forEach(u => {
    const uri = (u as any)['@id'] || `/api/users/${(u as any).id}`;
    if (uri) {
      agents.set(uri, u);
    }
  });
  return Array.from(agents.entries()).map(([id, user]) => ({
    id,
    name: getAgentDisplay(user)
  }));
});

const filteredOrders = computed(() => {
  let result = orders.value;
  
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(o => 
      String(o.id).includes(q) || 
      (typeof o.discountBeneficiary !== 'string' && o.discountBeneficiary?.fullName?.toLowerCase().includes(q)) ||
      (typeof o.debtAccount !== 'string' && o.debtAccount?.fullName?.toLowerCase().includes(q))
    );
  }

  if (filterPaymentMethod.value) {
    result = result.filter(o => o.paymentMethod === filterPaymentMethod.value);
  }

  if (filterAgent.value) {
    if (filterAgent.value === 'none') {
      result = result.filter(o => !o.agent);
    } else {
      result = result.filter(o => {
        if (!o.agent) return false;
        const agentId = typeof o.agent === 'string' ? o.agent : (o.agent as any)['@id'] || `/api/users/${(o.agent as any).id}`;
        return agentId === filterAgent.value;
      });
    }
  }

  if (filterDateFrom.value) {
    const from = new Date(filterDateFrom.value);
    from.setHours(0, 0, 0, 0);
    result = result.filter(o => new Date(o.createdAt) >= from);
  }

  if (filterDateTo.value) {
    const to = new Date(filterDateTo.value);
    to.setHours(23, 59, 59, 999);
    result = result.filter(o => new Date(o.createdAt) <= to);
  }
  
  return result;
});

const openOrderDetails = (order: Order) => {
  selectedOrder.value = order;
  isModalOpen.value = true;
};

const closeOrderDetails = () => {
  isModalOpen.value = false;
  selectedOrder.value = null;
  showDeleteConfirm.value = false;
};

const deletingOrder = ref(false);
const showDeleteConfirm = ref(false);
const deleteError = ref('');

const deleteOrder = async () => {
  if (!selectedOrder.value) return;

  deletingOrder.value = true;
  deleteError.value = '';

  try {
    const selected = selectedOrder.value;

    const endpoint = selected['@id']
      ? selected['@id'].replace('/api', '')
      : `/orders/${selected.id}`;

    console.log('DELETE endpoint:', endpoint);

    await api.delete(endpoint);

    orders.value = orders.value.filter(
      o => String(o.id) !== String(selected.id)
    );

    closeOrderDetails();
  } catch (err: any) {
    console.error('Erreur suppression commande:', err);

    deleteError.value =
      'Erreur: ' +
      (
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        'Impossible de supprimer la commande.'
      );
  } finally {
    deletingOrder.value = false;
  }
};

const fetchOrders = async () => {
  loading.value = true;
  error.value = '';
  try {
    const [ordersRes, usersRes] = await Promise.all([
      api.get('/orders?pagination=false'),
      api.get('/users?pagination=false').catch(() => ({ data: [] }))
    ]);
    const fetchedOrders = ordersRes.data['hydra:member'] || ordersRes.data['member'] || ordersRes.data || [];
    orders.value = fetchedOrders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    const users = usersRes.data['hydra:member'] || usersRes.data['member'] || usersRes.data || [];
    users.forEach((u: any) => {
      const iri = u['@id'] || `/api/users/${u.id}`;
      usersMap.value[iri] = u;
      usersMap.value[u.id] = u;
    });
  } catch (err) {
    console.error(err);
    error.value = 'Erreur lors du chargement des commandes.';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchOrders();
});

const formatDate = (dateString: string) => {
  if (!dateString) return 'Date inconnue';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const getPaymentMethodDisplay = (method: string) => {
  switch (method) {
    case 'cash': return { label: 'Espèces', bg: 'bg-green-100', text: 'text-green-700' };
    case 'later': return { label: 'Dette (Plus tard)', bg: 'bg-purple-100', text: 'text-purple-700' };
    case 'card': return { label: 'Carte Bancaire', bg: 'bg-blue-100', text: 'text-blue-700' };
    default: return { label: method, bg: 'bg-gray-100', text: 'text-gray-700' };
  }
};
</script>

<template>
  <div class="space-y-8 h-full flex flex-col">
    <div class="px-8 pt-8">
      <h2 class="text-3xl font-black text-gray-900 mb-6">Historique des ventes</h2>
      
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="relative flex-1 max-w-lg group">
          <Search class="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 group-focus-within:text-primary-600 transition-colors" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Rechercher par numéro de commande, client..." 
            class="w-full h-14 bg-white border-2 border-gray-100 rounded-2xl pl-16 pr-6 text-lg focus:border-primary-600 outline-none shadow-sm transition-all"
          >
        </div>
        
        <div class="flex gap-4">
          <button @click="showFilters = !showFilters" class="flex items-center gap-2 px-6 h-14 bg-white border-2 border-gray-100 rounded-2xl font-bold text-gray-600 hover:border-primary-200 transition-all outline-none" :class="{ 'border-primary-600 text-primary-600 bg-primary-50': showFilters }">
            <Filter class="w-5 h-5" />
            Filtres & Période
          </button>
        </div>
      </div>
      
      <!-- Filters Panel -->
      <div v-show="showFilters" class="mt-4 p-6 bg-white border border-gray-100 rounded-3xl shadow-sm flex flex-col md:flex-row gap-6">
        <div class="flex-1 space-y-2">
          <label class="text-sm font-bold text-gray-500">Moyen de paiement</label>
          <select v-model="filterPaymentMethod" class="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-primary-600 transition-colors cursor-pointer appearance-none font-medium text-gray-700">
            <option value="">Tous les paiements</option>
            <option value="cash">Espèces</option>
            <option value="card">Carte bancaire</option>
            <option value="later">Dette (Plus tard)</option>
          </select>
        </div>
        
        <div class="flex-1 space-y-2">
          <label class="text-sm font-bold text-gray-500">Agent</label>
          <select v-model="filterAgent" class="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-primary-600 transition-colors cursor-pointer appearance-none font-medium text-gray-700">
            <option value="">Tous les agents</option>
            <option value="none">Utilisateur (sans agent assigné)</option>
            <option v-for="agent in availableAgents" :key="agent.id" :value="agent.id">
              {{ agent.name }}
            </option>
          </select>
        </div>

        <div class="flex-1 space-y-2">
          <label class="text-sm font-bold text-gray-500">Date de début</label>
          <input type="date" v-model="filterDateFrom" class="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-primary-600 transition-colors text-gray-700 font-medium">
        </div>

        <div class="flex-1 space-y-2">
          <label class="text-sm font-bold text-gray-500">Date de fin</label>
          <input type="date" v-model="filterDateTo" class="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-primary-600 transition-colors text-gray-700 font-medium">
        </div>
        
        <div class="flex items-end">
          <button @click="filterPaymentMethod='';filterAgent='';filterDateFrom='';filterDateTo=''" class="h-12 px-6 rounded-xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors whitespace-nowrap">
            Réinitialiser
          </button>
        </div>
      </div>
    </div>

    <!-- Orders Table -->
    <div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex-1 mx-8 mb-8 flex flex-col">
      <div v-if="loading" class="flex-1 flex justify-center items-center">
        <Loader2 class="w-12 h-12 text-primary-600 animate-spin" />
      </div>
      <div v-else-if="error" class="flex-1 flex justify-center items-center text-red-500 font-bold text-xl">
        {{ error }}
      </div>
      <div v-else class="flex-1 flex overflow-hidden relative group">
        <!-- Floating tactile scroll buttons -->
        <div class="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-50">
          <button @click="scrollUp" class="w-16 h-16 bg-white/90 backdrop-blur border border-gray-200 shadow-lg rounded-full flex items-center justify-center text-gray-700 active:bg-primary-50 active:text-primary-600 active:scale-95 transition-all">
            <ArrowUp class="w-8 h-8 pointer-events-none" />
          </button>
          <button @click="scrollDown" class="w-16 h-16 bg-white/90 backdrop-blur border border-gray-200 shadow-lg rounded-full flex items-center justify-center text-gray-700 active:bg-primary-50 active:text-primary-600 active:scale-95 transition-all">
            <ArrowDown class="w-8 h-8 pointer-events-none" />
          </button>
        </div>

        <div ref="tableContainer" class="overflow-auto flex-1 scrollbar-hide">
          <table class="w-full text-left border-collapse min-w-max">
          <thead>
            <tr class="bg-gray-50/50 border-b border-gray-100 sticky top-0 backdrop-blur-md z-10">
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider">Commande</th>
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider">Date & Heure</th>
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider">Paiement</th>
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider">Client / Agent</th>
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider">Total</th>
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            <tr v-for="order in filteredOrders" :key="order.id" class="hover:bg-gray-50/30 transition-colors group">
              <td class="px-8 py-6">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
                    <ShoppingBag class="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <p class="font-bold text-gray-800 text-lg">CMD-{{ String(order.id).padStart(5, '0') }}</p>
                    <p class="text-gray-500 font-medium">{{ order.items?.length || 0 }} article(s)</p>
                  </div>
                </div>
              </td>
              <td class="px-8 py-6">
                <div class="flex items-center gap-2 text-gray-700 font-medium">
                  <Clock class="w-4 h-4 text-gray-400" />
                  {{ formatDate(order.createdAt) }}
                </div>
              </td>
              <td class="px-8 py-6">
                <span class="px-4 py-1.5 rounded-full font-bold text-sm flex items-center w-max gap-2" :class="[getPaymentMethodDisplay(order.paymentMethod).bg, getPaymentMethodDisplay(order.paymentMethod).text]">
                  <CreditCard class="w-4 h-4" />
                  {{ getPaymentMethodDisplay(order.paymentMethod).label }}
                </span>
              </td>
              <td class="px-8 py-6">
                <div v-if="order.paymentMethod === 'later' && order.debtAccount" class="flex flex-col">
                  <span class="font-bold text-gray-800">
                    {{ typeof order.debtAccount === 'string' ? "Client (Dette)" : order.debtAccount.fullName }}
                  </span>
                  <span class="text-xs text-gray-500 font-medium bg-purple-50 text-purple-700 px-2 py-0.5 rounded w-max mt-1">Dette</span>
                  <span class="text-sm text-gray-500 font-medium mt-1">Agent : {{ getAgentDisplay(order.agent) }}</span>
                </div>
                <div v-else-if="order.discountBeneficiary" class="flex flex-col">
                  <span class="font-bold text-gray-800">
                    {{ typeof order.discountBeneficiary === 'string' ? "Client avec remise" : (order.discountBeneficiary.title || order.discountBeneficiary.fullName || "Client avec remise") }}
                  </span>
                  <span class="text-xs text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded w-max mt-1 border border-amber-200">Remise</span>
                  <span class="text-sm text-gray-500 font-medium mt-1">Agent : {{ getAgentDisplay(order.agent) }}</span>
                </div>
                <div v-else class="flex flex-col">
                  <span class="text-sm text-gray-500 font-medium pb-1">Agent : {{ getAgentDisplay(order.agent) }}</span>
                </div>
              </td>
              <td class="px-8 py-6 font-black text-gray-900 text-xl">
                {{ (order.totalCents / 100).toFixed(2) }} €
              </td>
              <td class="px-8 py-6 text-right">
                <button @click="openOrderDetails(order)" class="inline-flex items-center justify-center p-3 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all" title="Voir les détails">
                  <Eye class="w-6 h-6" />
                </button>
              </td>
            </tr>
            <tr v-if="filteredOrders.length === 0">
              <td colspan="6" class="px-8 py-12 text-center text-gray-500 font-medium text-lg">
                Aucune vente trouvée.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </div>
      
      <div v-if="!loading && !error" class="p-6 border-t border-gray-100 flex items-center justify-between bg-white text-gray-500 font-medium">
        <span>Total: {{ filteredOrders.length }} commandes</span>
      </div>
    </div>

    <!-- Order Details Modal -->
    <div v-if="isModalOpen && selectedOrder" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-full">
        <div class="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-2xl font-bold text-gray-900">Détails de la commande <span class="text-primary-600">CMD-{{ String(selectedOrder.id).padStart(5, '0') }}</span></h3>
          <button @click="closeOrderDetails" class="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
            <span class="sr-only">Fermer</span>
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div class="p-8 overflow-y-auto space-y-6">
          <div class="grid grid-cols-2 gap-6 bg-gray-50 p-6 rounded-2xl border border-gray-100">
            <div>
              <p class="text-sm font-bold text-gray-500 mb-1">Date & Heure</p>
              <p class="font-medium text-gray-900">{{ formatDate(selectedOrder.createdAt) }}</p>
            </div>
            <div>
              <p class="text-sm font-bold text-gray-500 mb-1">Paiement</p>
              <span class="px-3 py-1 rounded-full font-bold text-xs inline-block" :class="[getPaymentMethodDisplay(selectedOrder.paymentMethod).bg, getPaymentMethodDisplay(selectedOrder.paymentMethod).text]">
                {{ getPaymentMethodDisplay(selectedOrder.paymentMethod).label }}
              </span>
            </div>
            <div v-if="selectedOrder.agent">
              <p class="text-sm font-bold text-gray-500 mb-1">Agent / Serveur</p>
              <p class="font-medium text-gray-900">{{ getAgentDisplay(selectedOrder.agent) }}</p>
            </div>
          </div>
          
          <div>
            <h4 class="font-bold text-gray-900 text-lg mb-4">Articles ({{ selectedOrder.items?.length || 0 }})</h4>
            <div class="border border-gray-100 rounded-2xl overflow-hidden">
              <table class="w-full text-left">
                <thead class="bg-gray-50">
                  <tr class="border-b border-gray-100">
                    <th class="px-6 py-4 font-bold text-gray-600 text-sm">Produit</th>
                    <th class="px-6 py-4 font-bold text-gray-600 text-sm text-center">Qté</th>
                    <th class="px-6 py-4 font-bold text-gray-600 text-sm text-right">Prix Unitaire</th>
                    <th class="px-6 py-4 font-bold text-gray-600 text-sm text-right">Total</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                  <tr v-for="(item, idx) in selectedOrder.items" :key="idx">
                    <td class="px-6 py-4 font-bold text-gray-800">
                      {{ typeof item.product === 'string' ? 'Produit inconnu' : item.product?.name || 'Produit' }}
                    </td>
                    <td class="px-6 py-4 text-center font-medium text-gray-600">x{{ item.quantity }}</td>
                    <td class="px-6 py-4 text-right font-medium text-gray-600">{{ (item.unitPriceCents / 100).toFixed(2) }} €</td>
                    <td class="px-6 py-4 text-right font-bold text-gray-900">{{ ((item.quantity * item.unitPriceCents) / 100).toFixed(2) }} €</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div class="flex justify-end pt-4 border-t border-gray-100">
            <div class="w-64 space-y-3">
              <div class="flex justify-between text-gray-600 font-medium">
                <span>Sous-total</span>
                <span>{{ ((selectedOrder.subtotalCents || selectedOrder.totalCents) / 100).toFixed(2) }} €</span>
              </div>
              <div class="flex justify-between text-gray-600 font-medium" v-if="selectedOrder.discountCents > 0">
                <span>Remise</span>
                <span>- {{ (selectedOrder.discountCents / 100).toFixed(2) }} €</span>
              </div>
              <div class="flex justify-between text-xl font-black text-primary-600 pt-3 border-t border-gray-200">
                <span>Total</span>
                <span>{{ (selectedOrder.totalCents / 100).toFixed(2) }} €</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="p-6 bg-gray-50 border-t border-gray-100 flex flex-col gap-4">
          <div v-if="deleteError" class="p-4 bg-red-50 text-red-600 rounded-xl font-medium text-sm">
            {{ deleteError }}
          </div>
          <div v-if="showDeleteConfirm" class="flex flex-col sm:flex-row justify-between items-center gap-4 bg-red-50 p-4 rounded-xl border border-red-100">
            <span class="text-red-700 font-bold text-sm">Êtes-vous sûr ? Cette action est irréversible.</span>
            <div class="flex items-center gap-2 w-full sm:w-auto">
              <button @click="showDeleteConfirm = false" :disabled="deletingOrder" class="flex-1 sm:flex-none px-4 py-2 bg-white text-gray-700 border border-gray-300 font-bold rounded-lg hover:bg-gray-50 transition-colors">
                Annuler
              </button>
              <button @click="deleteOrder" :disabled="deletingOrder" class="flex-1 sm:flex-none px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
                <Loader2 v-if="deletingOrder" class="w-4 h-4 animate-spin" />
                <span>Oui, supprimer</span>
              </button>
            </div>
          </div>
          <div v-else class="flex justify-between items-center w-full">
            <button @click="showDeleteConfirm = true" class="px-6 py-3 bg-red-50 text-red-600 border border-red-200 font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center gap-2" title="Supprimer la commande">
              <Trash2 class="w-5 h-5" />
              <span class="max-sm:hidden">Supprimer</span>
            </button>
            <div class="flex items-center gap-3">
              <button @click="editOrderInPOS" class="px-6 py-3 bg-primary-50 text-primary-600 border border-primary-200 font-bold rounded-xl hover:bg-primary-100 transition-colors flex items-center gap-2" title="Modifier en re-générant une nouvelle vente en caisse">
                <ShoppingBag class="w-5 h-5" />
                <span>Reprendre en caisse</span>
              </button>
              <button @click="closeOrderDetails" class="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-colors">
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}
</style>
