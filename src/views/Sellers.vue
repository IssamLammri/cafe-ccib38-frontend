<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2,
  Users,
  Loader2,
  X
} from 'lucide-vue-next';
import api from '@/api/api';

interface User {
  id?: number | string;
  '@id'?: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  plainPassword?: string;
  roles?: string[];
}

const sellers = ref<User[]>([]);
const loading = ref(true);
const error = ref('');

// Modal state
const isModalOpen = ref(false);
const isEditing = ref(false);
const isSubmitting = ref(false);
const saveError = ref('');
const deleteError = ref('');
const isDeleting = ref(false);
const sellerToDelete = ref<User | null>(null);

const currentSeller = ref<User>({
  email: '',
  username: '',
  firstName: '',
  lastName: '',
  plainPassword: '',
});

const searchQuery = ref('');

const filteredSellers = computed(() => {
  if (!searchQuery.value) return sellers.value;
  const q = searchQuery.value.toLowerCase();
  return sellers.value.filter(s => 
    s.email.toLowerCase().includes(q) || 
    (s.username && s.username.toLowerCase().includes(q)) ||
    (s.firstName && s.firstName.toLowerCase().includes(q)) ||
    (s.lastName && s.lastName.toLowerCase().includes(q))
  );
});

const fetchSellers = async () => {
  loading.value = true;
  error.value = '';
  try {
    const response = await api.get('/users');
    const allUsers: User[] = response.data['hydra:member'] || response.data['member'] || response.data || [];
    // Only display non-admin users (or those without ROLE_ADMIN in their explicit roles, if provided)
    // Here we'll just display everyone for now, or filter if we can tell.
    // Assuming backend returns everyone.
    sellers.value = allUsers;
  } catch (err: any) {
    error.value = 'Erreur lors du chargement des vendeurs.';
    console.error(err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchSellers();
});

const openAddModal = () => {
  saveError.value = '';
  isEditing.value = false;
  currentSeller.value = {
    email: '',
    username: '',
    firstName: '',
    lastName: '',
    plainPassword: '',
    roles: ['ROLE_AGENT'],
  };
  isModalOpen.value = true;
};

const openEditModal = (seller: User) => {
  saveError.value = '';
  isEditing.value = true;
  currentSeller.value = { ...seller, plainPassword: '' };
  // Ensure roles array exists and has at least one role
  if (!currentSeller.value.roles || currentSeller.value.roles.length === 0) {
    currentSeller.value.roles = ['ROLE_AGENT'];
  }
  isModalOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false;
};

const saveSeller = async () => {
  saveError.value = '';
  if (!currentSeller.value.email || (!isEditing.value && !currentSeller.value.plainPassword)) {
    saveError.value = 'L\'email et le mot de passe sont obligatoires pour un nouveau vendeur.';
    return;
  }

  isSubmitting.value = true;
  try {
    const payload: any = {
      email: currentSeller.value.email,
      username: currentSeller.value.username || currentSeller.value.email,
      firstName: currentSeller.value.firstName,
      lastName: currentSeller.value.lastName,
      roles: currentSeller.value.roles && currentSeller.value.roles.length > 0 ? currentSeller.value.roles : ['ROLE_AGENT'],
    };
    
    if (currentSeller.value.plainPassword) {
      payload.plainPassword = currentSeller.value.plainPassword;
    }

    if (isEditing.value && currentSeller.value.id) {
      const id = currentSeller.value.id;
      await api.patch(`/users/${id}`, payload, {
        headers: {
          'Content-Type': 'application/merge-patch+json'
        }
      });
    } else {
      await api.post('/users', payload);
    }
    await fetchSellers();
    closeModal();
  } catch (err: any) {
    console.error(err);
    if (err.response?.data?.message || err.response?.data?.['hydra:description']) {
       saveError.value = err.response?.data?.message || err.response?.data?.['hydra:description'];
    } else {
       saveError.value = "Erreur lors de l'enregistrement du vendeur.";
    }
  } finally {
    isSubmitting.value = false;
  }
};

const openDeleteConfirm = (seller: User) => {
  deleteError.value = '';
  sellerToDelete.value = seller;
};

const executeDelete = async () => {
  if (!sellerToDelete.value) return;
  
  isDeleting.value = true;
  deleteError.value = '';
  
  try {
    const id = sellerToDelete.value.id;
    await api.delete(`/users/${id}`);
    await fetchSellers();
    sellerToDelete.value = null;
  } catch (err: any) {
    console.error("Delete failed:", err);
    deleteError.value = "Erreur. Impossible de supprimer le vendeur. Il est peut-être lié à des commandes existantes.";
  } finally {
    isDeleting.value = false;
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
          placeholder="Rechercher un vendeur..." 
          class="w-full h-14 bg-white border-2 border-gray-100 rounded-2xl pl-16 pr-6 text-lg focus:border-primary-600 outline-none shadow-sm transition-all"
        />
      </div>
      
      <div class="flex gap-4">
        <button @click="openAddModal" class="flex items-center gap-3 px-8 h-14 bg-primary-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-primary-600/20 hover:bg-primary-700 transition-all">
          <Plus class="w-6 h-6" />
          Ajouter un vendeur
        </button>
      </div>
    </div>

    <!-- Sellers Table -->
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
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider">Vendeur</th>
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider">Email</th>
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider">Rôle</th>
              <th class="px-8 py-6 text-gray-500 font-bold text-sm uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            <tr v-for="seller in filteredSellers" :key="seller.id" class="hover:bg-gray-50/30 transition-colors group">
              <td class="px-8 py-6">
                <div class="flex items-center gap-4">
                  <div class="w-14 h-14 bg-primary-50 rounded-xl flex items-center justify-center">
                    <Users class="w-7 h-7 text-primary-600" />
                  </div>
                  <div>
                    <p class="font-bold text-gray-800 text-lg">
                      {{ (seller.firstName || seller.lastName) ? `${seller.firstName || ''} ${seller.lastName || ''}`.trim() : (seller.username || 'Sans nom') }}
                    </p>
                  </div>
                </div>
              </td>
              <td class="px-8 py-6">
                <span class="text-gray-600 font-medium">{{ seller.email }}</span>
              </td>
              <td class="px-8 py-6">
                <span v-if="seller.roles?.includes('ROLE_ADMIN')" class="px-3 py-1 bg-red-50 text-red-700 rounded-full font-bold text-sm">Administrateur</span>
                <span v-else class="px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-bold text-sm">Vendeur</span>
              </td>
              <td class="px-8 py-6 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click="openEditModal(seller)" class="p-3 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all" title="Modifier">
                    <Edit class="w-6 h-6" />
                  </button>
                  <button @click="openDeleteConfirm(seller)" class="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Supprimer">
                    <Trash2 class="w-6 h-6" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredSellers.length === 0">
              <td colspan="3" class="px-8 py-12 text-center text-gray-500 font-medium text-lg">
                Aucun vendeur trouvé.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div v-if="!loading && !error" class="p-6 border-t border-gray-100 flex items-center justify-between bg-white text-gray-500 font-medium">
        <span>Total: {{ filteredSellers.length }} vendeurs</span>
      </div>
    </div>

    <!-- Seller Modal -->
    <div v-if="isModalOpen" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-full">
        <div class="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 class="text-2xl font-bold text-gray-900">{{ isEditing ? 'Modifier le vendeur' : 'Nouveau vendeur' }}</h3>
          <button @click="closeModal" class="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 rounded-full transition-colors">
            <X class="w-6 h-6" />
          </button>
        </div>
        
        <div class="p-8 space-y-6 overflow-y-auto">
          <div v-if="saveError" class="p-4 bg-red-50 text-red-700 font-bold rounded-xl border border-red-100">
            {{ saveError }}
          </div>

          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Email *</label>
            <input 
              v-model="currentSeller.email"
              type="email" 
              class="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 text-lg focus:bg-white focus:border-primary-500 outline-none transition-colors"
              placeholder="Ex: jean.dupont@epicerie.fr"
            />
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-bold text-gray-700 mb-2">Prénom</label>
              <input 
                v-model="currentSeller.firstName"
                type="text" 
                class="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 text-lg focus:bg-white focus:border-primary-500 outline-none transition-colors"
                placeholder="Ex: Jean"
              />
            </div>
            <div>
              <label class="block text-sm font-bold text-gray-700 mb-2">Nom</label>
              <input 
                v-model="currentSeller.lastName"
                type="text" 
                class="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 text-lg focus:bg-white focus:border-primary-500 outline-none transition-colors"
                placeholder="Ex: Dupont"
              />
            </div>
          </div>
          
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">
              Mot de passe <span v-if="!isEditing">*</span> <span v-else class="font-normal text-gray-500">(Laisser vide pour ne pas modifier)</span>
            </label>
            <input 
              v-model="currentSeller.plainPassword"
              type="password" 
              class="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 text-lg focus:bg-white focus:border-primary-500 outline-none transition-colors"
              placeholder="********"
            />
          </div>

          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Rôle</label>
            <div class="flex gap-4">
              <button 
                @click="currentSeller.roles = ['ROLE_AGENT']"
                class="flex-1 h-12 rounded-xl font-bold border-2 transition-colors flex items-center justify-center gap-2"
                :class="currentSeller.roles?.includes('ROLE_AGENT') && !currentSeller.roles?.includes('ROLE_ADMIN') ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 bg-white text-gray-600 hover:border-primary-200'"
              >
                Vendeur
              </button>
              <button 
                @click="currentSeller.roles = ['ROLE_ADMIN']"
                class="flex-1 h-12 rounded-xl font-bold border-2 transition-colors flex items-center justify-center gap-2"
                :class="currentSeller.roles?.includes('ROLE_ADMIN') ? 'border-red-600 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-600 hover:border-red-200'"
              >
                Administrateur
              </button>
            </div>
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
            @click="saveSeller" 
            class="px-8 py-3.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-all disabled:opacity-50 flex items-center gap-2"
            :disabled="isSubmitting"
          >
            <Loader2 v-if="isSubmitting" class="w-5 h-5 animate-spin" />
            {{ isSubmitting ? 'Enregistrement...' : (isEditing ? 'Mettre à jour' : 'Créer le vendeur') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Confirm Delete Modal -->
    <div v-if="sellerToDelete" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
        <div class="p-6">
          <h3 class="text-xl font-bold text-gray-900 mb-2">Confirmer la suppression</h3>
          <p class="text-gray-600">Voulez-vous vraiment supprimer le vendeur "<span class="font-bold">{{ sellerToDelete.email }}</span>" ?</p>
          <div v-if="deleteError" class="mt-4 p-3 bg-red-50 text-red-700 text-sm font-bold rounded-lg border border-red-100">
            {{ deleteError }}
          </div>
        </div>
        <div class="p-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
          <button 
            @click="sellerToDelete = null"
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

