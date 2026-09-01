// W18 · Cross-cutting & polish — barrel.
// H15 channel prompt/manager + the W18-owned a11y primitives. See A11Y_AUDIT.md
// for the cross-cutting accessibility contract and adoption guidance.

export { default as ChannelsManager } from "./ChannelsManager";
export { default as ChannelConnectPrompt } from "./ChannelConnectPrompt";
export {
  focusRing,
  useReducedMotion,
  useFocusTrap,
  useReturnFocus,
  MIN_TARGET,
  SR_ONLY,
} from "./a11y";
export {
  buildChannelViews,
  readPushPermission,
  pushStatus,
  pushPromptMode,
  pushResultMode,
  statusWord,
  isValidEmail,
  isValidPhone,
  isCompleteCode,
  digitsOnly,
  type PushPermission,
  type ChannelId,
  type ChannelStatus,
  type ChannelView,
  type PromptMode,
} from "./channelState";
