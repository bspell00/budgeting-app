import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { Bell, CheckCircle, DollarSign, Target, TrendingUp } from 'lucide-react';

export default function ComingSoon() {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Animated counter for launch countdown
  const [days, setDays] = useState(0);
  
  useEffect(() => {
    // Set target launch date (adjust as needed)
    const launchDate = new Date('2024-12-01T00:00:00');
    
    const updateCountdown = () => {
      const now = new Date();
      const timeDiff = launchDate.getTime() - now.getTime();
      const daysLeft = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));
      setDays(daysLeft);
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000 * 3600); // Update every hour
    
    return () => clearInterval(interval);
  }, []);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsLoading(true);
    
    // Simulate API call (replace with actual email service)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsSubscribed(true);
    setIsLoading(false);
    setEmail('');
  };

  return (
    <>
      <Head>
        <title>AccountAbility - Coming Soon | Take Control of Your Financial Future</title>
        <meta name="description" content="AccountAbility is launching soon! The revolutionary budgeting app that helps you take control of your financial future with AI-powered insights and YNAB-style budgeting." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        
        {/* Open Graph / Social Media */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="AccountAbility - Coming Soon" />
        <meta property="og:description" content="Revolutionary budgeting app launching soon. Take control of your financial future!" />
        <meta property="og:image" content="https://aamoney.co/img/PNG/logo_2.png" />
        <meta property="og:url" content="https://aamoney.co" />
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="AccountAbility - Coming Soon" />
        <meta name="twitter:description" content="Revolutionary budgeting app launching soon. Take control of your financial future!" />
        <meta name="twitter:image" content="https://aamoney.co/img/PNG/logo_2.png" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-dipped-cream via-white to-white-asparagus relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-0 w-96 h-96 bg-last-lettuce rounded-full -translate-x-48 -translate-y-48"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-evergreen rounded-full translate-x-48 translate-y-48"></div>
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-last-lettuce rounded-full -translate-x-32 -translate-y-32"></div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            
            {/* Logo */}
            <div className="mb-12 animate-fade-in">
              <div className="flex justify-center mb-6">
                <Image
                  src="/img/PNG/logo_2.png"
                  alt="AccountAbility Logo"
                  width={400}
                  height={100}
                  className="h-20 w-auto sm:h-24 lg:h-28"
                  priority
                />
              </div>
            </div>

            {/* Main Heading */}
            <div className="mb-8 animate-slide-up">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-teal-midnight mb-4">
                Coming Soon
              </h1>
              <h2 className="text-xl sm:text-2xl lg:text-3xl text-evergreen font-medium mb-6">
                Take Control of Your Financial Future
              </h2>
              <p className="text-lg sm:text-xl text-coach-green/80 max-w-2xl mx-auto leading-relaxed">
                The revolutionary budgeting app that combines the power of YNAB-style budgeting 
                with AI-powered insights to help you achieve true financial accountability.
              </p>
            </div>

            {/* Countdown */}
            {days > 0 && (
              <div className="mb-12 animate-bounce-in">
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg p-6 inline-block border border-last-lettuce/20">
                  <div className="text-center">
                    <div className="text-4xl sm:text-5xl font-bold text-teal-midnight mb-2">
                      {days}
                    </div>
                    <div className="text-sm sm:text-base text-evergreen font-medium uppercase tracking-wide">
                      {days === 1 ? 'Day' : 'Days'} to Launch
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Features Preview */}
            <div className="mb-12 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
              <div className="bg-white/50 backdrop-blur-sm rounded-xl p-6 border border-last-lettuce/20 hover:shadow-lg transition-all duration-300">
                <div className="w-12 h-12 bg-last-lettuce/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="w-6 h-6 text-evergreen" />
                </div>
                <h3 className="text-lg font-semibold text-teal-midnight mb-2">Smart Budgeting</h3>
                <p className="text-sm text-coach-green/70">YNAB-style envelope budgeting with intelligent automation</p>
              </div>
              
              <div className="bg-white/50 backdrop-blur-sm rounded-xl p-6 border border-last-lettuce/20 hover:shadow-lg transition-all duration-300">
                <div className="w-12 h-12 bg-last-lettuce/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Target className="w-6 h-6 text-evergreen" />
                </div>
                <h3 className="text-lg font-semibold text-teal-midnight mb-2">AI Insights</h3>
                <p className="text-sm text-coach-green/70">Personalized recommendations and debt payoff strategies</p>
              </div>
              
              <div className="bg-white/50 backdrop-blur-sm rounded-xl p-6 border border-last-lettuce/20 hover:shadow-lg transition-all duration-300">
                <div className="w-12 h-12 bg-last-lettuce/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-6 h-6 text-evergreen" />
                </div>
                <h3 className="text-lg font-semibold text-teal-midnight mb-2">Real Progress</h3>
                <p className="text-sm text-coach-green/70">Track your financial growth with beautiful visualizations</p>
              </div>
            </div>

            {/* Email Signup */}
            <div className="mb-8 animate-slide-up">
              {isSubscribed ? (
                <div className="bg-last-lettuce/20 backdrop-blur-sm rounded-2xl p-6 max-w-md mx-auto border border-last-lettuce/30">
                  <div className="flex items-center justify-center mb-2">
                    <CheckCircle className="w-8 h-8 text-evergreen mr-2" />
                    <span className="text-lg font-semibold text-teal-midnight">You're on the list!</span>
                  </div>
                  <p className="text-sm text-coach-green/80">We'll notify you as soon as AccountAbility launches.</p>
                </div>
              ) : (
                <form onSubmit={handleEmailSubmit} className="max-w-md mx-auto">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex-1 px-4 py-3 rounded-lg border border-last-lettuce/30 bg-white/70 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-last-lettuce focus:border-transparent text-teal-midnight placeholder-coach-green/50"
                      required
                    />
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-6 py-3 bg-last-lettuce hover:bg-last-lettuce/90 text-teal-midnight font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-teal-midnight/30 border-t-teal-midnight rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <Bell className="w-4 h-4 mr-2" />
                          Notify Me
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-coach-green/60 mt-2">
                    Be the first to know when we launch. No spam, ever.
                  </p>
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="text-center">
              <p className="text-sm text-coach-green/60">
                © 2024 AccountAbility. Building the future of personal finance.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes bounce-in {
          0% { opacity: 0; transform: scale(0.3); }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }
        
        .animate-fade-in {
          animation: fade-in 1s ease-out;
        }
        
        .animate-slide-up {
          animation: slide-up 1s ease-out 0.3s both;
        }
        
        .animate-bounce-in {
          animation: bounce-in 1s ease-out 0.6s both;
        }
      `}</style>
    </>
  );
}