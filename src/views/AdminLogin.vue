<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { Mail, Lock, Loader2 } from 'lucide-vue-next';

const router = useRouter();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');

const handleSubmit = async () => {
  try {
    await authStore.login({ email: email.value, password: password.value });
    router.push('/');
  } catch (err) {
    // Error handled in store
  }
};
</script>

<template>
  <div class="min-h-screen bg-bg-base flex items-center justify-center p-6">
    <div class="w-full max-w-md bg-white rounded-3xl shadow-xl p-10 border border-gray-100">
      <div class="text-center mb-10">
        <img src="https://www.ccib38.fr/wp-content/uploads/2025/05/cropped-logoccib38-3-1.png" alt="CCIB38" class="h-20 mx-auto mb-6 object-contain" />
        <h1 class="text-3xl font-bold text-gray-900">Connexion</h1>
        <p class="text-gray-500 mt-2 text-lg">Caisse Enregistreuse Tactile</p>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-6">
        <div v-if="authStore.error" class="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-center font-medium">
          {{ authStore.error }}
        </div>

        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2 ml-4">Email</label>
          <div class="relative group">
            <Mail class="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 group-focus-within:text-primary-600 transition-colors" />
            <input 
              v-model="email"
              type="email" 
              required
              class="w-full h-16 bg-gray-50 border-2 border-gray-100 rounded-2xl pl-16 pr-6 text-xl focus:border-primary-600 focus:bg-white outline-none transition-all"
              placeholder="votre@email.com"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2 ml-4">Mot de passe</label>
          <div class="relative group">
            <Lock class="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 group-focus-within:text-primary-600 transition-colors" />
            <input 
              v-model="password"
              type="password" 
              required
              class="w-full h-16 bg-gray-50 border-2 border-gray-100 rounded-2xl pl-16 pr-6 text-xl focus:border-primary-600 focus:bg-white outline-none transition-all"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button 
          type="submit" 
          :disabled="authStore.loading"
          class="w-full h-16 bg-primary-600 text-white rounded-2xl text-xl font-bold hover:bg-primary-700 active:scale-[0.98] transition-all flex items-center justify-center shadow-lg shadow-primary-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Loader2 v-if="authStore.loading" class="w-6 h-6 animate-spin mr-2" />
          Se connecter
        </button>

        <div class="text-center mt-8 space-y-4">
          <p class="text-gray-500 text-lg">
            Pas encore de compte ?
            <router-link to="/register" class="text-primary-600 font-bold hover:underline">S'inscrire</router-link>
          </p>
          <p class="text-gray-500 text-lg">
            <router-link to="/login" class="text-primary-600 font-bold hover:underline">Retour au mode tactile</router-link>
          </p>
        </div>
      </form>
    </div>
  </div>
</template>
