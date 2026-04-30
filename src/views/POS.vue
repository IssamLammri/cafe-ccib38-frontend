<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard,
  Banknote,
  Tag,
  ShoppingCart,
  Loader2,
  ArrowUp,
  ArrowDown
} from 'lucide-vue-next';
import api from '@/api/api';
import VirtualKeyboard from '@/components/VirtualKeyboard.vue';

// Types
interface Product {
  id: number | string;
  '@id'?: string;
  name: string;
  category: string;
  priceCents: number;
  active: boolean;
}

interface Discount {
  id: number | string;
  '@id'?: string;
  title: string;
  percentage: number;
  active: boolean;
}

interface Setting {
  id: number;
  shopName: string;
  address: string;
  phone: string;
  taxRate: number;
  enableTax: boolean;
  currency: string;
  nextTicketNumber: number;
}

const products = ref<Product[]>([]);
const discounts = ref<Discount[]>([]);
const setting = ref<Setting | null>(null);

const loading = ref(true);
const error = ref('');

const productsContainer = ref<HTMLElement | null>(null);
const cartContainer = ref<HTMLElement | null>(null);

const scrollProducts = (direction: 'up' | 'down') => {
  if (productsContainer.value) {
    productsContainer.value.scrollBy({ top: direction === 'up' ? -400 : 400, behavior: 'smooth' });
  }
};

const scrollCart = (direction: 'up' | 'down') => {
  if (cartContainer.value) {
    cartContainer.value.scrollBy({ top: direction === 'up' ? -200 : 200, behavior: 'smooth' });
  }
};

const categories = computed(() => {
  const cats = new Set(products.value.map(p => p.category));
  return ['Tout', ...Array.from(cats)];
});
const selectedCategory = ref('Tout');

const filteredProducts = computed(() => {
  if (selectedCategory.value === 'Tout') return products.value;
  return products.value.filter(p => p.category === selectedCategory.value);
});

const cart = ref<any[]>([]);

const addToCart = (product: Product) => {
  const existing = cart.value.find(item => item.id === product.id);
  if (existing) {
    existing.quantity++;
  } else {
    cart.value.push({ ...product, quantity: 1, price: product.priceCents / 100 });
  }
};

const subtotal = computed(() => cart.value.reduce((acc, item) => acc + (item.price * item.quantity), 0));

// Discounts
const selectedDiscount = ref<Discount | null>(null);
const discountAmount = computed(() => {
  if (!selectedDiscount.value) return 0;
  return subtotal.value * (selectedDiscount.value.percentage / 100);
});

const tva = computed(() => {
  if (!setting.value?.enableTax) return 0;
  return (subtotal.value - discountAmount.value) * (setting.value.taxRate / 100);
});

const total = computed(() => subtotal.value - discountAmount.value + tva.value);

const removeFromCart = (id: number | string) => {
  cart.value = cart.value.filter(item => item.id !== id);
};

const updateQuantity = (id: number | string, delta: number) => {
  const item = cart.value.find(i => i.id === id);
  if (item) {
    item.quantity = Math.max(1, item.quantity + delta);
  }
};

// Data Fetching
const fetchData = async () => {
  loading.value = true;
  error.value = '';
  try {
    const [productsRes, discountsRes, settingsRes] = await Promise.all([
      api.get('/products?active=true'),
      api.get('/discount_beneficiaries?active=true'),
      api.get('/settings/1').catch(() => null) // Settings max not exist at first
    ]);

    products.value = productsRes.data['hydra:member'] || productsRes.data['member'] || productsRes.data || [];
    discounts.value = discountsRes.data['hydra:member'] || discountsRes.data['member'] || discountsRes.data || [];
    
    if (settingsRes && settingsRes.data) {
      setting.value = settingsRes.data;
    }
    
    // Check if we have an order to edit
    const editOrderJson = localStorage.getItem('edit_order_items');
    if (editOrderJson) {
       try {
         const itemsToEdit = JSON.parse(editOrderJson);
         for (const item of itemsToEdit) {
           // Find product
           const p = products.value.find((prod: any) => prod.id === item.productId || prod['@id'] === item.productId);
           if (p) {
             cart.value.push({ ...p, quantity: item.quantity, price: p.priceCents / 100 });
           }
         }
       } catch(e) {
         console.error('Error parsing edit_order_items', e);
       } finally {
         localStorage.removeItem('edit_order_items');
       }
    }
    
  } catch (err: any) {
    error.value = 'Erreur lors du chargement des données.';
    console.error(err);
  } finally {
    loading.value = false;
  }
};

