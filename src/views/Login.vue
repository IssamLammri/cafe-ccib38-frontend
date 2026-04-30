<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import axios from 'axios';
import { Loader2, ArrowLeft, Delete, KeyRound } from 'lucide-vue-next';

const router = useRouter();
const authStore = useAuthStore();

interface Agent {
  id: string | number;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

const agents = ref<Agent[]>([]);
const loadingAgents = ref(true);
const selectedAgent = ref<Agent | null>(null);
const pin = ref('');
const loginError = ref('');

// Fetch list of agents
const fetchAgents = async () => {
  loadingAgents.value = true;
  try {
    // Attempting to fetch users without auth, assuming public access to list or specific endpoint
    const response = await axios.get('/api/users', {
      headers: { 'Accept': 'application/ld+json' }
    });
    
    // API Platform typically returns data in 'member' or 'hydra:member'
    const users = response.data['member'] || response.data['hydra:member'] || response.data || [];
    
    // Filter agents: either they have ROLE_AGENT or we just take everyone as fallback for tests if needed
    agents.value = users.filter((u: any) => u.roles?.includes('ROLE_AGENT'));
    
    // Fallback if no agents found (maybe backend doesn't have ROLE_AGENT yet) - just for dev UX
    if (agents.value.length === 0 && users.length > 0) {
      agents.value = users;
    }
  } catch (error) {
    console.error("Impossible de récupérer les agents. Assurez-vous que l'API autorise la lecture anonyme.", error);
    // Silent fail, UI will show 'Aucun agent'
  } finally {
    loadingAgents.value = false;
  }
};

onMounted(() => {
  fetchAgents();
});

const selectAgent = (agent: Agent) => {
  selectedAgent.value = agent;
  pin.value = '';
  loginError.value = '';
};

const cancelSelection = () => {
  selectedAgent.value = null;
  pin.value = '';
  loginError.value = '';
};

const handleNumber = (num: number) => {
  if (pin.value.length < 6) {
    pin.value += num.toString();
  }
};

const handleDelete = () => {
  if (pin.value.length > 0) {
    pin.value = pin.value.slice(0, -1);
  }
};

const handleClear = () => {
  pin.value = '';
};

// Watcher to automatically trigger login when PIN is exactly 6 digits
watch(pin, async (newPin) => {
  if (newPin.length === 6 && selectedAgent.value) {
    loginError.value = '';
    try {
      await authStore.login({ 
        email: selectedAgent.value.email, 
        password: newPin 
      });
      router.push('/');
    } catch (err: any) {
      loginError.value = "Code PIN incorrect";
      pin.value = ''; // Reset pin on failure
    }
  }
});
</script>

<template>
  <div class="min-h-screen bg-bg-base flex flex-col items-center justify-center p-6">
    <div class="w-full max-w-4xl">
      <!-- Header -->
      <div class="text-center mb-12">
        <div class="w-24 h-24 bg-primary-600 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-xl shadow-primary-600/30">
          <span class="text-4xl font-bold text-white">PV</span>
        </div>
        <h1 class="text-4xl font-black text-gray-900 tracking-tight">Point de Vente</h1>
        <p class="text-gray-500 mt-3 text-xl font-medium">Sélectionnez votre profil ou connectez-vous</p>
      </div>

      <!-- Agent Selection View -->
      <div v-if="!selectedAgent" class="bg-white rounded-[2rem] shadow-xl p-10 border border-gray-100">
        <div v-if="loadingAgents" class="flex flex-col items-center justify-center py-20">
          <Loader2 class="w-12 h-12 animate-spin text-primary-600 mb-4" />
          <p class="text-gray-500 font-medium text-lg">Chargement des agents...</p>
        </div>

        <div v-else-if="agents.length === 0" class="text-center py-16 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
          <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <KeyRound class="w-10 h-10 text-gray-400" />
          </div>
          <h2 class="text-2xl font-bold text-gray-700 mb-2">Aucun agent disponible</h2>
          <p class="text-gray-500 mb-8 max-w-md mx-auto">Veuillez utiliser l'accès administrateur pour configurer le système.</p>
          <router-link to="/admin/login" class="inline-flex items-center px-8 py-4 bg-primary-600 text-white rounded-2xl font-bold text-lg hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/20 shadow-hover disabled:opacity-50">
            Accès Administrateur
          </router-link>
        </div>

