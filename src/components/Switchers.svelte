<script lang="ts">
    import IPForm from './IPForm.svelte'
    import StylesForm from './StylesForm.svelte'
</script>

<div class="switcher-container">
    <IPForm />
    <StylesForm />
</div>

<style>
  .switcher-container {
    position: fixed;
    right: 0;
  }
</style>