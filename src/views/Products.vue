<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2,
  Box,
  Loader2,
  X
} from 'lucide-vue-next';
import api from '@/api/api';

interface Product {
  id?: number | string;
  '@id'?: string;
  name: string;
  category: string;
  priceCents: number;
  active: boolean;
}

const products = ref<Product[]>([]);
const loading = ref(true);
const error = ref('');

// Modal state
const isModalOpen = ref(false);
const isEditing = ref(false);
const isSubmitting = ref(false);
const saveError = ref('');
const deleteError = ref('');
const isDeleting = ref(false);
const productToDelete = ref<Product | null>(null);

const currentProduct = ref<Product>({
  name: '',
  category: '',
  priceCents: 0,
  active: true,
});

const searchQuery = ref('');

const filteredProducts = computed(() => {
  if (!searchQuery.value) return products.value;
  const q = searchQuery.value.toLowerCase();
  return products.value.filter(p => 
    p.name.toLowerCase().includes(q) || 
    p.category.toLowerCase().includes(q)
  );
});

const fetchProducts = async () => {
  loading.value = true;
  error.value = '';
  try {
    const response = await api.get('/products');
    products.value = response.data['hydra:member'] || response.data['member'] || response.data || [];
  } catch (err: any) {
    error.value = 'Erreur lors du chargement des produits.';
    console.error(err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchProducts();
});

const openAddModal = () => {
  saveError.value = '';
  isEditing.value = false;
  currentProduct.value = {
    name: '',
    category: '',
    priceCents: 0,
    active: true,
  };
  isModalOpen.value = true;
};

const openEditModal = (product: Product) => {
  saveError.value = '';
  isEditing.value = true;
  currentProduct.value = { ...product };
  isModalOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false;
};

const saveProduct = async () => {
  saveError.value = '';
  if (!currentProduct.value.name || !currentProduct.value.category || currentProduct.value.priceCents < 0) {
    saveError.value = 'Veuillez remplir tous les champs correctement.';
    return;
  }

  isSubmitting.value = true;
  try {
    if (isEditing.value && currentProduct.value.id) {
      const id = currentProduct.value.id;
      // Filter out properties that shouldn't be sent
      const { '@id': _, '@context': __, '@type': ___, id: ____, ...payload } = currentProduct.value as any;
      await api.patch(`/products/${id}`, payload, {
        headers: {
          'Content-Type': 'application/merge-patch+json'
        }
      });
    } else {
      const { id: _, ...payload } = currentProduct.value as any;
      await api.post('/products', payload);
    }
    await fetchProducts();
    closeModal();
  } catch (err: any) {
    console.error(err);
    saveError.value = "Erreur lors de l'enregistrement du produit.";
  } finally {
    isSubmitting.value = false;
  }
};

const openDeleteConfirm = (product: Product) => {
  deleteError.value = '';
  productToDelete.value = product;
};

const executeDelete = async () => {
  if (!productToDelete.value) return;
  
  isDeleting.value = true;
  deleteError.value = '';
  
  try {
    const id = productToDelete.value.id;
    await api.delete(`/products/${id}`);
    await fetchProducts();
    productToDelete.value = null;
  } catch (err: any) {
    // Si lié à une commande, on désactive par défaut au lieu de supprimer
    try {
      const id = productToDelete.value.id;
      const productName = productToDelete.value.name;
      await api.patch(`/products/${id}`, { active: false }, {
        headers: {
          'Content-Type': 'application/merge-patch+json'
        }
      });
      await fetchProducts();
      productToDelete.value = null;
      alert(`Le produit "${productName}" a été désactivé au lieu d'être supprimé, car il est lié à des commandes existantes.`);
    } catch (patchErr) {
      console.error("Delete and Patch failed:", patchErr);
      deleteError.value = "Erreur. Impossible de supprimer ou de désactiver le produit.";
    }
  } finally {
    isDeleting.value = false;
  }
};

const getStatusClass = (active: boolean) => {
  return active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
};
</script>

<template>
  <div class="space-y-8 h-full flex flex-col">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 px-8 pt-8">
      <div class="relative flex-1 max-w-lg group">
        <Search class="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 group-focus-within:text-primary-600 transition-colors" />
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="Rechercher un produit..." 
          class="w-full h-14 bg-white border-2 border-gray-100 rounded-2xl pl-16 pr-6 text-lg focus:border-primary-600 outline-none shadow-sm transition-all"
        />
      </div>
      
      <div class="flex gap-4">
        <button @click="openAddModal" class="flex items-center gap-3 px-8 h-14 bg-primary-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-primary-600/20 hover:bg-primary-700 transition-all">
          <Plus class="w-6 h-6" />
          Ajouter un produit
        </button>
      </div>
    </div>

    <!-- Products Table -->
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
            <tr class="bg-gray-50/50 border-b border-gray-100 sticky top-0 backdrop-blur-md">
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider">Produit</th>
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider">Catégorie</th>
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider">Prix</th>
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider">Statut</th>
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            <tr v-for="product in filteredProducts" :key="product.id" class="hover:bg-gray-50/30 transition-colors group">
              <td class="px-8 py-6">
                <div class="flex items-center gap-4">
                  <div class="w-14 h-14 bg-primary-50 rounded-xl flex items-center justify-center">
                    <Box class="w-7 h-7 text-primary-600" />
                  </div>
                  <div>
                    <p class="font-bold text-gray-800 text-lg">{{ product.name }}</p>
                  </div>
                </div>
              </td>
              <td class="px-8 py-6">
                <span class="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-full font-bold">{{ product.category }}</span>
              </td>
              <td class="px-8 py-6 font-black text-gray-900 text-lg">
                {{ (product.priceCents / 100).toFixed(2) }} €
              </td>
              <td class="px-8 py-6">
                <span 
                  class="px-4 py-1.5 rounded-full font-bold text-sm"
                  :class="getStatusClass(product.active)"
                >
                  {{ product.active ? 'Actif' : 'Inactif' }}
                </span>
              </td>
              <td class="px-8 py-6 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click="openEditModal(product)" class="p-3 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all" title="Modifier">
                    <Edit class="w-6 h-6" />
                  </button>
                  <button @click="openDeleteConfirm(product)" class="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Supprimer">
                    <Trash2 class="w-6 h-6" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredProducts.length === 0">
              <td colspan="5" class="px-8 py-12 text-center text-gray-500 font-medium text-lg">
                Aucun produit trouvé.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div v-if="!loading && !error" class="p-6 border-t border-gray-100 flex items-center justify-between bg-white text-gray-500 font-medium">
        <span>Total: {{ filteredProducts.length }} produits</span>
      </div>
    </div>

    <!-- Product Modal -->
    <div v-if="isModalOpen" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-full">
        <div class="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 class="text-2xl font-bold text-gray-900">{{ isEditing ? 'Modifier le produit' : 'Nouveau produit' }}</h3>
          <button @click="closeModal" class="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 rounded-full transition-colors">
            <X class="w-6 h-6" />
          </button>
        </div>
        
        <div class="p-8 space-y-6 overflow-y-auto">
          <div v-if="saveError" class="p-4 bg-red-50 text-red-700 font-bold rounded-xl border border-red-100">
            {{ saveError }}
          </div>

          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Nom du produit *</label>
            <input 
              v-model="currentProduct.name"
              type="text" 
              class="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 text-lg focus:bg-white focus:border-primary-500 outline-none transition-colors"
              placeholder="Ex: Café Crème"
            />
          </div>
          
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Catégorie *</label>
            <input 
              v-model="currentProduct.category"
              type="text" 
              class="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 text-lg focus:bg-white focus:border-primary-500 outline-none transition-colors"
              placeholder="Ex: Boissons"
            />
          </div>
          
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Prix (en centimes) *</label>
            <div class="flex gap-4 items-center">
              <input 
                v-model.number="currentProduct.priceCents"
                type="number" 
                min="0"
                class="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 text-lg focus:bg-white focus:border-primary-500 outline-none transition-colors"
                placeholder="Ex: 250 (pour 2.50 €)"
              />
              <div class="text-gray-500 font-bold w-24 text-right">
                {{ (currentProduct.priceCents / 100).toFixed(2) }} €
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-2 font-medium">Entrez le montant en centimes d'euros. Ex: 250 = 2.50 €.</p>
          </div>
          
          <div class="flex items-center gap-3 mt-4">
            <input 
              type="checkbox" 
              id="activeStatus" 
              v-model="currentProduct.active"
              class="w-6 h-6 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label for="activeStatus" class="font-bold text-gray-700">Produit Actif</label>
          </div>
        </div>
        
        <div class="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-4">
          <button 
            @click="closeModal" 
            class="px-8 py-3.5 bg-white border-2 border-gray-200 text-gray-700 font-bold rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors"
            :disabled="isSubmitting"
          >
            Annuler
          </button>
          <button 
            @click="saveProduct" 
            class="px-8 py-3.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-all disabled:opacity-50 flex items-center gap-2"
            :disabled="isSubmitting"
          >
            <Loader2 v-if="isSubmitting" class="w-5 h-5 animate-spin" />
            {{ isSubmitting ? 'Enregistrement...' : (isEditing ? 'Mettre à jour' : 'Créer le produit') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Confirm Delete Modal -->
    <div v-if="productToDelete" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
        <div class="p-6">
          <h3 class="text-xl font-bold text-gray-900 mb-2">Confirmer la suppression</h3>
          <p class="text-gray-600">Voulez-vous vraiment supprimer le produit "<span class="font-bold">{{ productToDelete.name }}</span>" ?</p>
          <p class="text-sm text-amber-600 mt-2 font-medium">Note : S'il a déjà été vendu, il est préférable de le désactiver (le rendre inactif) plutôt que de le supprimer.</p>
          <div v-if="deleteError" class="mt-4 p-3 bg-red-50 text-red-700 text-sm font-bold rounded-lg border border-red-100">
            {{ deleteError }}
          </div>
        </div>
        <div class="p-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
          <button 
            @click="productToDelete = null"
            class="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button 
            @click="executeDelete"
            class="px-5 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors flex items-center gap-2"
            :disabled="isDeleting"
          >
            <Loader2 v-if="isDeleting" class="w-4 h-4 animate-spin" />
            Supprimer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
