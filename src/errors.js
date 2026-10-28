export function friendlyError(error) {
  const messages = {
    NotAllowedError: 'Permission was declined or sharing was cancelled. Try setup again and allow screen, camera, and microphone access.',
    NotFoundError: 'A camera or microphone could not be found. Connect your devices and try again.',
    NotReadableError: 'A capture device could not be opened. Check whether another app is using it, then try again.',
    OverconstrainedError: 'The selected device is no longer available. Try setup again with a connected device.',
    NotSupportedError: 'This browser could not record the selected streams. Try a current desktop Chrome or Edge browser.',
  };
  return messages[error?.name] || error?.message || 'Something went wrong. Please try again.';
}
