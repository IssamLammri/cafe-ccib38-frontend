<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { 
  Banknote, 
  CreditCard,
  History,
  Tag,
  Calendar,
  Wallet,
  Users
} from 'lucide-vue-next';
import api from '@/api/api';

interface OrderItem {
  quantity: number;
  unitPriceCents: number;
  product?: {
    id?: number | string;
    '@id'?: string;
    name?: string;
    category?: string;
  } | string;
}

interface Order {
  id: number | string;
  createdAt: string;
  totalCents: number;
  discountCents: number;
  paymentMethod: 'cash' | 'card' | 'later';
  paid: boolean;
  agent?: any;
  items?: OrderItem[];
  debtAccount?: {
    fullName: string;
  } | string;
}

const orders = ref<Order[]>([]);
const loading = ref(true);
const error = ref('');

// Filters
const years = [2026, 2027, 2028];
const months = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const selectedYears = ref<number[]>([new Date().getFullYear()]);
const selectedMonths = ref<number[]>([]); // 0-based month index
const selectedAgents = ref<string[]>([]);
const agents = ref<any[]>([]);
const productsMap = ref<Record<string, any>>({});

const startDate = ref('');
const endDate = ref('');

const fetchOrders = async () => {
  loading.value = true;
  try {
    const [ordersRes, usersRes, productsRes] = await Promise.all([
      api.get('/orders?pagination=false'),
      api.get('/users?pagination=false'),
      api.get('/products?pagination=false')
    ]);
    orders.value = ordersRes.data['hydra:member'] || ordersRes.data['member'] || ordersRes.data || [];
    agents.value = usersRes.data['hydra:member'] || usersRes.data['member'] || usersRes.data || [];
    const productsArray = productsRes.data['hydra:member'] || productsRes.data['member'] || productsRes.data || [];
    const pMap: Record<string, any> = {};
    for (const p of productsArray) {
      pMap[p['@id'] || `/api/products/${p.id}`] = p;
    }
    productsMap.value = pMap;
  } catch (err) {
    console.error(err);
    error.value = "Erreur lors du chargement des statistiques.";
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchOrders();
});

const toggleYear = (year: number) => {
  const index = selectedYears.value.indexOf(year);
  if (index === -1) {
    selectedYears.value.push(year);
  } else {
    selectedYears.value.splice(index, 1);
  }
  // Clear custom dates if using tags
  if (startDate.value || endDate.value) {
    startDate.value = '';
    endDate.value = '';
  }
};

const toggleMonth = (monthIndex: number) => {
  const index = selectedMonths.value.indexOf(monthIndex);
  if (index === -1) {
    selectedMonths.value.push(monthIndex);
  } else {
    selectedMonths.value.splice(index, 1);
  }
  // Clear custom dates if using tags
  if (startDate.value || endDate.value) {
    startDate.value = '';
    endDate.value = '';
  }
};

const toggleAgent = (agentUri: string) => {
  const index = selectedAgents.value.indexOf(agentUri);
  if (index === -1) {
    selectedAgents.value.push(agentUri);
  } else {
    selectedAgents.value.splice(index, 1);
  }
};

const getAgentName = (agent: any) => {
  if (agent.firstName || agent.lastName) {
    return `${agent.firstName || ''} ${agent.lastName || ''}`.trim();
  }
  return agent.username || agent.email;
};

const onCustomDateChange = () => {
  // Clear tags if user types in custom dates
  selectedYears.value = [];
  selectedMonths.value = [];
};