        <div v-else>
          <h2 class="text-2xl font-bold text-gray-800 mb-8 text-center">Qui êtes-vous ?</h2>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            <button 
              v-for="agent in agents" 
              :key="agent.id"
              @click="selectAgent(agent)"
              class="flex flex-col items-center p-6 bg-gray-50 rounded-3xl border-2 border-transparent hover:border-primary-600 hover:bg-primary-50 hover:shadow-lg hover:shadow-primary-600/10 transition-all active:scale-95 group"
            >
              <div class="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center text-2xl font-bold text-primary-600 mb-4 border border-gray-100 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                {{ agent.firstName ? agent.firstName.charAt(0).toUpperCase() : agent.email.charAt(0).toUpperCase() }}
              </div>
              <span class="font-bold text-gray-900 text-lg">{{ agent.firstName || agent.email.split('@')[0] }}</span>
              <span class="text-gray-500 text-sm font-medium">{{ agent.lastName }}</span>
            </button>
          </div>
        </div>


      </div>

      <!-- Tactile Numpad View -->
      <div v-else class="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-gray-100 max-w-xl mx-auto flex flex-col relative">
        <button @click="cancelSelection" class="absolute top-6 left-6 p-3 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors z-10">
          <ArrowLeft class="w-8 h-8" />
        </button>

        <div class="p-10 text-center relative bg-gray-50 border-b border-gray-100">
          <h2 class="text-3xl font-bold text-gray-900 mb-2">Bonjour, {{ selectedAgent.firstName || selectedAgent.email.split('@')[0] }}</h2>
          <p class="text-gray-500 font-medium text-lg mb-8">Saisissez votre code PIN (6 caractères)</p>

          <!-- PIN Dots -->
          <div class="flex justify-center gap-4 mb-4">
            <div 
              v-for="i in 6" 
              :key="i"
              class="w-6 h-6 rounded-full transition-all duration-200"
              :class="i <= pin.length ? 'bg-primary-600 scale-110' : 'bg-gray-200'"
            ></div>
          </div>
          
          <p v-if="loginError" class="text-red-500 font-bold h-6 animate-pulse">{{ loginError }}</p>
          <p v-else-if="authStore.loading" class="text-primary-600 font-bold h-6 flex items-center justify-center gap-2">
            <Loader2 class="w-5 h-5 animate-spin" />
            Connexion en cours...
          </p>
          <p v-else class="text-transparent font-bold h-6">Placeholder</p>
        </div>

        <!-- Numpad -->
        <div class="p-8 bg-white grid grid-cols-3 gap-4">
          <button 
            v-for="num in [1, 2, 3, 4, 5, 6, 7, 8, 9]" 
            :key="num"
            @click="handleNumber(num)"
            class="h-20 bg-gray-50 rounded-2xl text-3xl font-black text-gray-800 hover:bg-primary-50 hover:text-primary-700 active:scale-95 transition-all outline-none border border-transparent focus:border-primary-600"
          >
            {{ num }}
          </button>
          
          <button 
            @click="handleClear"
            class="h-20 bg-gray-100 rounded-2xl text-lg font-bold text-gray-500 hover:bg-gray-200 hover:text-gray-700 active:scale-95 transition-all outline-none"
          >
            Effacer
          </button>

          <button 
            @click="handleNumber(0)"
            class="h-20 bg-gray-50 rounded-2xl text-3xl font-black text-gray-800 hover:bg-primary-50 hover:text-primary-700 active:scale-95 transition-all outline-none border border-transparent focus:border-primary-600"
          >
            0
          </button>

          <button 
            @click="handleDelete"
            class="h-20 bg-red-50 rounded-2xl text-xl font-bold flex items-center justify-center text-red-500 hover:bg-red-100 hover:text-red-600 active:scale-95 transition-all outline-none"
          >
            <Delete class="w-8 h-8" />
          </button>
        </div>
      </div>

    </div>
  </div>
</template>
