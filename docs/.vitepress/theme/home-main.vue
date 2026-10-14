<script setup lang="ts">
// The default theme's home, inside the page's one main landmark: its root is a div, so the home had none. config.ts
// puts this in place of `./VPHome.vue`; the original is imported by its full path, which that alias does not match.
import VPHome from 'vitepress/dist/client/theme-default/components/VPHome.vue';
</script>

<template>
  <main>
    <VPHome>
      <template v-for="(_, name) in $slots" #[name]="props">
        <slot :name="name" v-bind="props ?? {}" />
      </template>
    </VPHome>
  </main>
</template>
