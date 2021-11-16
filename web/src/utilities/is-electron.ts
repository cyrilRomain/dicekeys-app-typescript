// export function isElectron() {
//   // Renderer process
//   if (typeof window !== 'undefined' && typeof window.process === 'object' && (window.process as {type?: string}).type === 'renderer') {
//       return true;
//   }

//   // Main process
//   if (typeof process !== 'undefined' && typeof process.versions === 'object' && !!process.versions.electron) {
//       return true;
//   }

//   // Detect the user agent when the `nodeIntegration` option is set to true
//   if (typeof navigator === 'object' && typeof navigator.userAgent === 'string' && navigator.userAgent.indexOf('Electron') >= 0) {
//       return true;
//   }

//   return false;
// }

// @ts-expect-error
export const RUNNING_IN_ELECTRON = !! VITE_SET_APP_RUNNING_IN_ELECTRON;
export type RUNNING_IN_ELECTRON = typeof RUNNING_IN_ELECTRON;

export type ValuesDefinedOnlyWhenRunningElectron<T, IS_RUNNING_IN_ELECTRON extends boolean = RUNNING_IN_ELECTRON> = {
  [P in keyof T]: IS_RUNNING_IN_ELECTRON extends true ? T[P] : undefined;
};