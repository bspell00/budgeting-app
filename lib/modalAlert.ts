// Utility functions to replace browser alert() calls with modal alerts
// This file can be imported anywhere to use modal alerts

// Global reference to the alert context
let globalAlert: any = null;

export const setGlobalAlert = (alertContext: any) => {
  globalAlert = alertContext;
};

export const showAlert = (message: string, title?: string) => {
  if (globalAlert) {
    globalAlert.showInfo(message, title);
  } else {
    // Fallback to browser alert if context not available
    alert(message);
  }
};

export const showSuccess = (message: string, title?: string) => {
  if (globalAlert) {
    globalAlert.showSuccess(message, title);
  } else {
    alert(message);
  }
};

export const showError = (message: string, title?: string) => {
  if (globalAlert) {
    globalAlert.showError(message, title);
  } else {
    alert(message);
  }
};

export const showWarning = (message: string, title?: string) => {
  if (globalAlert) {
    globalAlert.showWarning(message, title);
  } else {
    alert(message);
  }
};

export const showConfirm = (message: string, onConfirm: () => void | Promise<void>, title?: string) => {
  if (globalAlert) {
    globalAlert.showConfirm(message, onConfirm, title);
  } else {
    if (confirm(message)) {
      onConfirm();
    }
  }
};

// For components that can use hooks
export { useAlert } from '../components/ModalAlert';