import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet, TextInput, type ScrollViewProps } from 'react-native';
import { keyboardScrollAdjustment } from '../lib/keyboardVisibility';

/** Scroll only the obscured portion of the active field, after keyboard/layout changes. */
export const KeyboardAwareScrollView = forwardRef<ScrollView, ScrollViewProps>(function KeyboardAwareScrollView(
  { horizontal, onFocus, onBlur, onLayout, onScroll, onContentSizeChange, contentContainerStyle, ...props }, forwardedRef,
) {
  const scroll = useRef<ScrollView>(null);
  const offset = useRef(0);
  const focused = useRef(false);
  const keyboardTop = useRef<number | null>(null);
  const frame = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const [extraBottom, setExtraBottom] = useState(0);
  useImperativeHandle(forwardedRef, () => scroll.current!, []);

  const reveal = useCallback(() => {
    if (horizontal || !focused.current) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (!focused.current) return;
      if (Platform.OS === 'web') {
        const input = document.activeElement as HTMLElement | null;
        input?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        return;
      }
      const input = TextInput.State.currentlyFocusedInput();
      const container = scroll.current;
      if (!input || !container) return;
      container.getNativeScrollRef()?.measureInWindow((_x, top, _width, height) => {
        if (!focused.current || height <= 0) return;
        const bottom = Math.min(top + height, keyboardTop.current ?? top + height);
        const overlap = Math.max(0, top + height - bottom);
        setExtraBottom(keyboardTop.current === null ? 0 : overlap + 24);
        input.measureInWindow((_inputX, inputTop, _inputWidth, inputHeight) => {
          if (!focused.current || input !== TextInput.State.currentlyFocusedInput() || inputHeight <= 0) return;
          const delta = keyboardScrollAdjustment(inputTop, inputHeight, top, bottom);
          if (delta !== 0) container.scrollTo({ y: Math.max(0, offset.current + delta), animated: true });
        });
      });
    });
  }, [horizontal]);

  useEffect(() => {
    if (horizontal) return;
    const show = Keyboard.addListener('keyboardDidShow', event => { keyboardTop.current = event.endCoordinates.screenY; reveal(); });
    const change = Keyboard.addListener('keyboardDidChangeFrame', event => { keyboardTop.current = event.endCoordinates.screenY; reveal(); });
    const hide = Keyboard.addListener('keyboardDidHide', () => { keyboardTop.current = null; setExtraBottom(0); });
    const viewport = Platform.OS === 'web' ? window.visualViewport : null;
    viewport?.addEventListener('resize', reveal);
    return () => {
      focused.current = false;
      show.remove(); change.remove(); hide.remove(); viewport?.removeEventListener('resize', reveal);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [horizontal, reveal]);

  const base = StyleSheet.flatten(contentContainerStyle);
  return <ScrollView {...props} ref={scroll} horizontal={horizontal}
    keyboardShouldPersistTaps={props.keyboardShouldPersistTaps ?? 'handled'}
    keyboardDismissMode={props.keyboardDismissMode ?? 'on-drag'}
    scrollEventThrottle={props.scrollEventThrottle ?? 16}
    contentContainerStyle={[contentContainerStyle, extraBottom > 0 && { paddingBottom: Number(base?.paddingBottom ?? base?.paddingVertical ?? base?.padding ?? 0) + extraBottom }]}
    onFocus={event => { focused.current = true; reveal(); onFocus?.(event); }}
    onBlur={event => { focused.current = false; onBlur?.(event); }}
    onLayout={event => { reveal(); onLayout?.(event); }}
    onContentSizeChange={(width, height) => { reveal(); onContentSizeChange?.(width, height); }}
    onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; onScroll?.(event); }} />;
});
