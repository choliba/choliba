<script setup lang="ts">
// The default theme's 404, inside the page's one main landmark: its root is a div, so the page had none. config.ts
// puts this in place of `../NotFound.vue`; the original is imported by its full path, which that alias does not match.
import NotFound from 'vitepress/dist/client/theme-default/NotFound.vue';
</script>

<template>
  <main>
    <NotFound />
  </main>
</template>
