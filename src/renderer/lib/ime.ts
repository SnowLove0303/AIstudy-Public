type KeyboardLikeEvent = {
  isComposing?: boolean;
  key?: string;
  keyCode?: number;
  nativeEvent?: {
    isComposing?: boolean;
    key?: string;
    keyCode?: number;
  };
};

export function isImeComposingEvent(event: KeyboardLikeEvent) {
  const nativeEvent = event.nativeEvent;
  return Boolean(
    event.isComposing ||
    nativeEvent?.isComposing ||
    event.key === "Process" ||
    nativeEvent?.key === "Process" ||
    event.keyCode === 229 ||
    nativeEvent?.keyCode === 229
  );
}
