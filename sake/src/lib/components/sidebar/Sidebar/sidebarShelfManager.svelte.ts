import { shelfStore } from '$lib/client/stores/shelfStore.svelte';
import { toastStore } from '$lib/client/stores/toastStore.svelte';
import { ZUI } from '$lib/client/zui';
import type { LibraryShelf } from '$lib/types/Library/Shelf';
import type { RuleGroup } from '$lib/types/Library/ShelfRule';
import { countRuleConditions } from '$lib/types/Library/ShelfRule';

const EMOJI_OPTIONS = [
	'📚',
	'⭐',
	'🚀',
	'📌',
	'🔥',
	'💎',
	'🎯',
	'📖',
	'🌙',
	'🎨',
	'💡',
	'🏆',
	'❤️',
	'🌊',
	'⚡',
	'🦋'
];
const SHELF_REORDER_LONG_PRESS_MS = 360;
const SHELF_DRAG_CANCEL_DISTANCE_PX = 8;

type ShelfMenuPosition = { top: number; left: number };

interface SidebarShelfManagerOptions {
	getSelectedShelfId: () => number | null;
	onSelectedShelfRemoved: () => Promise<void> | void;
}

export class SidebarShelfManager {
	readonly emojiOptions = EMOJI_OPTIONS;

	shelvesExpanded = $state(true);
	isMutatingShelves = $state(false);
	showCreateShelf = $state(false);
	newShelfName = $state('');
	newShelfIcon = $state('📚');
	showCreateEmojiPicker = $state(false);
	editingShelfId = $state<number | null>(null);
	editShelfName = $state('');
	editShelfIcon = $state('📚');
	showEditEmojiPicker = $state(false);
	shelfMenuId = $state<number | null>(null);
	shelfMenuPos = $state<ShelfMenuPosition | null>(null);
	showDeleteShelfModal = $state(false);
	pendingDeleteShelfId = $state<number | null>(null);
	rulesModalShelfId = $state<number | null>(null);
	isSavingShelfRules = $state(false);
	isReorderingShelves = $state(false);
	draggingShelfId = $state<number | null>(null);
	shelfDragOverId = $state<number | null>(null);

	private pressedShelfId: number | null = null;
	private pressedPointerId: number | null = null;
	private pressedStartX = 0;
	private pressedStartY = 0;
	private shelfPressTimer: ReturnType<typeof setTimeout> | null = null;
	private shelfOrderBeforeDrag: LibraryShelf[] | null = null;
	private blockShelfClickUntil = 0;

	constructor(private readonly options: SidebarShelfManagerOptions) {}

	get shelves(): LibraryShelf[] {
		return shelfStore.shelves;
	}

	getShelfRuleCount = (shelf: LibraryShelf): number => {
		return countRuleConditions(shelf.ruleGroup);
	};

	loadShelves = async (): Promise<void> => {
		if (this.draggingShelfId !== null) {
			return;
		}
		const result = await shelfStore.load();
		if (!result.ok) {
			return;
		}
		const selectedShelfId = this.options.getSelectedShelfId();
		if (
			selectedShelfId !== null &&
			!this.shelves.some((shelf) => shelf.id === selectedShelfId)
		) {
			await this.options.onSelectedShelfRemoved();
		}
	};

	startCreateShelf = (): void => {
		if (this.isReorderingShelves || this.draggingShelfId !== null) {
			return;
		}
		this.showCreateShelf = true;
		this.newShelfName = '';
		this.newShelfIcon = '📚';
		this.showCreateEmojiPicker = false;
		this.editingShelfId = null;
	};

	cancelCreateShelf = (): void => {
		this.showCreateShelf = false;
		this.newShelfName = '';
		this.showCreateEmojiPicker = false;
	};

