<script lang="ts">
    import IPForm from './IPForm.svelte'
    import StylesForm from './StylesForm.svelte'

    export let klass: string = ''
</script>

<div class={'switcher-container' + ' ' + klass}>
    <IPForm />
    <StylesForm />
</div>

<style>
  .switcher-container {
    position: fixed;
    right: 0;
  }
</style>