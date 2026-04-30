import { defineStore } from 'pinia';
import api from '@/api/api';
import axios from 'axios';

interface User {
  id: string;
  email: string;
  username: string;
  firstname?: string;
  lastname?: string;
  roles?: string[];
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    token: localStorage.getItem('token'),
    loading: false,
    error: null as string | null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
    fullName: (state) => {
      if (!state.user) return '';
      return `${state.user.firstname || ''} ${state.user.lastname || ''}`.trim();
    },
    isAdmin: (state) => !!state.user?.roles?.includes('ROLE_ADMIN'),
    isAgent: (state) => !!state.user?.roles?.includes('ROLE_AGENT'),
  },

  actions: {
    async fetchUser() {
      if (!this.token) return;
      try {
        const base64Url = this.token.split('.')[1];
        if (base64Url) {
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const payloadJson = decodeURIComponent(window.atob(base64).split('').map(function(c) {
              return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          const payload = JSON.parse(payloadJson);
          
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            this.logout();
            return;
          }

          this.user = {
            id: payload.username,
            email: payload.username,
            username: payload.username,
            firstname: '',
            lastname: '',
            roles: payload.roles || []
          } as User;
        }
      } catch (err) {
        console.error('Failed to parse token:', err);
        this.logout();
      }
    },

    async login(credentials: any) {
      this.loading = true;
      this.error = null;
      try {
        const loginPayload = {
          email: credentials.email,
          password: credentials.password
        };
        
        const response = await axios.post('/api/login_check', loginPayload, {
          headers: { 'Content-Type': 'application/json' }
        });
        
        this.token = response.data.token;
        localStorage.setItem('token', this.token as string);
        
        await this.fetchUser();
      } catch (err: any) {
        this.error = err.response?.data?.message || 'Identifiants incorrects';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async register(userData: any) {
      this.loading = true;
      this.error = null;
      try {
        const payload = {
          email: userData.email,
          plainPassword: userData.plainPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          roles: ["ROLE_AGENT"]
        };
        await api.post('/users', payload);
      } catch (err: any) {
        const errorDetail = err.response?.data?.['hydra:description'] || 
                            err.response?.data?.['detail'] || 
                            'Erreur lors de l’inscription';
        this.error = errorDetail;
        throw err;
      } finally {
        this.loading = false;
      }
    },

    logout() {
      this.user = null;
      this.token = null;
      localStorage.removeItem('token');
    }
  }
});