	handleCreateShelf = async (): Promise<void> => {
		const name = this.newShelfName.trim();
		if (!name || this.isMutatingShelves || this.isReorderingShelves) {
			return;
		}
		this.isMutatingShelves = true;
		const result = await ZUI.createLibraryShelf({ name, icon: this.newShelfIcon });
		this.isMutatingShelves = false;
		if (!result.ok) {
			toastStore.add(`Failed to create shelf: ${result.error.message}`, 'error');
			return;
		}
		this.showCreateShelf = false;
		this.closeAllShelfMenus();
		await shelfStore.reload();
		toastStore.add(`Shelf "${result.value.shelf.name}" created`, 'success');
	};

	startRenameShelf = (shelf: LibraryShelf): void => {
		if (this.draggingShelfId !== null || this.isReorderingShelves) {
			return;
		}
		this.editingShelfId = shelf.id;
		this.editShelfName = shelf.name;
		this.editShelfIcon = shelf.icon;
		this.showEditEmojiPicker = false;
		this.shelfMenuId = null;
		this.shelfMenuPos = null;
	};

	cancelRenameShelf = (): void => {
		this.editingShelfId = null;
		this.editShelfName = '';
		this.editShelfIcon = '📚';
		this.showEditEmojiPicker = false;
	};

	handleRenameShelf = async (shelfId: number): Promise<void> => {
		const name = this.editShelfName.trim();
		if (!name || this.isMutatingShelves || this.isReorderingShelves) {
			return;
		}
		this.isMutatingShelves = true;
		const result = await ZUI.updateLibraryShelf(shelfId, { name, icon: this.editShelfIcon });
		this.isMutatingShelves = false;
		if (!result.ok) {
			toastStore.add(`Failed to rename shelf: ${result.error.message}`, 'error');
			return;
		}
		const updatedName = result.value.shelf.name;
		this.cancelRenameShelf();
		await shelfStore.reload();
		toastStore.add(`Shelf renamed to "${updatedName}"`, 'success');
	};

	requestDeleteShelf = (shelf: LibraryShelf): void => {
		this.pendingDeleteShelfId = shelf.id;
		this.showDeleteShelfModal = true;
		this.shelfMenuId = null;
		this.shelfMenuPos = null;
	};

	cancelDeleteShelf = (): void => {
		this.showDeleteShelfModal = false;
		this.pendingDeleteShelfId = null;
	};

	confirmDeleteShelf = async (): Promise<void> => {
		if (
			this.pendingDeleteShelfId === null ||
			this.isMutatingShelves ||
			this.isReorderingShelves
		) {
			return;
		}
		const shelf = this.shelves.find((item) => item.id === this.pendingDeleteShelfId);
		if (!shelf) {
			this.cancelDeleteShelf();
			return;
		}
		this.isMutatingShelves = true;
		const result = await ZUI.deleteLibraryShelf(shelf.id);
		this.isMutatingShelves = false;
		if (!result.ok) {
			toastStore.add(`Failed to delete shelf: ${result.error.message}`, 'error');
			return;
		}
		if (this.options.getSelectedShelfId() === shelf.id) {
			await this.options.onSelectedShelfRemoved();
		}
		this.closeAllShelfMenus();
		await shelfStore.reload();
		toastStore.add(`Shelf "${shelf.name}" deleted`, 'success');
		this.cancelDeleteShelf();
	};

	openShelfMenu = (event: MouseEvent, shelfId: number): void => {
		if (this.draggingShelfId !== null || this.isReorderingShelves) {
			return;
		}
		event.stopPropagation();
		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		this.shelfMenuPos = { top: rect.top - 2, left: rect.right - 10 };
		this.shelfMenuId = this.shelfMenuId === shelfId ? null : shelfId;
	};

	openRulesModal = (shelfId: number): void => {
		if (this.draggingShelfId !== null || this.isReorderingShelves) {
			return;
		}
		this.rulesModalShelfId = shelfId;
		this.closeAllShelfMenus();
	};

