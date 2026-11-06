// In a browser, React Native's Alert.alert does nothing, so the questions asked before deleting or replacing anything
// would never be asked and their buttons never pressed. This puts the browser's own confirm box in its place:
// OK presses the alert's action button (the last one that is not "Cancel"), Cancel presses its cancel button.

import { Alert, type AlertButton } from "react-native";

Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
  const text = message ? `${title}\n\n${message}` : title;
  const cancel = buttons?.find((b) => b.style === "cancel");
  const action = [...(buttons ?? [])].reverse().find((b) => b !== cancel);
  if (!action) {
    window.alert(text);
    cancel?.onPress?.();
    return;
  }
  if (!cancel && buttons?.length === 1) {
    window.alert(text);
    action.onPress?.();
    return;
  }
  if (window.confirm(text)) action.onPress?.();
  else cancel?.onPress?.();
};
