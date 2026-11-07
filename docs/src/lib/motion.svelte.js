export function reducedMotion() {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const easeOut = (v) => 1 - (1 - v) ** 3;

// Drives a diagram's progress t from 0 to 1. t rests at 1, so a diagram that never animates
// (reduced motion, hidden tab, thumbnail capture) still shows its final state.
export class Player {
    t = $state(1);
    #raf = 0;

    play = (duration) => {
        this.stop();
        if (reducedMotion()) {
            this.t = 1;
            return;
        }
        let start;
        const step = (now) => {
            start ??= now;
            const p = Math.min(1, (now - start) / duration);
            this.t = p;
            if (p < 1) this.#raf = requestAnimationFrame(step);
        };
        this.#raf = requestAnimationFrame(step);
    };

    stop = () => cancelAnimationFrame(this.#raf);
}