	closeRulesModal = (): void => {
		if (!this.isSavingShelfRules) {
			this.rulesModalShelfId = null;
		}
	};

	handleSaveShelfRules = async (ruleGroup: RuleGroup): Promise<void> => {
		if (this.rulesModalShelfId === null || this.isSavingShelfRules) {
			return;
		}
		this.isSavingShelfRules = true;
		const result = await ZUI.updateLibraryShelfRules(this.rulesModalShelfId, ruleGroup);
		this.isSavingShelfRules = false;
		if (!result.ok) {
			toastStore.add(`Failed to update shelf rules: ${result.error.message}`, 'error');
			return;
		}
		const nextShelves = this.shelves.map((shelf) =>
			shelf.id === result.value.shelf.id ? result.value.shelf : shelf
		);
		shelfStore.replace(nextShelves);
		this.rulesModalShelfId = null;
		toastStore.add(`Rules updated for "${result.value.shelf.name}"`, 'success');
	};

	shouldIgnoreShelfClick = (): boolean => {
		return Date.now() < this.blockShelfClickUntil || this.draggingShelfId !== null;
	};

	handleShelfPointerDown = (event: PointerEvent, shelfId: number): void => {
		if (event.pointerType === 'mouse' && event.button !== 0) {
			return;
		}
		if (
			this.isMutatingShelves ||
			this.isReorderingShelves ||
			this.editingShelfId !== null ||
			this.showCreateShelf
		) {
			return;
		}
		this.resetShelfPressState();
		this.pressedShelfId = shelfId;
		this.pressedPointerId = event.pointerId;
		this.pressedStartX = event.clientX;
		this.pressedStartY = event.clientY;
		this.shelfPressTimer = setTimeout(() => {
			if (this.pressedShelfId === shelfId && this.pressedPointerId === event.pointerId) {
				this.startShelfDrag(shelfId);
			}
		}, SHELF_REORDER_LONG_PRESS_MS);
	};

	mount = (): (() => void) => {
		void this.loadShelves();
		if (typeof window !== 'undefined') {
			window.addEventListener('pointermove', this.handleGlobalPointerMove);
			window.addEventListener('pointerup', this.handleGlobalPointerUp);
			window.addEventListener('pointercancel', this.handleGlobalPointerUp);
		}
		return () => {
			this.resetShelfPressState();
			this.resetShelfDragState();
			if (typeof window !== 'undefined') {
				window.removeEventListener('pointermove', this.handleGlobalPointerMove);
				window.removeEventListener('pointerup', this.handleGlobalPointerUp);
				window.removeEventListener('pointercancel', this.handleGlobalPointerUp);
			}
		};
	};

	closeAllShelfMenus = (): void => {
		this.showCreateEmojiPicker = false;
		this.showEditEmojiPicker = false;
		this.shelfMenuId = null;
		this.shelfMenuPos = null;
	};

	private clearShelfPressTimer(): void {
		if (this.shelfPressTimer !== null) {
			clearTimeout(this.shelfPressTimer);
			this.shelfPressTimer = null;
		}
	}

	private setShelfDragDocumentState(active: boolean): void {
		if (typeof document === 'undefined') {
			return;
		}
		document.body.classList.toggle('shelf-reorder-active', active);
	}

	private resetShelfDragState(): void {
		this.draggingShelfId = null;
		this.shelfDragOverId = null;
		this.shelfOrderBeforeDrag = null;
		this.setShelfDragDocumentState(false);
	}

	private resetShelfPressState(): void {
		this.clearShelfPressTimer();
		this.pressedShelfId = null;
		this.pressedPointerId = null;
		this.pressedStartX = 0;
		this.pressedStartY = 0;
	}