// Filtered Orders
const filteredOrders = computed(() => {
  return orders.value.filter(order => {
    let datePass = true;
    const d = new Date(order.createdAt);
    
    if (startDate.value || endDate.value) {
      const orderTime = d.getTime();
      if (startDate.value) {
         datePass = datePass && orderTime >= new Date(startDate.value).getTime();
      }
      if (endDate.value) {
         // Add 1 day to end date to include the whole day
         const end = new Date(endDate.value);
         end.setDate(end.getDate() + 1);
         datePass = datePass && orderTime < end.getTime();
      }
    } else {
      // Tag Filters
      const yearPass = selectedYears.value.length === 0 || selectedYears.value.includes(d.getFullYear());
      const monthPass = selectedMonths.value.length === 0 || selectedMonths.value.includes(d.getMonth());
      datePass = yearPass && monthPass;
    }
    
    // Agent Filter
    let agentPass = true;
    if (selectedAgents.value.length > 0) {
      const orderAgentUri = typeof order.agent === 'string' ? order.agent : (order.agent ? (order.agent['@id'] || `/api/users/${order.agent.id}`) : null);
      agentPass = selectedAgents.value.includes(orderAgentUri);
    }
    
    return datePass && agentPass;
  });
});

// Stats
const totalCash = computed(() => {
  return filteredOrders.value
    .filter(o => o.paymentMethod === 'cash')
    .reduce((sum, o) => sum + o.totalCents, 0) / 100;
});

const totalCard = computed(() => {
  return filteredOrders.value
    .filter(o => o.paymentMethod === 'card')
    .reduce((sum, o) => sum + o.totalCents, 0) / 100;
});

const totalDiscounts = computed(() => {
  return filteredOrders.value.reduce((sum, o) => sum + (o.discountCents || 0), 0) / 100;
});

const totalBeforeDiscounts = computed(() => {
  const finalTotal = filteredOrders.value.reduce((sum, o) => sum + o.totalCents, 0) / 100;
  return finalTotal + totalDiscounts.value;
});

const remainingDebtsValue = computed(() => {
  return filteredOrders.value
    .filter(o => o.paymentMethod === 'later' && !o.paid)
    .reduce((sum, o) => sum + o.totalCents, 0) / 100;
});

const unpaidDebts = computed(() => {
  const debtsMap = new Map();
  filteredOrders.value
    .filter(o => o.paymentMethod === 'later' && !o.paid)
    .forEach(o => {
      const name = typeof o.debtAccount === 'string' ? "Client" : (o.debtAccount?.fullName || "Client Inconnu");
      const current = debtsMap.get(name) || 0;
      debtsMap.set(name, current + o.totalCents);
    });
  
  return Array.from(debtsMap.entries()).map(([name, amount]) => ({
    name,
    amount: amount / 100
  })).sort((a, b) => b.amount - a.amount);
});

const monthlyRevenue = computed(() => {
  const revenueByMonth = new Array(12).fill(0);
  
  const yearsToConsider = selectedYears.value.length > 0 ? selectedYears.value : [new Date().getFullYear()];

  orders.value.forEach(o => {
    let agentPass = true;
    if (selectedAgents.value.length > 0) {
      const orderAgentUri = typeof o.agent === 'string' ? o.agent : (o.agent ? (o.agent['@id'] || `/api/users/${o.agent.id}`) : null);
      agentPass = selectedAgents.value.includes(orderAgentUri);
    }
    
    if (agentPass) {
      const d = new Date(o.createdAt);
      if (yearsToConsider.includes(d.getFullYear())) {
        if (o.paymentMethod !== 'later' || o.paid) {
          revenueByMonth[d.getMonth()] += o.totalCents / 100;
        }
      }
    }
  });
  
  return revenueByMonth;
});

const maxMonthlyRevenue = computed(() => Math.max(...monthlyRevenue.value, 1));

