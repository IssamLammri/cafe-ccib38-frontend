<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { 
  Search, 
  CreditCard,
  Clock,
  ShoppingBag,
  Eye,
  Loader2,
  Banknote
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
  id: number | string;
  createdAt: string;
  paymentMethod: string;
  paid: boolean;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  items: OrderItem[];
  agent?: {
    email: string;
    username?: string;
    firstName?: string;
    lastName?: string;
  } | string;
  discountBeneficiary?: {
    title?: string;
    fullName?: string;
  } | string;
  debtAccount?: {
    fullName: string;
  } | string;
}

const orders = ref<Order[]>([]);
const usersMap = ref<Record<string, { email: string, username?: string, firstName?: string, lastName?: string }>>({});
const loading = ref(true);
const error = ref('');
const selectedDebtAccountFilter = ref('');

const selectedOrder = ref<Order | null>(null);
const isModalOpen = ref(false);
const submittingPayment = ref(false);

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

const uniqueDebtAccounts = computed(() => {
  const accountMap = new Map();
  orders.value.filter(o => o.paymentMethod === 'later' && o.paid === false).forEach(o => {
    if (o.debtAccount) {
      const id = typeof o.debtAccount === 'string' ? o.debtAccount : (o.debtAccount as any)['@id'] || `/api/customer_debt_accounts/${(o.debtAccount as any).id}`;
      const name = typeof o.debtAccount === 'string' ? "Client" : o.debtAccount.fullName;
      if (id && !accountMap.has(id)) {
        accountMap.set(id, { id, name });
      }
    }
  });
  return Array.from(accountMap.values());
});

const filteredOrders = computed(() => {
  let result = orders.value.filter(o => o.paymentMethod === 'later' && o.paid === false);
  
  if (selectedDebtAccountFilter.value) {
    result = result.filter(o => {
      if (!o.debtAccount) return false;
      const id = typeof o.debtAccount === 'string' ? o.debtAccount : (o.debtAccount as any)['@id'] || `/api/customer_debt_accounts/${(o.debtAccount as any).id}`;
      return id === selectedDebtAccountFilter.value;
    });
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
};

const markAsPaid = async (method: 'cash' | 'card') => {
  if (!selectedOrder.value) return;
  submittingPayment.value = true;
  try {
     const oldOrder = selectedOrder.value;
     const oldOrderId = (oldOrder as any)['@id']
       ? (oldOrder as any)['@id'].replace('/api', '')
       : `/orders/${oldOrder.id}`;

     const payload: any = {
       paymentMethod: method,
       paid: true,
       items: oldOrder.items.map((item: any) => ({
         product: typeof item.product === 'string' 
           ? item.product 
           : (item.product['@id'] || `/api/products/${item.product.id}`),
         quantity: item.quantity
       }))
     };
     
     if (oldOrder.discountBeneficiary) {
       payload.discountBeneficiary = typeof oldOrder.discountBeneficiary === 'string'
         ? oldOrder.discountBeneficiary
         : ((oldOrder.discountBeneficiary as any)['@id'] || `/api/discount_beneficiaries/${(oldOrder.discountBeneficiary as any).id}`);
     }
     
     if (oldOrder.debtAccount) {
       payload.debtAccount = typeof oldOrder.debtAccount === 'string'
         ? oldOrder.debtAccount
         : ((oldOrder.debtAccount as any)['@id'] || `/api/customer_debt_accounts/${(oldOrder.debtAccount as any).id}`);
     }
     
     if (oldOrder.agent) {
       payload.agent = typeof oldOrder.agent === 'string'
         ? oldOrder.agent
         : ((oldOrder.agent as any)['@id'] || `/api/users/${(oldOrder.agent as any).id}`);
     }

     // 1. Create the new paid order
     await api.post('/orders', payload);
     
     // 2. Delete the old unpaid order
     await api.delete(oldOrderId);
     
     // Remove from the local list
     orders.value = orders.value.filter(o => o.id !== selectedOrder.value?.id);
     
     closeOrderDetails();
  } catch(e) {
      console.error(e);
      alert("Erreur lors de l'enregistrement du paiement.");
  } finally {
      submittingPayment.value = false;
  }
}

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
    error.value = 'Erreur lors du chargement des dettes.';
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
    case 'later': return { label: 'Dette (Non payée)', bg: 'bg-red-100', text: 'text-red-700' };
    case 'card': return { label: 'Carte Bancaire', bg: 'bg-blue-100', text: 'text-blue-700' };
    default: return { label: method, bg: 'bg-gray-100', text: 'text-gray-700' };
  }
};
</script>

