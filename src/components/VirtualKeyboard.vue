<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'text', // 'text' or 'numeric'
  }
});

const emit = defineEmits(['update:modelValue', 'close']);

const layoutText = [
  ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
  ['W', 'X', 'C', 'V', 'B', 'N']
];

const layoutNumeric = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['0']
];

const append = (char: string) => {
  emit('update:modelValue', props.modelValue + char);
};

const backspace = () => {
  if (props.modelValue.length > 0) {
    emit('update:modelValue', props.modelValue.slice(0, -1));
  }
};

const clear = () => {
  emit('update:modelValue', '');
};

const addSpace = () => {
  emit('update:modelValue', props.modelValue + ' ');
};
</script>

<template>
  <div class="bg-gray-100 rounded-2xl p-4 shadow-inner mt-4 select-none">
    <div v-if="type === 'text'" class="flex flex-col gap-2">
      <div v-for="(row, rowIndex) in layoutText" :key="rowIndex" class="flex justify-center gap-2">
        <button 
          v-for="key in row" 
          :key="key"
          @click="append(key)"
          class="bg-white hover:bg-gray-50 active:bg-gray-200 text-gray-800 font-bold text-xl rounded-xl w-10 md:w-12 h-12 flex items-center justify-center shadow-sm border border-gray-200"
        >
          {{ key }}
        </button>
      </div>
      <div class="flex justify-center gap-2 mt-1">
        <button 
          @click="clear"
          class="bg-red-100 hover:bg-red-200 active:bg-red-300 text-red-700 font-bold px-4 h-12 rounded-xl flex items-center justify-center shadow-sm border border-red-200"
        >
          Effacer
        </button>
        <button 
          @click="addSpace"
          class="bg-white hover:bg-gray-50 active:bg-gray-200 text-gray-800 font-bold flex-1 max-w-[200px] h-12 rounded-xl flex items-center justify-center shadow-sm border border-gray-200"
        >
          Espace
        </button>
        <button 
          @click="backspace"
          class="bg-white hover:bg-gray-50 active:bg-gray-200 text-gray-800 font-bold px-4 h-12 rounded-xl flex items-center justify-center shadow-sm border border-gray-200"
        >
          ⌫
        </button>
      </div>
    </div>
    
    <div v-if="type === 'numeric'" class="grid grid-cols-3 gap-2 max-w-[300px] mx-auto">
      <button 
        v-for="key in ['1', '2', '3', '4', '5', '6', '7', '8', '9']" 
        :key="key"
        @click="append(key)"
        class="bg-white hover:bg-gray-50 active:bg-gray-200 text-gray-800 font-bold text-2xl h-14 rounded-xl flex items-center justify-center shadow-sm border border-gray-200"
      >
        {{ key }}
      </button>
      <button 
        @click="clear"
        class="bg-red-100 hover:bg-red-200 active:bg-red-300 text-red-700 font-bold text-lg h-14 rounded-xl flex items-center justify-center shadow-sm border border-red-200"
      >
        C
      </button>
      <button 
        @click="append('0')"
        class="bg-white hover:bg-gray-50 active:bg-gray-200 text-gray-800 font-bold text-2xl h-14 rounded-xl flex items-center justify-center shadow-sm border border-gray-200"
      >
        0
      </button>
       <button 
        @click="backspace"
        class="bg-white hover:bg-gray-50 active:bg-gray-200 text-gray-800 font-bold text-xl h-14 rounded-xl flex items-center justify-center shadow-sm border border-gray-200"
      >
        ⌫
      </button>
    </div>
    
    <div class="flex justify-end mt-4 pt-4 border-t border-gray-200">
        <button @click="emit('close')" class="font-bold text-primary-600 bg-primary-50 px-4 py-2 rounded-lg">Fermer le clavier</button>
    </div>
  </div>
</template>
