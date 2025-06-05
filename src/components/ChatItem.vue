<script setup>
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  chat: Object,
  isSelected: Boolean,
  activeMoreMenu: [Number, null],
  isSidebarCollapsed: Boolean
})

const emits = defineEmits(['select', 'rename', 'delete', 'showMore'])

const onSelect = () => {
  emits('select', props.chat)
}

const onRename = () => {
  emits('rename', props.chat)
}

const onDelete = () => {
  emits('delete', props.chat)
}

const onShowMore = () => {
  emits('showMore', props.chat)
}
</script>

<template>
  <div class="chat-item" :class="{ active: isSelected }">
    <div class="chat-item-content">
      <div class="chat-info" @click="onSelect">
        <div class="chat-title">{{ chat.title }}</div>
      </div>
      <div class="chat-actions">
        <button class="more-btn" @click.stop="onShowMore">
          <i class="fas fa-ellipsis"></i>
        </button>
        <div v-show="activeMoreMenu === chat.id" class="more-menu">
          <button class="menu-item" @click.stop="onRename">
            <i class="fas fa-pen"></i>
            重命名
          </button>
          <button class="menu-item delete" @click.stop="onDelete">
            <i class="fas fa-trash"></i>
            删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
