import type Contents from 'epubjs/types/contents';
import type Rendition from 'epubjs/types/rendition';
import { ReaderTapNavigation } from './readerTapNavigation';

interface ReaderRect {
	left: number;
	width: number;
}

interface TapNavigationBindingOptions {
	getReaderRect: () => ReaderRect | null;
}

export function readerRelativeX(
	localX: number,
	frameLeft: number,
	readerLeft: number
): number {
	return frameLeft + localX - readerLeft;
}

interface GesturePoint {
	x: number;
	y: number;
	time: number;
}

function mousePoint(event: MouseEvent): GesturePoint {
	return { x: event.clientX, y: event.clientY, time: event.timeStamp };
}

function touchPoint(event: TouchEvent): GesturePoint | null {
	const touch = event.changedTouches[0] ?? event.touches[0];
	return touch ? { x: touch.clientX, y: touch.clientY, time: event.timeStamp } : null;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
	const candidate = target as { closest?: (selectors: string) => Element | null } | null;
	return Boolean(
		candidate?.closest?.(
			'a, button, input, textarea, select, label, summary, [role="button"], [contenteditable="true"]'
		)
	);
}

export function bindRenditionTapNavigation(
	rendition: Rendition,
	navigation: ReaderTapNavigation,
	options: TapNavigationBindingOptions
): () => void {
	const onMouseDown = (event: MouseEvent) => navigation.start(mousePoint(event), 'mouse');
	const onMouseMove = (event: MouseEvent) => navigation.move(mousePoint(event), 'mouse');
	const onMouseUp = (event: MouseEvent) => navigation.end(mousePoint(event), 'mouse');
	const onTouchStart = (event: TouchEvent) => {
		const point = touchPoint(event);
		if (point) navigation.start(point, 'touch');
	};
	const onTouchMove = (event: TouchEvent) => {
		const point = touchPoint(event);
		if (point) navigation.move(point, 'touch');
	};
	const onTouchEnd = (event: TouchEvent) => {
		const point = touchPoint(event);
		if (point) navigation.end(point, 'touch');
	};
	const onClick = (event: MouseEvent, contents: Contents) => {
		const readerRect = options.getReaderRect();
		const frame = contents.window.frameElement;
		const frameRect = frame?.getBoundingClientRect() ?? null;
		const selection = contents.window.getSelection();
		navigation.click({
			x:
				readerRect && frameRect
					? readerRelativeX(event.clientX, frameRect.left, readerRect.left)
					: event.clientX,
			time: event.timeStamp,
			detail: event.detail,
			viewportWidth:
				readerRect?.width ??
				contents.window.innerWidth ??
				contents.document.documentElement.clientWidth,
			hasSelection: Boolean(selection && !selection.isCollapsed),
			isInteractive: isInteractiveTarget(event.target)
		});
	};

	rendition.on('mousedown', onMouseDown);
	rendition.on('mousemove', onMouseMove);
	rendition.on('mouseup', onMouseUp);
	rendition.on('touchstart', onTouchStart);
	rendition.on('touchmove', onTouchMove);
	rendition.on('touchend', onTouchEnd);
	rendition.on('click', onClick);

	return () => {
		rendition.off('mousedown', onMouseDown);
		rendition.off('mousemove', onMouseMove);
		rendition.off('mouseup', onMouseUp);
		rendition.off('touchstart', onTouchStart);
		rendition.off('touchmove', onTouchMove);
		rendition.off('touchend', onTouchEnd);
		rendition.off('click', onClick);
		navigation.destroy();
	};
}
