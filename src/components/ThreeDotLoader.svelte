<!-- This is just ridiculous. Shame on me -->
<script>
    export let msgText = 'Loading'
</script>

<div class='three-dot-loader'>
    {msgText}
    <span class="first-dot">.</span>
    <span class="second-dot">.</span>
    <span class="third-dot">.</span>
</div>

<style scoped>
    .first-dot {
        animation: visibility 3s linear infinite;
    }
    @keyframes visibility {
        0%, 65% {
            opacity: 1;
        }
        66%, 100% {
            opacity: 0;
        }
    }
    .second-dot {
        animation: visibility2 3s linear infinite;
    }
    @keyframes visibility2 {
        0%, 21%, 66%, 100% {
            opacity: 0;
        }
        22%, 65% {
            opacity: 1;
        }
    }
    .third-dot {
       animation: visibility3 3s linear infinite;
    }
    @keyframes visibility3 {
        0%, 43%, 66%, 100% {
            opacity: 0;
        }
        44%, 65% {
            opacity: 1;
        }
    }
</style>