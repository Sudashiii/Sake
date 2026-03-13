export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

export class ToastStore {
    toasts = $state<Toast[]>([]);

    constructor() { }

    add(message: string, type: ToastType = 'info', duration: number = 3000) {
        const id = crypto.randomUUID();
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
