import { useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Mail, Send } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
      } else {
        setError(data.error || 'An error occurred');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <header className="relative z-10 bg-teal-midnight/95 backdrop-blur-sm border-b border-teal-midnight">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-full h-[50px]">
                <Image 
                  src="/img/PNG/logo_2.png" 
                  alt="Logo" 
                  width={200} 
                  height={50}
                  className="w-full h-full object-contain"
                  priority
                  quality={100}
                />
              </div>
            </Link>
            <Link 
              href="/auth/signin"
              className="flex items-center space-x-2 text-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-md w-full">
          {/* Forgot Password Card */}
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4">
                <Image 
                  src="/img/PNG/icon.png" 
                  alt="App Icon" 
                  width={64} 
                  height={64}
                  className="w-full h-full object-contain"
                  priority
                  quality={100}
                />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Forgot Password?</h1>
              <p className="text-gray-600">No worries! Enter your email and we'll send you a reset link.</p>
            </div>

            {message ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <Send className="w-8 h-8 text-green-600 mx-auto mb-3" />
                <div className="text-green-800 mb-4">{message}</div>
                <div className="text-sm text-green-600 mb-4">
                  Check your console for the development reset link.
                </div>
                <Link 
                  href="/auth/signin"
                  className="inline-flex items-center px-4 py-2 text-white rounded-full bg-evergreen hover:bg-[#003527] transition-colors"
                >
                  Back to Sign In
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="text-sm text-red-600 text-center">{error}</div>
                  </div>
                )}

                {/* Email Field */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-evergreen focus:border-evergreen transition-colors"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                {/* Send Reset Link Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-evergreen text-white py-3 px-4 rounded-full font-semibold hover:bg-[#003527] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-evergreen transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Sending...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-2">
                      <Send className="w-5 h-5" />
                      <span>Send Reset Link</span>
                    </div>
                  )}
                </button>
              </form>
            )}

            {/* Footer Links */}
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-600">
                Remember your password?{' '}
                <Link 
                  href="/auth/signin" 
                  className="font-medium text-evergreen hover:text-[#003527] transition-colors"
                >
                  Sign in here
                </Link>
              </p>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500 mb-4">Your security is our priority</p>
            <div className="flex justify-center space-x-8 text-xs text-gray-400">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-evergreen rounded-full"></div>
                <span>Secure reset process</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-evergreen rounded-full"></div>
                <span>Time-limited tokens</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-evergreen rounded-full"></div>
                <span>Encrypted passwords</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}