	private getShelfIdFromPoint(clientX: number, clientY: number): number | null {
		if (typeof document === 'undefined') {
			return null;
		}
		const target = document.elementFromPoint(clientX, clientY);
		if (!target) {
			return null;
		}
		const shelfNode = target.closest('[data-shelf-id]') as HTMLElement | null;
		const rawShelfId = shelfNode?.dataset.shelfId;
		if (!rawShelfId) {
			return null;
		}
		const parsedShelfId = Number.parseInt(rawShelfId, 10);
		return Number.isInteger(parsedShelfId) && parsedShelfId > 0 ? parsedShelfId : null;
	}

	private reorderShelvesLocally(draggedShelfId: number, targetShelfId: number): void {
		const fromIndex = this.shelves.findIndex((shelf) => shelf.id === draggedShelfId);
		const toIndex = this.shelves.findIndex((shelf) => shelf.id === targetShelfId);
		if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
			return;
		}
		const nextShelves = [...this.shelves];
		const [draggedShelf] = nextShelves.splice(fromIndex, 1);
		if (!draggedShelf) {
			return;
		}
		nextShelves.splice(toIndex, 0, draggedShelf);
		shelfStore.replace(nextShelves);
	}

	private async persistShelfReorder(previousShelves: LibraryShelf[]): Promise<void> {
		const shelfIds = this.shelves.map((shelf) => shelf.id);
		this.isReorderingShelves = true;
		const result = await ZUI.reorderLibraryShelves(shelfIds);
		this.isReorderingShelves = false;
		this.resetShelfDragState();
		if (!result.ok) {
			shelfStore.replace(previousShelves);
			toastStore.add(`Failed to reorder shelves: ${result.error.message}`, 'error');
			return;
		}
		shelfStore.replace(result.value.shelves);
	}

	private startShelfDrag(shelfId: number): void {
		if (this.draggingShelfId !== null || this.isMutatingShelves || this.isReorderingShelves) {
			return;
		}
		this.draggingShelfId = shelfId;
		this.shelfDragOverId = shelfId;
		this.shelfOrderBeforeDrag = [...this.shelves];
		this.blockShelfClickUntil = Date.now() + 500;
		this.closeAllShelfMenus();
		this.setShelfDragDocumentState(true);
	}

	private handleGlobalPointerMove = (event: PointerEvent): void => {
		if (this.pressedPointerId === null || event.pointerId !== this.pressedPointerId) {
			return;
		}
		if (this.draggingShelfId === null) {
			const movedX = Math.abs(event.clientX - this.pressedStartX);
			const movedY = Math.abs(event.clientY - this.pressedStartY);
			if (movedX > SHELF_DRAG_CANCEL_DISTANCE_PX || movedY > SHELF_DRAG_CANCEL_DISTANCE_PX) {
				this.resetShelfPressState();
			}
			return;
		}
		event.preventDefault();
		const targetShelfId = this.getShelfIdFromPoint(event.clientX, event.clientY);
		if (targetShelfId === null) {
			this.shelfDragOverId = null;
			return;
		}
		this.shelfDragOverId = targetShelfId;
		if (targetShelfId !== this.draggingShelfId) {
			this.reorderShelvesLocally(this.draggingShelfId, targetShelfId);
		}
	};

	private handleGlobalPointerUp = (event: PointerEvent): void => {
		if (this.pressedPointerId === null || event.pointerId !== this.pressedPointerId) {
			return;
		}
		this.clearShelfPressTimer();
		const wasDragging = this.draggingShelfId !== null;
		const previousShelves = this.shelfOrderBeforeDrag ? [...this.shelfOrderBeforeDrag] : null;
		this.resetShelfPressState();
		if (!wasDragging) {
			return;
		}
		this.blockShelfClickUntil = Date.now() + 500;
		const orderChanged =
			previousShelves !== null &&
			(previousShelves.length !== this.shelves.length ||
				previousShelves.some((shelf, index) => shelf.id !== this.shelves[index]?.id));
		if (!orderChanged || previousShelves === null) {
			this.resetShelfDragState();
			return;
		}
		void this.persistShelfReorder(previousShelves);
	};
}
