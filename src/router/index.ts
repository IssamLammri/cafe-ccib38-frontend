import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue'),
      meta: { guest: true }
    },
    {
      path: '/admin/login',
      name: 'AdminLogin',
      component: () => import('@/views/AdminLogin.vue'),
      meta: { guest: true }
    },
    {
      path: '/register',
      name: 'Register',
      component: () => import('@/views/Register.vue'),
      meta: { guest: true }
    },
    {
      path: '/',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'Dashboard',
          component: () => import('@/views/Dashboard.vue'),
          meta: { requireAdmin: true }
        },
        {
          path: 'pos',
          name: 'POS',
          component: () => import('@/views/POS.vue')
        },
        {
          path: 'products',
          name: 'Products',
          component: () => import('@/views/Products.vue'),
          meta: { requireAdmin: true }
        },
        {
          path: 'sellers',
          name: 'Sellers',
          component: () => import('@/views/Sellers.vue'),
          meta: { requireAdmin: true }
        },
        {
          path: 'discounts',
          name: 'Discounts',
          component: () => import('@/views/Discounts.vue'),
          meta: { requireAdmin: true }
        },
        {
          path: 'debts',
          name: 'Debts',
          component: () => import('@/views/Debts.vue')
        },
        {
          path: 'history',
          name: 'History',
          component: () => import('@/views/History.vue')
        }
      ]
    }
  ]
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login');
  } else if (to.meta.guest && authStore.isAuthenticated) {
    if (authStore.isAdmin) {
      next('/');
    } else {
      next('/pos');
    }
  } else if (to.meta.requireAdmin && authStore.isAuthenticated && !authStore.isAdmin) {
    next('/pos');
  } else {
    // If agent tries to go to root (Dashboard), redirect to pos
    if (to.path === '/' && authStore.isAuthenticated && !authStore.isAdmin) {
      next('/pos');
    } else {
      next();
    }
  }
});

export default router;
