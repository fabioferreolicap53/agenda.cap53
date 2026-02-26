import { TouchEvent, useRef } from 'react';

interface SwipeInput {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    rangeOffset?: number;
}

interface SwipeOutput {
    onTouchStart: (e: TouchEvent) => void;
    onTouchMove: (e: TouchEvent) => void;
    onTouchEnd: (e: TouchEvent) => void;
}

export const useSwipe = ({ onSwipeLeft, onSwipeRight, rangeOffset = 50 }: SwipeInput): SwipeOutput => {
    const touchStart = useRef<{ x: number, y: number } | null>(null);
    const touchEnd = useRef<{ x: number, y: number } | null>(null);

    const minSwipeDistance = rangeOffset;

    const onTouchStart = (e: TouchEvent) => {
        touchEnd.current = null;
        touchStart.current = {
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        };
    };

    const onTouchMove = (e: TouchEvent) => {
        touchEnd.current = {
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        };
    };

    const onTouchEnd = (e: TouchEvent) => {
        if (!touchStart.current || !touchEnd.current) return;
        
        const distanceX = touchStart.current.x - touchEnd.current.x;
        const distanceY = touchStart.current.y - touchEnd.current.y;
        
        const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);
        const isLeftSwipe = distanceX > minSwipeDistance;
        const isRightSwipe = distanceX < -minSwipeDistance;

        if (isHorizontalSwipe) {
            if (isLeftSwipe && onSwipeLeft) {
                onSwipeLeft();
            }
            
            if (isRightSwipe && onSwipeRight) {
                onSwipeRight();
            }
        }
    };

    return {
        onTouchStart,
        onTouchMove,
        onTouchEnd
    };
};