const productStats = computed(() => {
  const categoriesMap = new Map<string, number>();
  const productsTotalMap = new Map<string, { name: string, amount: number, quantity: number, category: string }>();

  filteredOrders.value.forEach(order => {
    if (order.paymentMethod === 'later' && !order.paid) return; // Only count paid
    
    if (order.items) {
      order.items.forEach(item => {
        const itemTotal = item.quantity * item.unitPriceCents;
          let productData: any = item.product;
          
          let productId = typeof item.product === 'string' ? item.product : (item.product?.['@id'] || (item.product?.id ? `/api/products/${item.product.id}` : null));
          
          if (productId && productsMap.value[productId]) {
            // merge data to ensure we get category from the full product list
            productData = { 
               ...(typeof item.product === 'object' ? item.product : {}),
               ...productsMap.value[productId]
            };
          }

          const category = productData?.category || 'Non catégorisé';
          const name = productData?.name || 'Produit inconnu';

        // Add to category
        const currentCatTotal = categoriesMap.get(category) || 0;
        categoriesMap.set(category, currentCatTotal + itemTotal);

        // Add to product
        const currentProd = productsTotalMap.get(name) || { name, amount: 0, quantity: 0, category };
        currentProd.amount += itemTotal;
        currentProd.quantity += item.quantity;
        productsTotalMap.set(name, currentProd);
      });
    }
  });

  const revenueByCategory = Array.from(categoriesMap.entries()).map(([name, amount]) => ({
    name,
    amount: amount / 100
  })).sort((a, b) => b.amount - a.amount);

  const topProducts = Array.from(productsTotalMap.values()).map(p => ({
    ...p,
    amount: p.amount / 100
  })).sort((a, b) => b.amount - a.amount).slice(0, 5);

  return { revenueByCategory, topProducts };
});

</script>

