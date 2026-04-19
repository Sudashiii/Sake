export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

function generateId(): string {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // crypto.randomUUID is only available in secure contexts (HTTPS/localhost).
    // Fall back to getRandomValues which works over plain HTTP too.
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export class ToastStore {
    toasts = $state<Toast[]>([]);

    constructor() { }

    add(message: string, type: ToastType = 'info', duration: number = 3000) {
        const id = generateId();
        const toast: Toast = { id, message, type, duration };
        this.toasts.push(toast);

        if (duration > 0) {
            setTimeout(() => {
                this.remove(id);
            }, duration);
        }
    }

    remove(id: string) {
        const index = this.toasts.findIndex((t) => t.id === id);
        if (index !== -1) {
            this.toasts.splice(index, 1);
        }
    }
}

export const toastStore = new ToastStore();
