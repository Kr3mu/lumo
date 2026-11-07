<!-- brand/kit/lumo-symbol.svg and lumo-symbol-dark-transparent.svg differ only in fill colours, so one copy takes them from theme tokens. -->
<svg class="logo" viewBox="0 0 256 256" aria-hidden="true">
    <circle class="halo" cx="128" cy="166" r="70" />
    <ellipse cx="128" cy="168" rx="34" ry="48" fill="#5cc8ff" />
    <ellipse class="wing" cx="99" cy="114" rx="16" ry="46" transform="rotate(38 99 114)" />
    <ellipse class="wing" cx="157" cy="114" rx="16" ry="46" transform="rotate(-38 157 114)" />
    <ellipse class="body" cx="128" cy="112" rx="25" ry="23" />
    <circle class="body" cx="128" cy="80" r="17" />
    <path
        class="body"
        d="M121.42,59.40A38.00,38.00 0 0 0 100.66,31.85A4.00,4.00 0 0 0 97.15,39.04A30.00,30.00 0 0 1 113.54,60.79A4.00,4.00 0 0 0 121.42,59.40ZM134.58,59.40A38.00,38.00 0 0 1 155.34,31.85A4.00,4.00 0 0 1 158.85,39.04A30.00,30.00 0 0 0 142.46,60.79A4.00,4.00 0 0 1 134.58,59.40Z"
    />
</svg>

<style>
    .logo {
        display: block;
        flex-shrink: 0;
        width: 30px;
        height: 30px;
        align-self: center;
        margin-right: var(--space-1);
    }

    .halo {
        fill: var(--logo-halo);
    }

    .wing {
        fill: var(--logo-wing);
    }

    .body {
        fill: var(--logo-body);
    }
</style>