<template>
  <div class="space-y-8 h-full flex flex-col">
    <div class="px-8 pt-8">
      <h2 class="text-3xl font-black text-gray-900 mb-6">Dettes / Commandes non payées</h2>
      
      <div class="flex items-center gap-3 overflow-x-auto pb-4 scrollbar-hide">
        <button 
          @click="selectedDebtAccountFilter = ''" 
          class="px-6 h-12 rounded-full font-bold whitespace-nowrap transition-colors"
          :class="selectedDebtAccountFilter === '' ? 'bg-primary-600 text-white' : 'bg-white border-2 border-gray-100 text-gray-600 hover:border-primary-200'"
        >
          Tous les clients
        </button>
        <button 
          v-for="client in uniqueDebtAccounts" 
          :key="client.id"
          @click="selectedDebtAccountFilter = client.id"
          class="px-6 h-12 rounded-full font-bold whitespace-nowrap transition-colors"
          :class="selectedDebtAccountFilter === client.id ? 'bg-primary-600 text-white' : 'bg-white border-2 border-gray-100 text-gray-600 hover:border-primary-200'"
        >
          {{ client.name }}
        </button>
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
      <div v-else class="overflow-x-auto flex-1">
        <table class="w-full text-left border-collapse min-w-max">
          <thead>
            <tr class="bg-gray-50/50 border-b border-gray-100 sticky top-0 backdrop-blur-md z-10">
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider">Commande</th>
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider">Date & Heure</th>
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider">Statut</th>
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider">Client (Dette)</th>
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider">Total</th>
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            <tr v-for="order in filteredOrders" :key="order.id" class="hover:bg-gray-50/30 transition-colors group">
              <td class="px-8 py-6">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                    <ShoppingBag class="w-6 h-6 text-red-600" />
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
                  <Clock class="w-4 h-4" />
                  Non payée
                </span>
              </td>
              <td class="px-8 py-6">
                <div v-if="order.debtAccount" class="flex flex-col">
                  <span class="font-bold text-gray-800">
                    {{ typeof order.debtAccount === 'string' ? "Client" : order.debtAccount.fullName }}
                  </span>
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
                <button @click="openOrderDetails(order)" class="inline-flex items-center justify-center px-4 py-2 text-white bg-primary-600 font-bold rounded-xl hover:bg-primary-700 transition-colors" title="Payer">
                  Régler
                </button>
              </td>
            </tr>
            <tr v-if="filteredOrders.length === 0">
              <td colspan="6" class="px-8 py-12 text-center text-gray-500 font-medium text-lg">
                Aucune dette trouvée.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div v-if="!loading && !error" class="p-6 border-t border-gray-100 flex items-center justify-between bg-white text-gray-500 font-medium">
        <span>Total: {{ filteredOrders.length }} dettes non réglées</span>
      </div>
    </div>

    <!-- Order Details Modal -->
    <div v-if="isModalOpen && selectedOrder" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-full">
        <div class="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-2xl font-bold text-gray-900">Régler la commande <span class="text-primary-600">CMD-{{ String(selectedOrder.id).padStart(5, '0') }}</span></h3>
          <button @click="closeOrderDetails" class="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors" :disabled="submittingPayment">
            <span class="sr-only">Fermer</span>
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div class="p-8 overflow-y-auto flex-1 space-y-6">
          <div class="grid grid-cols-2 gap-6 bg-gray-50 p-6 rounded-2xl border border-gray-100">
            <div>
              <p class="text-sm font-bold text-gray-500 mb-1">Date & Heure</p>
              <p class="font-medium text-gray-900">{{ formatDate(selectedOrder.createdAt) }}</p>
            </div>
            <div v-if="selectedOrder.debtAccount">
              <p class="text-sm font-bold text-gray-500 mb-1">Client (Dette)</p>
              <p class="font-medium text-gray-900">
                {{ typeof selectedOrder.debtAccount === 'string' ? "Client" : selectedOrder.debtAccount.fullName }}
              </p>
            </div>
          </div>
          
          <div>
            <h4 class="font-bold text-gray-900 text-lg mb-4">Montant à régler</h4>
            <div class="text-4xl font-black text-gray-900 text-center py-6 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                {{ (selectedOrder.totalCents / 100).toFixed(2) }} €
            </div>
          </div>
          
          <div class="pt-6">
            <h4 class="font-bold text-gray-900 text-lg mb-4">Choisir le moyen de paiement pour régler</h4>
            <div class="grid grid-cols-2 gap-4">
               <button @click="markAsPaid('cash')" :disabled="submittingPayment" class="flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-3xl hover:border-green-600 hover:bg-green-50 transition-all gap-4 group disabled:opacity-50 disabled:cursor-not-allowed">
                  <Banknote class="w-12 h-12 text-green-600 group-hover:scale-110 transition-transform" />
                  <span class="font-black text-gray-700 group-hover:text-green-700">Payer en Espèces</span>
               </button>
               <button @click="markAsPaid('card')" :disabled="submittingPayment" class="flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-3xl hover:border-blue-600 hover:bg-blue-50 transition-all gap-4 group disabled:opacity-50 disabled:cursor-not-allowed">
                  <CreditCard class="w-12 h-12 text-blue-600 group-hover:scale-110 transition-transform" />
                  <span class="font-black text-gray-700 group-hover:text-blue-700">Payer par Carte</span>
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
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
