<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { Mail, Lock, User, Loader2 } from 'lucide-vue-next';

const router = useRouter();
const authStore = useAuthStore();

const form = ref({
  email: '',
  password: '', // will be mapped to plainPassword
  firstName: '',
  lastName: ''
});

const handleSubmit = async () => {
  try {
    await authStore.register({
      email: form.value.email,
      plainPassword: form.value.password,
      firstName: form.value.firstName,
      lastName: form.value.lastName
    });
    await authStore.login({ email: form.value.email, password: form.value.password });
    router.push('/');
  } catch (err) {
    console.log(err)
    console.log('isssam lalmamai')
    // Error handled in store
  }
};
</script>

<template>
  <div class="min-h-screen bg-bg-base flex items-center justify-center p-6">
    <div class="w-full max-w-2xl bg-white rounded-3xl shadow-xl p-10 border border-gray-100">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900">Créer un compte</h1>
        <p class="text-gray-500 mt-2 text-lg">Enregistrez un nouveau vendeur</p>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-6">
        <div v-if="authStore.error" class="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-center font-medium">
          {{ authStore.error }}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2 ml-4">Prénom</label>
            <input 
              v-model="form.firstName"
              type="text" 
              required
              class="w-full h-16 bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 text-xl focus:border-primary-600 focus:bg-white outline-none transition-all"
              placeholder="Ex: Jean"
            />
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2 ml-4">Nom</label>
            <input 
              v-model="form.lastName"
              type="text" 
              required
              class="w-full h-16 bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 text-xl focus:border-primary-600 focus:bg-white outline-none transition-all"
              placeholder="Ex: Dupont"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2 ml-4">Email</label>
          <div class="relative group">
            <Mail class="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 group-focus-within:text-primary-600 transition-colors" />
            <input 
              v-model="form.email"
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
              v-model="form.password"
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
          Créer le compte
        </button>

        <div class="text-center mt-6">
          <p class="text-gray-500 text-lg">
            Déjà un compte ?
            <router-link to="/admin/login" class="text-primary-600 font-bold hover:underline">Se connecter (Admin)</router-link>
            ou
            <router-link to="/login" class="text-primary-600 font-bold hover:underline">Mode Tactile</router-link>
          </p>
        </div>
      </form>
    </div>
  </div>
</template>
