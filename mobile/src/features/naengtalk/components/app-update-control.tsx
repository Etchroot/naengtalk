import React, { forwardRef, useImperativeHandle } from "react";

export type AppUpdateHandle = { check: () => void };
export type AppUpdateControlProps = { canPrompt?: boolean };

export const AppUpdateControl = forwardRef<AppUpdateHandle, AppUpdateControlProps>(function AppUpdateControl(_props, ref) {
  useImperativeHandle(ref, () => ({ check: () => {} }), []);
  return null;
});
