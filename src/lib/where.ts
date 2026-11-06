// Where the readings are kept, for the words on screen: the phone app keeps them on the phone, the browser version in
// the browser.
import { Platform } from "react-native";

export const ON_WEB = Platform.OS === "web";
/** "on this phone" or "in this browser". */
export const HERE = ON_WEB ? "in this browser" : "on this phone";
/** "this phone" or "this browser". */
export const THIS_DEVICE = ON_WEB ? "this browser" : "this phone";