<template>
  <div class="space-y-6 h-full flex flex-col">
    <!-- Filters -->
    <div class="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mx-8 mt-8">
      <div class="flex flex-col xl:flex-row justify-between gap-6">
        
        <div class="space-y-4 flex-1">
          <div>
             <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Années</h3>
             <div class="flex flex-wrap gap-2">
               <button 
                 v-for="year in years" :key="year"
                 @click="toggleYear(year)"
                 class="px-5 py-2 rounded-full font-bold text-sm transition-all border-2"
                 :class="selectedYears.includes(year) ? 'bg-primary-600 border-primary-600 text-white shadow-md shadow-primary-600/20' : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300'"
               >
                 {{ year }}
               </button>
             </div>
          </div>
          <div>
             <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Mois</h3>
             <div class="flex flex-wrap gap-2">
               <button 
                 v-for="(month, index) in months" :key="index"
                 @click="toggleMonth(index)"
                 class="px-5 py-2 rounded-full font-bold text-sm transition-all border-2"
                 :class="selectedMonths.includes(index) ? 'bg-primary-600 border-primary-600 text-white shadow-md shadow-primary-600/20' : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300'"
               >
                 {{ month }}
               </button>
             </div>
          </div>
          <div v-if="agents.length > 0">
             <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 mt-4">Vendeurs</h3>
             <div class="flex flex-wrap gap-2">
               <button 
                 v-for="agent in agents" :key="agent.id"
                 @click="toggleAgent(agent['@id'] || `/api/users/${agent.id}`)"
                 class="px-5 py-2 rounded-full font-bold text-sm transition-all border-2"
                 :class="selectedAgents.includes(agent['@id'] || `/api/users/${agent.id}`) ? 'bg-primary-600 border-primary-600 text-white shadow-md shadow-primary-600/20' : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300'"
               >
                 {{ getAgentName(agent) }}
               </button>
             </div>
          </div>
        </div>

        <div class="xl:w-[400px] border-l border-gray-100 xl:pl-6 space-y-4">
          <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wider">Date précise (entre deux dates)</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-500 mb-1">Du</label>
              <input type="date" v-model="startDate" @change="onCustomDateChange" class="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2 text-sm font-bold focus:border-primary-500 outline-none text-gray-700" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-500 mb-1">Au</label>
              <input type="date" v-model="endDate" @change="onCustomDateChange" class="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2 text-sm font-bold focus:border-primary-500 outline-none text-gray-700" />
            </div>
          </div>
          <p v-if="startDate || endDate" class="text-xs text-primary-600 font-bold bg-primary-50 p-2 rounded-lg">Filtre par date précise actif. Tags ignorés.</p>
        </div>

      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-8 flex-shrink-0">
      <div class="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
        <div class="flex justify-between items-start mb-2">
          <div class="p-3 bg-green-50 rounded-2xl group-hover:bg-green-100 transition-colors border border-green-100">
            <Banknote class="w-7 h-7 text-green-600" />
          </div>
        </div>
        <div>
          <p class="text-gray-500 font-medium text-sm">Recette Espèce</p>
          <h3 class="text-2xl font-black text-gray-900 mt-1">{{ totalCash.toFixed(2) }} €</h3>
        </div>
      </div>
      
      <div class="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
        <div class="flex justify-between items-start mb-2">
          <div class="p-3 bg-blue-50 rounded-2xl group-hover:bg-blue-100 transition-colors border border-blue-100">
            <CreditCard class="w-7 h-7 text-blue-600" />
          </div>
        </div>
        <div>
          <p class="text-gray-500 font-medium text-sm">Recette Carte Bancaire</p>
          <h3 class="text-2xl font-black text-gray-900 mt-1">{{ totalCard.toFixed(2) }} €</h3>
        </div>
      </div>

      <div class="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
        <div class="flex justify-between items-start mb-2">
          <div class="p-3 bg-indigo-50 rounded-2xl group-hover:bg-indigo-100 transition-colors border border-indigo-100">
            <Wallet class="w-7 h-7 text-indigo-600" />
          </div>
        </div>
        <div>
          <p class="text-gray-500 font-medium text-sm">Total avant remises</p>
          <h3 class="text-2xl font-black text-gray-900 mt-1">{{ totalBeforeDiscounts.toFixed(2) }} €</h3>
        </div>
      </div>

      <div class="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
        <div class="flex justify-between items-start mb-2">
          <div class="p-3 bg-amber-50 rounded-2xl group-hover:bg-amber-100 transition-colors border border-amber-100">
            <Tag class="w-7 h-7 text-amber-600" />
          </div>
        </div>
        <div>
          <p class="text-gray-500 font-medium text-sm">Total remises appliquées</p>
          <h3 class="text-2xl font-black text-gray-900 mt-1">{{ totalDiscounts.toFixed(2) }} €</h3>
        </div>
      </div>
    </div>

    <!-- Debts details -->
    <div class="px-8 pb-8 flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8">
       <div class="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col max-h-full">
         <div class="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
           <div class="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center border border-purple-100">
             <History class="w-7 h-7 text-purple-600" />
           </div>
           <div>
             <h3 class="text-xl font-bold text-gray-900">Dettes en attente</h3>
             <p class="text-gray-500 font-medium text-sm">Sur la période sélectionnée</p>
           </div>
           <div class="ml-auto text-right">
             <h3 class="text-3xl font-black text-purple-600">{{ remainingDebtsValue.toFixed(2) }} €</h3>
           </div>
         </div>
         
         <div class="overflow-y-auto flex-1 space-y-2 pr-2">
           <div v-if="unpaidDebts.length === 0" class="text-center py-10">
             <p class="text-gray-500 font-medium">Aucune dette en attente pour cette période.</p>
           </div>
           <div v-for="(debt, index) in unpaidDebts" :key="index" class="p-4 rounded-xl border-2 border-gray-50 bg-gray-50 flex items-center justify-between group">
             <div class="flex items-center gap-3">
               <div class="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-500 font-bold shadow-sm">
                 <Users class="w-5 h-5 text-gray-400" />
               </div>
               <span class="font-bold text-gray-700 text-lg">{{ debt.name }}</span>
             </div>
             <span class="font-black text-gray-900 text-xl">{{ debt.amount.toFixed(2) }} €</span>
           </div>
         </div>
       </div>

       <!-- Chart -->
       <div class="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col h-full min-h-[350px]">
         <div class="mb-8">
           <h3 class="text-xl font-bold text-gray-900">Recettes par mois</h3>
           <p class="text-gray-500 font-medium text-sm mt-1">
             Année(s) : {{ selectedYears.length > 0 ? selectedYears.join(', ') : new Date().getFullYear() }}
           </p>
         </div>
         
         <div class="flex-1 flex items-end gap-2 sm:gap-3 md:gap-4 relative pt-10">
            <div 
              v-for="(amount, index) in monthlyRevenue" 
              :key="index"
              class="flex-1 flex flex-col items-center gap-3 group h-full justify-end"
            >
              <div class="w-full flex justify-center relative h-full items-end">
                <div class="absolute bottom-full mb-3 hidden group-hover:block bg-gray-900 text-white text-xs font-bold py-1.5 px-2.5 rounded-lg whitespace-nowrap z-10 shadow-lg after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-gray-900">
                  {{ amount.toFixed(2) }} €
                </div>
                <div 
                  class="w-full max-w-[40px] bg-primary-100 rounded-t-xl relative overflow-hidden transition-all group-hover:bg-primary-200"
                  :style="{ height: `${Math.max((amount / maxMonthlyRevenue) * 100, 1)}%` }"
                >
                  <div class="absolute bottom-0 w-full bg-primary-600 transition-all rounded-t-xl" style="height: 100%;"></div>
                </div>
              </div>
              <span class="text-xs font-bold text-gray-400 group-hover:text-gray-700 transition-colors uppercase">
                {{ months[index].substring(0, 3) }}
              </span>
            </div>
         </div>
       </div>
    </div>
    
    <!-- Products stats details -->
    <div class="px-8 pb-8 flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Revenue by Category -->
      <div class="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col max-h-full">
        <div class="mb-6 pb-6 border-b border-gray-100">
          <h3 class="text-xl font-bold text-gray-900">Ventes par catégorie</h3>
          <p class="text-gray-500 font-medium text-sm mt-1">Répartition du chiffre d'affaires</p>
        </div>
        <div class="overflow-y-auto flex-1 space-y-4 pr-2">
          <div v-if="productStats.revenueByCategory.length === 0" class="text-center py-10">
            <p class="text-gray-500 font-medium">Aucune donnée pour cette période.</p>
          </div>
          <div v-for="(cat, index) in productStats.revenueByCategory" :key="index" class="space-y-2">
            <div class="flex justify-between items-end">
              <span class="font-bold text-gray-700">{{ cat.name }}</span>
              <span class="font-black text-gray-900">{{ cat.amount.toFixed(2) }} €</span>
            </div>
            <div class="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div class="h-full bg-primary-500 rounded-full" :style="{ width: `${Math.max((cat.amount / Math.max(...productStats.revenueByCategory.map(c => c.amount), 1)) * 100, 1)}%` }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Products -->
      <div class="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col max-h-full">
        <div class="mb-6 pb-6 border-b border-gray-100">
          <h3 class="text-xl font-bold text-gray-900">Top 5 Produits</h3>
          <p class="text-gray-500 font-medium text-sm mt-1">Les plus vendus sur la période</p>
        </div>
        <div class="overflow-y-auto flex-1 space-y-3 pr-2">
          <div v-if="productStats.topProducts.length === 0" class="text-center py-10">
            <p class="text-gray-500 font-medium">Aucune donnée pour cette période.</p>
          </div>
          <div v-for="(prod, index) in productStats.topProducts" :key="index" class="p-4 rounded-xl border border-gray-100 bg-white flex items-center justify-between group flex-wrap gap-2 hover:border-primary-200 transition-colors">
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center font-black text-gray-400 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
                #{{ index + 1 }}
              </div>
              <div>
                <p class="font-bold text-gray-800">{{ prod.name }}</p>
                <p class="text-xs text-gray-500 font-medium">{{ prod.category }} • {{ prod.quantity }} vendu(s)</p>
              </div>
            </div>
            <span class="font-black text-primary-600 text-lg">{{ prod.amount.toFixed(2) }} €</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

