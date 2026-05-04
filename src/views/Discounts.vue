<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2,
  Tag,
  Loader2,
  X,
  CheckCircle,
  XCircle
} from 'lucide-vue-next';
import api from '@/api/api';
import VirtualKeyboard from '@/components/VirtualKeyboard.vue';

interface Discount {
  id?: number | string;
  '@id'?: string;
  title: string;
  percentage: number;
  active: boolean;
}

const discounts = ref<Discount[]>([]);
const loading = ref(true);
const error = ref('');

// Modal state
const isModalOpen = ref(false);
const isEditing = ref(false);
const isSubmitting = ref(false);
const saveError = ref('');
const deleteError = ref('');
const isDeleting = ref(false);
const discountToDelete = ref<Discount | null>(null);

const currentDiscount = ref<Discount>({
  title: '',
  percentage: 0,
  active: true,
});

const searchQuery = ref('');
const activeKeyboard = ref<'title' | 'percentage' | 'search' | null>(null);

const filteredDiscounts = computed(() => {
  if (!searchQuery.value) return discounts.value;
  const q = searchQuery.value.toLowerCase();
  return discounts.value.filter(d => 
    d.title.toLowerCase().includes(q) || 
    d.percentage.toString().includes(q)
  );
});

const fetchDiscounts = async () => {
  loading.value = true;
  error.value = '';
  try {
    const response = await api.get('/discount_beneficiaries?pagination=false');
    const items: Discount[] = response.data['hydra:member'] || response.data['member'] || response.data || [];
    discounts.value = items;
  } catch (err: any) {
    error.value = 'Erreur lors du chargement des réductions.';
    console.error(err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchDiscounts();
});

const openAddModal = () => {
  saveError.value = '';
  isEditing.value = false;
  currentDiscount.value = {
    title: '',
    percentage: 0,
    active: true,
  };
  activeKeyboard.value = null;
  isModalOpen.value = true;
};

const openEditModal = (discount: Discount) => {
  saveError.value = '';
  isEditing.value = true;
  currentDiscount.value = { ...discount };
  activeKeyboard.value = null;
  isModalOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false;
  activeKeyboard.value = null;
};

const saveDiscount = async () => {
  saveError.value = '';
  if (!currentDiscount.value.title.trim()) {
    saveError.value = 'Le nom de la réduction est obligatoire.';
    return;
  }
  if (currentDiscount.value.percentage < 0 || currentDiscount.value.percentage > 100) {
    saveError.value = 'Le pourcentage doit être compris entre 0 et 100.';
    return;
  }

  isSubmitting.value = true;
  try {
    const payload = {
      title: currentDiscount.value.title,
      percentage: Number(currentDiscount.value.percentage),
      active: currentDiscount.value.active,
    };

    if (isEditing.value && currentDiscount.value.id) {
      const id = currentDiscount.value.id;
      await api.patch(`/discount_beneficiaries/${id}`, payload, {
        headers: {
          'Content-Type': 'application/merge-patch+json'
        }
      });
    } else {
      await api.post('/discount_beneficiaries', payload);
    }
    await fetchDiscounts();
    closeModal();
  } catch (err: any) {
    console.error(err);
    if (err.response?.data?.message || err.response?.data?.['hydra:description']) {
       saveError.value = err.response?.data?.message || err.response?.data?.['hydra:description'];
    } else {
       saveError.value = "Erreur lors de l'enregistrement de la réduction.";
    }
  } finally {
    isSubmitting.value = false;
  }
};

const openDeleteConfirm = (discount: Discount) => {
  deleteError.value = '';
  discountToDelete.value = discount;
};

const executeDelete = async () => {
  if (!discountToDelete.value) return;
  
  isDeleting.value = true;
  deleteError.value = '';
  
  try {
    const id = discountToDelete.value.id;
    await api.delete(`/discount_beneficiaries/${id}`);
    await fetchDiscounts();
    discountToDelete.value = null;
  } catch (err: any) {
    console.error("Delete failed:", err);
    deleteError.value = "Erreur. Impossible de supprimer cette réduction.";
  } finally {
    isDeleting.value = false;
  }
};

const toggleActiveStatus = async (discount: Discount) => {
  try {
    const id = discount.id;
    await api.patch(`/discount_beneficiaries/${id}`, {
      active: !discount.active
    }, {
        headers: {
          'Content-Type': 'application/merge-patch+json'
        }
    });
    discount.active = !discount.active;
  } catch (err) {
    console.error(err);
    alert("Erreur lors de la mise à jour du statut.");
  }
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
          @focus="activeKeyboard = 'search'"
          placeholder="Rechercher une réduction..." 
          class="w-full h-14 bg-white border-2 border-gray-100 rounded-2xl pl-16 pr-6 text-lg focus:border-primary-600 outline-none shadow-sm transition-all"
          readonly
        />
      </div>
      
      <div class="flex gap-4">
        <button @click="openAddModal" class="flex items-center gap-3 px-8 h-14 bg-primary-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-primary-600/20 hover:bg-primary-700 transition-all">
          <Plus class="w-6 h-6" />
          Créer une réduction
        </button>
      </div>
    </div>
    
    <div class="px-8" v-if="activeKeyboard === 'search'">
       <VirtualKeyboard 
          v-model="searchQuery" 
          type="text" 
          @close="activeKeyboard = null" 
        />
    </div>

    <!-- Discounts Table -->
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
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider">Réduction</th>
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider">Valeur (%)</th>
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider">Statut</th>
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            <tr v-for="discount in filteredDiscounts" :key="discount.id" class="hover:bg-gray-50/30 transition-colors group">
              <td class="px-8 py-6">
                <div class="flex items-center gap-4">
                  <div class="w-14 h-14 bg-primary-50 rounded-xl flex items-center justify-center">
                    <Tag class="w-7 h-7 text-primary-600" />
                  </div>
                  <div>
                    <p class="font-bold text-gray-800 text-lg">
                      {{ discount.title }}
                    </p>
                  </div>
                </div>
              </td>
              <td class="px-8 py-6">
                <span class="px-4 py-1.5 bg-gray-100 text-gray-800 rounded-full font-black text-lg">-{{ discount.percentage }}%</span>
              </td>
              <td class="px-8 py-6">
                 <button 
                    @click="toggleActiveStatus(discount)"
                    class="px-4 py-1.5 rounded-full font-bold text-sm flex items-center gap-2 transition-colors border-2"
                    :class="discount.active ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'"
                 >
                    <CheckCircle v-if="discount.active" class="w-4 h-4" />
                    <XCircle v-else class="w-4 h-4" />
                    {{ discount.active ? 'Actif' : 'Inactif' }}
                 </button>
              </td>
              <td class="px-8 py-6 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click="openEditModal(discount)" class="p-3 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all" title="Modifier">
                    <Edit class="w-6 h-6" />
                  </button>
                  <button @click="openDeleteConfirm(discount)" class="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Supprimer">
                    <Trash2 class="w-6 h-6" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredDiscounts.length === 0">
              <td colspan="4" class="px-8 py-12 text-center text-gray-500 font-medium text-lg">
                Aucune réduction trouvée.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div v-if="!loading && !error" class="p-6 border-t border-gray-100 flex items-center justify-between bg-white text-gray-500 font-medium">
        <span>Total: {{ filteredDiscounts.length }} réductions</span>
      </div>
    </div>

    <!-- Discount Modal -->
    <div v-if="isModalOpen" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-full">
        <div class="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 class="text-2xl font-bold text-gray-900">{{ isEditing ? 'Modifier la réduction' : 'Nouvelle réduction' }}</h3>
          <button @click="closeModal" class="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 rounded-full transition-colors">
            <X class="w-6 h-6" />
          </button>
        </div>
        
        <div class="p-8 space-y-6 overflow-y-auto flex-1">
          <div v-if="saveError" class="p-4 bg-red-50 text-red-700 font-bold rounded-xl border border-red-100">
            {{ saveError }}
          </div>

          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Nom de la réduction *</label>
            <input 
              v-model="currentDiscount.title"
              type="text" 
              @focus="activeKeyboard = 'title'"
              class="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 text-lg focus:bg-white focus:border-primary-500 outline-none transition-colors"
              placeholder="Ex: Famille"
              readonly
            />
          </div>
          
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Pourcentage de réduction (%) *</label>
            <div class="relative">
              <input 
                :value="currentDiscount.percentage"
                type="text" 
                @focus="activeKeyboard = 'percentage'"
                class="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-xl pl-4 pr-12 text-lg focus:bg-white focus:border-primary-500 outline-none transition-colors"
                placeholder="Ex: 50"
                readonly
              />
              <span class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
            </div>
          </div>
          
          <div class="flex items-center gap-3 mt-4">
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="currentDiscount.active" class="sr-only peer">
              <div class="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
            <span class="font-bold text-gray-700">Activer cette réduction</span>
          </div>
          
          <VirtualKeyboard 
            v-if="activeKeyboard === 'title'" 
            v-model="currentDiscount.title" 
            type="text" 
            @close="activeKeyboard = null" 
          />
          <VirtualKeyboard 
            v-if="activeKeyboard === 'percentage'" 
            :modelValue="currentDiscount.percentage ? String(currentDiscount.percentage) : ''" 
            @update:modelValue="(val: string) => currentDiscount.percentage = val ? Number(val) : 0"
            type="numeric" 
            @close="activeKeyboard = null" 
          />
          
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
            @click="saveDiscount" 
            class="px-8 py-3.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-all disabled:opacity-50 flex items-center gap-2"
            :disabled="isSubmitting"
          >
            <Loader2 v-if="isSubmitting" class="w-5 h-5 animate-spin" />
            {{ isSubmitting ? 'Enregistrement...' : (isEditing ? 'Mettre à jour' : 'Créer la réduction') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Confirm Delete Modal -->
    <div v-if="discountToDelete" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
        <div class="p-6">
          <h3 class="text-xl font-bold text-gray-900 mb-2">Confirmer la suppression</h3>
          <p class="text-gray-600">Voulez-vous vraiment supprimer la réduction "<span class="font-bold">{{ discountToDelete.title }}</span>" ?</p>
          <div v-if="deleteError" class="mt-4 p-3 bg-red-50 text-red-700 text-sm font-bold rounded-lg border border-red-100">
            {{ deleteError }}
          </div>
        </div>
        <div class="p-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
          <button 
            @click="discountToDelete = null"
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