// Payment Process
const showPaymentModal = ref(false);
const showDiscountModal = ref(false);
const submitting = ref(false);
const paymentMethod = ref<'cash' | 'card' | 'later'>('cash');

interface DebtAccount {
  id: number | string;
  '@id'?: string;
  fullName: string;
  phone?: string;
}

const debtAccounts = ref<DebtAccount[]>([]);
const selectedDebtAccount = ref<DebtAccount | null>(null);
const isCreatingDebtAccount = ref(false);
const newDebtAccount = ref({ fullName: '', phone: '' });
const activeKeyboard = ref<'name' | 'phone' | null>(null);

const checkout = async () => {
  paymentMethod.value = 'cash';
  isCreatingDebtAccount.value = false;
  newDebtAccount.value = { fullName: '', phone: '' };
  activeKeyboard.value = null;
  showPaymentModal.value = true;
};

const submitOrder = async () => {
  if (paymentMethod.value === 'later') {
    if (isCreatingDebtAccount.value) {
      if (!newDebtAccount.value.fullName.trim()) {
        alert("Veuillez saisir le nom de la personne.");
        return;
      }
    } else if (!selectedDebtAccount.value) {
      alert("Veuillez sélectionner une personne pour la dette.");
      return;
    }
  }
  
  submitting.value = true;
  try {
    let debtAccountUri = null;
    if (paymentMethod.value === 'later') {
      if (isCreatingDebtAccount.value) {
        const res = await api.post('/customer_debt_accounts', newDebtAccount.value);
        debtAccountUri = res.data['@id'] || `/api/customer_debt_accounts/${res.data.id}`;
        // Add to list so it's available next time
        debtAccounts.value.push(res.data);
      } else if (selectedDebtAccount.value) {
        debtAccountUri = selectedDebtAccount.value['@id'] || `/api/customer_debt_accounts/${selectedDebtAccount.value.id}`;
      }
    }

    const authStore = (await import('@/stores/auth')).useAuthStore();
    
    let agentUri = null;
    try {
      const usersRes = await api.get('/users');
      const users = usersRes.data['hydra:member'] || usersRes.data['member'] || usersRes.data || [];
      const currentUser = users.find((u: any) => u.email === authStore.user?.email || u.username === authStore.user?.username);
      if (currentUser) {
         agentUri = currentUser['@id'] || `/api/users/${currentUser.id}`;
      }
    } catch(e) {
      console.error('Failed to resolve agent IRI', e);
    }

    const payload: any = {
      paymentMethod: paymentMethod.value,
      paid: paymentMethod.value !== 'later',
      items: cart.value.map(c => ({
        product: c['@id'] || `/api/products/${c.id}`,
        quantity: c.quantity
      }))
    };
    
    if (selectedDiscount.value) {
      payload.discountBeneficiary = selectedDiscount.value['@id'] || `/api/discount_beneficiaries/${selectedDiscount.value.id}`;
    }
    
    if (debtAccountUri) {
      payload.debtAccount = debtAccountUri;
    }
    
    // Add agent if available
    if (agentUri) {
       payload.agent = agentUri;
    }

    await api.post('/orders', payload);
    
    // Success, reset cart
    cart.value = [];
    selectedDiscount.value = null;
    showPaymentModal.value = false;
    selectedDebtAccount.value = null;
    isCreatingDebtAccount.value = false;
    newDebtAccount.value = { fullName: '', phone: '' };
    
    // Mock receipt / success message
    alert("Commande validée avec succès !");
  } catch (err: any) {
    if (err.response) {
       console.error("Order submit failed:", err.response.data);
       alert("Erreur lors de la création de la commande: " + (err.response.data['hydra:description'] || err.response.data.detail || err.message));
    } else {
       console.error(err);
       alert("Erreur lors de la création de la commande.");
    }
  } finally {
    submitting.value = false;
  }
};

