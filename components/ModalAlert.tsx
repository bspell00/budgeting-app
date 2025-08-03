import React, { createContext, useContext, useState, ReactNode } from 'react';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';

interface AlertOptions {
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  showCancel?: boolean;
  autoClose?: number; // Auto close after N milliseconds
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  showConfirm: (message: string, onConfirm: () => void | Promise<void>, title?: string) => void;
}

const AlertContext = createContext<AlertContextType | null>(null);

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

interface AlertProviderProps {
  children: ReactNode;
}

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const [alert, setAlert] = useState<AlertOptions | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const showAlert = (options: AlertOptions) => {
    setAlert(options);
    setIsVisible(true);
    
    // Auto close if specified
    if (options.autoClose) {
      setTimeout(() => {
        closeAlert();
      }, options.autoClose);
    }
  };

  const closeAlert = () => {
    setIsVisible(false);
    setTimeout(() => setAlert(null), 150); // Wait for animation
  };

  const handleConfirm = async () => {
    if (alert?.onConfirm) {
      try {
        await alert.onConfirm();
      } catch (error) {
        console.error('Error in alert confirm handler:', error);
      }
    }
    closeAlert();
  };

  const handleCancel = () => {
    if (alert?.onCancel) {
      alert.onCancel();
    }
    closeAlert();
  };

  const showSuccess = (message: string, title?: string) => {
    showAlert({
      type: 'success',
      title: title || 'Success',
      message,
      confirmText: 'OK',
      autoClose: 3000
    });
  };

  const showError = (message: string, title?: string) => {
    showAlert({
      type: 'error',
      title: title || 'Error',
      message,
      confirmText: 'OK'
    });
  };

  const showWarning = (message: string, title?: string) => {
    showAlert({
      type: 'warning',
      title: title || 'Warning',
      message,
      confirmText: 'OK'
    });
  };

  const showInfo = (message: string, title?: string) => {
    showAlert({
      type: 'info',
      title: title || 'Information',
      message,
      confirmText: 'OK'
    });
  };

  const showConfirm = (message: string, onConfirm: () => void | Promise<void>, title?: string) => {
    showAlert({
      type: 'warning',
      title: title || 'Confirm Action',
      message,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      showCancel: true,
      onConfirm
    });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-yellow-600" />;
      case 'info':
        return <Info className="w-6 h-6 text-blue-600" />;
      default:
        return <Info className="w-6 h-6 text-gray-600" />;
    }
  };

  const getColors = (type: string) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          button: 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
        };
      case 'error':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
        };
      case 'info':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          button: 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500'
        };
    }
  };

  return (
    <AlertContext.Provider value={{
      showAlert,
      showSuccess,
      showError,
      showWarning,
      showInfo,
      showConfirm
    }}>
      {children}
      
      {/* Modal Overlay */}
      {alert && (
        <div className={`fixed inset-0 z-50 overflow-y-auto transition-opacity duration-150 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={handleCancel}
            />

            {/* Center the modal */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
              &#8203;
            </span>

            {/* Modal panel */}
            <div className={`inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6 ${
              isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-95'
            }`}>
              <div className="sm:flex sm:items-start">
                {/* Icon */}
                <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full sm:mx-0 sm:h-10 sm:w-10 ${
                  getColors(alert.type || 'info').bg
                } ${getColors(alert.type || 'info').border} border`}>
                  {getIcon(alert.type || 'info')}
                </div>

                {/* Content */}
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-2">
                    {alert.title || 'Alert'}
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {alert.message}
                    </p>
                  </div>
                </div>

                {/* Close button */}
                <button
                  onClick={handleCancel}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-full p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Action buttons */}
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                <button
                  type="button"
                  onClick={handleConfirm}
                  className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${
                    getColors(alert.type || 'info').button
                  }`}
                >
                  {alert.confirmText || 'OK'}
                </button>
                
                {alert.showCancel && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    {alert.cancelText || 'Cancel'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
};