const fetchDebtAccounts = async () => {
  try {
    const res = await api.get('/customer_debt_accounts');
    debtAccounts.value = res.data['hydra:member'] || res.data['member'] || res.data || [];
  } catch(e) {
    console.error(e);
  }
};

onMounted(() => {
  fetchData();
  fetchDebtAccounts();
});

// Helpers
const getProductColor = (category: string) => {
  // Simple deterministic color based on category string
  const colors = ['bg-orange-50', 'bg-blue-50', 'bg-green-50', 'bg-purple-50', 'bg-rose-50', 'bg-yellow-50'];
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};
</script>

<template>
  <div class="flex h-full bg-gray-50">
    <!-- Left: Product Grid -->
    <div class="flex-1 flex flex-col min-w-0 h-full">
      
      <!-- Top Padding to simulate full height if needed, OR we can stick tabs at the top -->
      <!-- Filters / Tabs -->
      <div class="bg-white px-6 pt-4 pb-0 flex gap-2 overflow-x-auto border-b border-gray-200 shrink-0 scrollbar-hide">
        <button 
          v-for="cat in categories" 
          :key="cat"
          @click="selectedCategory = cat"
          class="px-8 py-4 rounded-t-xl text-lg font-bold whitespace-nowrap transition-all border border-b-0"
          :class="selectedCategory === cat ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'"
        >
          {{ cat }}
        </button>
      </div>

      <!-- Products Grid -->
      <div v-if="loading" class="flex-1 flex items-center justify-center">
        <Loader2 class="w-12 h-12 animate-spin text-primary-600" />
      </div>
      <div v-else-if="error" class="flex-1 flex items-center justify-center">
        <p class="text-red-500 font-bold text-xl">{{ error }}</p>
      </div>
      <div v-else class="flex-1 flex overflow-hidden relative group/products">
        <div class="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-10 pointer-events-none">
          <button @click="scrollProducts('up')" class="pointer-events-auto w-14 h-14 bg-white/90 backdrop-blur border border-gray-200 shadow-lg rounded-full flex items-center justify-center text-gray-700 active:bg-primary-50 active:text-primary-600 active:scale-95 transition-all">
            <ArrowUp class="w-8 h-8 pointer-events-none" />
          </button>
          <button @click="scrollProducts('down')" class="pointer-events-auto w-14 h-14 bg-white/90 backdrop-blur border border-gray-200 shadow-lg rounded-full flex items-center justify-center text-gray-700 active:bg-primary-50 active:text-primary-600 active:scale-95 transition-all">
            <ArrowDown class="w-8 h-8 pointer-events-none" />
          </button>
        </div>
        <div ref="productsContainer" class="flex-1 overflow-y-auto p-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 content-start scrollbar-hide">
          <button 
            v-for="product in filteredProducts" 
            :key="product.id"
            @click="addToCart(product)"
            class="bg-white p-4 rounded-xl border border-gray-200 hover:border-primary-600 shadow-sm transition-all active:scale-95 text-left flex flex-col h-32 relative group"
          >
            <div class="flex justify-between items-start mb-2">
              <h4 class="text-base font-bold text-gray-800 line-clamp-2 leading-tight pr-2">{{ product.name }}</h4>
            </div>
            
            <!-- Colored price bar at bottom like in image -->
            <div class="absolute bottom-4 right-4 left-4 h-10 rounded-lg flex items-center justify-end px-4" :class="getProductColor(product.category)">
              <span class="text-xl font-bold text-gray-700 opacity-90">{{ (product.priceCents / 100).toFixed(2) }} €</span>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Right: Fixed Cart (Checkout Sidebar) -->
    <div class="w-96 shrink-0 flex flex-col bg-white border-l border-gray-200 h-full">
      <div class="p-6 bg-gray-600 text-white flex items-center justify-between">
        <h2 class="text-xl font-bold">Panier ({{ cart.reduce((acc, item) => acc + item.quantity, 0) }})</h2>
        <button @click="cart = []" class="text-gray-300 hover:text-white p-1">
          <Trash2 class="w-5 h-5" />
        </button>
      </div>

      <!-- Cart Items -->
      <div class="flex-1 flex overflow-hidden relative group/cart">
        <div class="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10 pointer-events-none">
          <button @click="scrollCart('up')" class="pointer-events-auto w-10 h-10 bg-white/90 backdrop-blur border border-gray-200 shadow-lg rounded-full flex items-center justify-center text-gray-700 active:bg-primary-50 active:text-primary-600 active:scale-95 transition-all">
            <ArrowUp class="w-5 h-5 pointer-events-none" />
          </button>
          <button @click="scrollCart('down')" class="pointer-events-auto w-10 h-10 bg-white/90 backdrop-blur border border-gray-200 shadow-lg rounded-full flex items-center justify-center text-gray-700 active:bg-primary-50 active:text-primary-600 active:scale-95 transition-all">
            <ArrowDown class="w-5 h-5 pointer-events-none" />
          </button>
        </div>

        <div ref="cartContainer" class="flex-1 overflow-y-auto p-4 pr-12 space-y-0 scrollbar-hide">
          <div v-if="cart.length === 0" class="h-full flex flex-col items-center justify-center opacity-40">
            <ShoppingCart class="w-20 h-20 mb-4" />
            <p class="text-xl font-bold text-center">Votre panier est vide</p>
            <p class="text-center">Sélectionnez des produits à gauche</p>
          </div>

          <div v-for="item in cart" :key="item.id" class="flex items-center gap-2 py-3 border-b border-gray-100 last:border-0 group/item">
            <div class="flex-1 font-bold text-gray-800 text-lg truncate" :title="item.name">
              {{ item.name }}
            </div>
            
            <div class="flex items-center bg-gray-50 rounded-lg p-0.5 shrink-0">
              <button @click="updateQuantity(item.id, -1)" class="p-1 hover:bg-white rounded transition-colors" :disabled="item.quantity <= 1">
                <Minus class="w-4 h-4" />
              </button>
              <span class="w-6 text-center font-bold text-base">{{ item.quantity }}</span>
              <button @click="updateQuantity(item.id, 1)" class="p-1 hover:bg-white rounded transition-colors">
                <Plus class="w-4 h-4" />
              </button>
            </div>

            <div class="text-base font-black text-gray-900 min-w-[60px] text-right shrink-0 tabular-nums">
              {{ (item.price * item.quantity).toFixed(2) }} €
            </div>

            <button @click="removeFromCart(item.id)" class="text-gray-400 hover:text-red-500 transition-colors p-1 shrink-0 ml-1">
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Summary & Checkout -->
      <div class="p-6 bg-gray-50 border-t border-gray-100 space-y-4">
        <div class="space-y-2">
          <div class="flex justify-between text-gray-600 font-medium">
            <span>Sous-total</span>
            <span>{{ subtotal.toFixed(2) }} €</span>
          </div>
          <div v-if="selectedDiscount" class="flex justify-between text-gray-600 font-medium">
            <span>Remise ({{ selectedDiscount.title }} - {{ selectedDiscount.percentage }}%)</span>
            <span class="text-red-500">-{{ discountAmount.toFixed(2) }} €</span>
          </div>
          <div class="flex justify-between text-gray-600 font-medium">
            <span>TVA ({{ setting?.enableTax ? setting.taxRate + '%' : '0%' }})</span>
            <span>{{ tva.toFixed(2) }} €</span>
          </div>
          <button @click="showDiscountModal = true" class="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-primary-300 rounded-xl text-primary-700 font-bold hover:bg-primary-50 transition-colors">
            <Tag class="w-5 h-5" />
            <span v-if="selectedDiscount">Changer de remise</span>
            <span v-else>Ajouter une remise</span>
          </button>
        </div>
        
        <div class="flex justify-between items-end pt-2">
          <p class="text-gray-500 font-bold mb-1">TOTAL TTC</p>
          <p class="text-4xl font-black text-primary-700">{{ total.toFixed(2) }} €</p>
        </div>

        <button 
          @click="checkout"
          class="w-full h-20 bg-primary-600 text-white rounded-2xl text-2xl font-bold shadow-xl shadow-primary-600/30 hover:bg-primary-700 active:scale-95 transition-all flex items-center justify-center gap-4 mt-4"
          :disabled="cart.length === 0"
        >
          <Banknote class="w-8 h-8" />
          ENCAISSER
        </button>
      </div>
    </div>

    <!-- Modals -->
    <!-- Discount Modal -->
    <div v-if="showDiscountModal" class="fixed inset-0 bg-black/50/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div class="bg-white rounded-3xl p-8 w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
        <div class="flex items-center justify-between mb-8">
          <h3 class="text-3xl font-black text-gray-900">Appliquer une remise</h3>
          <button @click="showDiscountModal = false" class="px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-lg">
            Annuler
          </button>
        </div>
        
        <div class="grid grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-4 scrollbar-hide flex-1">
          <button 
            @click="selectedDiscount = null; showDiscountModal = false"
            class="p-6 rounded-2xl border-2 text-center transition-all min-h-[140px] flex flex-col items-center justify-center"
            :class="!selectedDiscount ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 bg-gray-50 hover:border-gray-300'"
          >
            <p class="font-black text-xl">Aucune remise</p>
          </button>
          
          <button 
            v-for="discount in discounts" 
            :key="discount.id"
            @click="selectedDiscount = discount; showDiscountModal = false"
            class="p-6 rounded-2xl border-2 text-center transition-all min-h-[140px] flex flex-col items-center justify-center relative shadow-sm hover:shadow-md"
            :class="selectedDiscount?.id === discount.id ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 hover:border-primary-200'"
          >
            <span class="font-bold text-xl line-clamp-2 px-2 pt-2">{{ discount.title }}</span>
            <span class="px-4 py-1.5 bg-gray-900 text-white rounded-full text-lg font-black absolute top-4 right-4 shadow-sm">-{{ discount.percentage }}%</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Payment Modal -->
    <div v-if="showPaymentModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl">
        <h3 class="text-3xl font-black mb-2 text-gray-900 text-center">Encaissement</h3>
        <p class="text-center text-4xl font-black text-primary-600 mb-8">{{ total.toFixed(2) }} €</p>
        
        <div v-if="paymentMethod !== 'later'" class="grid grid-cols-2 gap-4 mb-8">
          <button 
            @click="paymentMethod = 'cash'"
            class="p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all"
            :class="paymentMethod === 'cash' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 hover:border-gray-300'"
          >
            <Banknote class="w-10 h-10" />
            <span class="font-bold text-lg">Espèce</span>
          </button>
          
          <button 
            @click="paymentMethod = 'card'"
            class="p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all"
            :class="paymentMethod === 'card' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 hover:border-gray-300'"
          >
            <CreditCard class="w-10 h-10" />
            <span class="font-bold text-lg">Carte Bancaire</span>
          </button>
          
          <button 
            @click="paymentMethod = 'later'"
            class="col-span-2 p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all border-gray-100 hover:border-gray-300 text-gray-500"
          >
            <span class="font-bold text-lg">Payer plus tard (Dette)</span>
          </button>
        </div>

        <!-- Debt Selection -->
        <div v-if="paymentMethod === 'later'" class="mb-8 bg-gray-50 p-6 rounded-2xl border border-gray-100">
          <div class="flex items-center justify-between mb-4">
            <h4 class="font-bold text-gray-900 text-lg">Paiement différé</h4>
            <button @click="paymentMethod = 'cash'; isCreatingDebtAccount = false" class="text-primary-600 font-bold text-sm hover:underline">
              Changer de mode
            </button>
          </div>
          
          <div v-if="!isCreatingDebtAccount">
            <label class="block text-sm font-bold text-gray-700 mb-2">Sélectionner un bénéficiaire</label>
            <select 
              v-model="selectedDebtAccount"
              class="w-full h-14 bg-white border-2 border-gray-200 rounded-xl px-4 font-medium focus:border-primary-500 outline-none mb-4 shadow-sm"
            >
              <option :value="null" disabled>Choisir une personne...</option>
              <option v-for="acc in debtAccounts" :key="acc.id" :value="acc">{{ acc.fullName }}</option>
            </select>
            
            <button @click="isCreatingDebtAccount = true" class="w-full py-3 border-2 border-dashed border-gray-300 text-gray-600 font-bold rounded-xl hover:border-primary-500 hover:text-primary-600 transition-colors">
              + Créer un nouveau compte client
            </button>
          </div>
          
          <div v-else class="space-y-4">
            <div>
              <label class="block text-sm font-bold text-gray-700 mb-1">Nom complet *</label>
              <input type="text" v-model="newDebtAccount.fullName" @focus="activeKeyboard = 'name'" readonly class="w-full h-12 bg-white border-2 border-gray-200 rounded-xl px-4 font-medium focus:border-primary-500 outline-none cursor-pointer" placeholder="Ex: Jean Dupont">
            </div>
            <div>
              <label class="block text-sm font-bold text-gray-700 mb-1">Téléphone (Optionnel)</label>
              <input type="text" v-model="newDebtAccount.phone" @focus="activeKeyboard = 'phone'" readonly class="w-full h-12 bg-white border-2 border-gray-200 rounded-xl px-4 font-medium focus:border-primary-500 outline-none cursor-pointer" placeholder="Ex: 06 12 34 56 78">
            </div>
            
            <VirtualKeyboard 
              v-if="activeKeyboard === 'name'" 
              v-model="newDebtAccount.fullName" 
              type="text" 
              @close="activeKeyboard = null" 
            />
            <VirtualKeyboard 
              v-if="activeKeyboard === 'phone'" 
              v-model="newDebtAccount.phone" 
              type="numeric" 
              @close="activeKeyboard = null" 
            />
            
            <button @click="isCreatingDebtAccount = false; activeKeyboard=null" class="text-gray-500 text-sm font-bold hover:underline mt-2">
              Annuler et choisir dans la liste
            </button>
          </div>
        </div>

        <div class="flex gap-4">
          <button 
            @click="showPaymentModal = false; activeKeyboard=null" 
            class="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors text-lg"
            :disabled="submitting"
          >
            Annuler
          </button>
          <button 
            @click="submitOrder"
            class="flex-1 flex justify-center items-center gap-2 py-4 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors text-lg disabled:opacity-50"
            :disabled="submitting || (paymentMethod === 'later' && !isCreatingDebtAccount && !selectedDebtAccount) || (paymentMethod === 'later' && isCreatingDebtAccount && !newDebtAccount.fullName.trim())"
          >
            <Loader2 v-if="submitting" class="w-6 h-6 animate-spin" />
            Valider {{ total.toFixed(2) }} €
          </button>
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
