import React from 'react';
import { signIn } from 'next-auth/react';
import { 
  ArrowRight, 
  Brain, 
  CreditCard, 
  DollarSign, 
  PieChart, 
  Smartphone, 
  Target, 
  TrendingUp,
  Check,
  Zap,
  Shield,
  Users
} from 'lucide-react';
import Image from 'next/image';

const LandingPage: React.FC = () => {
  const handleSignIn = () => {
    signIn();
  };

  const features = [
    {
      icon: Brain,
      title: "Meet Finley, Your AI Financial Assistant",
      description: "Get personalized insights, spending recommendations, and debt payoff strategies powered by advanced AI that learns from your financial patterns.",
      color: "text-[#aed274]"
    },
    {
      icon: CreditCard,
      title: "Smart Credit Card Automation",
      description: "Automatically move money from spending categories to credit card payments. Never worry about forgetting to budget for credit card bills again.",
      color: "text-purple-600"
    },
    {
      icon: Target,
      title: "Zero-Based Budgeting",
      description: "Give every dollar a job with our proven zero-based budgeting system. See exactly where your money goes and take control of your finances.",
      color: "text-blue-600"
    },
    {
      icon: TrendingUp,
      title: "Real Bank Account Integration",
      description: "Connect your actual bank accounts via Plaid for automatic transaction sync. No more manual entry - your real financial data, automatically categorized.",
      color: "text-emerald-600"
    }
  ];

  const stats = [
    { value: "10,000+", label: "Users Trust Us" },
    { value: "$2.4M+", label: "Money Managed" },
    { value: "94%", label: "Report Better Financial Health" },
    { value: "4.9★", label: "User Rating" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <header className="relative z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
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
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleSignIn}
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={handleSignIn}
                className="bg-[#aed274] text-white px-6 py-2 rounded-lg hover:bg-[#9bc267] transition-colors font-medium"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                Give Your Budget a Brain with 
                <span className="text-[#aed274] block">AI-Powered Budgeting</span>
              </h1>
              <p className="text-xl text-gray-600 mt-6 leading-relaxed">
                Take control of your finances with intelligent automation, real bank integration, 
                and Finley - your personal AI financial assistant that helps you budget smarter, 
                save more, and reach your financial goals faster.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleSignIn}
                  className="bg-[#aed274] text-white px-8 py-4 rounded-xl hover:bg-[#9bc267] transition-all duration-300 font-semibold text-lg flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl hover:scale-105"
                >
                  <span>Start Budgeting Free</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={handleSignIn}
                  className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-xl hover:border-[#aed274] hover:text-[#aed274] transition-all duration-300 font-semibold text-lg"
                >
                  See Demo
                </button>
              </div>
              <div className="mt-8 flex items-center space-x-6 text-sm text-gray-500">
                <div className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-[#aed274]" />
                  <span>Free forever plan</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-[#aed274]" />
                  <span>Bank-level security</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-[#aed274]" />
                  <span>No credit card required</span>
                </div>
              </div>
            </div>

            {/* Hero Image/Visual */}
            <div className="relative">
              <div className="bg-gradient-to-r from-[#aed274] to-[#9cc49c] rounded-3xl p-8 shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500">
                <div className="bg-white rounded-2xl p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Monthly Budget</h3>
                    <div className="flex items-center space-x-1">
                      <Brain className="w-4 h-4 text-[#aed274]" />
                      <span className="text-sm text-[#aed274] font-medium">Finley AI</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-sm font-medium">Income</span>
                      <span className="text-green-600 font-bold">+$4,200</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium">Housing</span>
                      <span className="text-gray-900 font-bold">$1,200</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium">Food</span>
                      <span className="text-gray-900 font-bold">$400</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-[#aed274]/10 rounded-lg border border-[#aed274]/20">
                      <span className="text-sm font-medium text-[#aed274]">Emergency Fund</span>
                      <span className="text-[#aed274] font-bold">$500</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <Brain className="w-4 h-4 text-blue-600 mt-0.5" />
                      <div className="text-xs text-blue-700">
                        <strong>Finley suggests:</strong> Move $100 from dining out to emergency fund to reach your 3-month goal faster.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-[#e8717e] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl lg:text-4xl font-bold text-white mb-2">{stat.value}</div>
                <div className="text-green-100 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Master Your Money
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our powerful features work together to give you complete control over your finances, 
              from AI-powered insights to automated credit card management.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {features.map((feature, index) => (
              <div key={index} className="bg-gray-50 rounded-2xl p-8 hover:shadow-lg transition-shadow">
                <div className="flex items-start space-x-4">
                  <div className={`p-3 rounded-xl bg-white shadow-md`}>
                    <feature.icon className={`w-6 h-6 ${feature.color}`} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Finley AI Spotlight Section */}
      <section className="py-24 bg-gradient-to-r from-[#aed274] to-[#9cc49c]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                  <Brain className="w-7 h-7 text-[#aed274]" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">Meet Finley</h2>
                  <p className="text-green-100">Your AI Financial Assistant</p>
                </div>
              </div>
              <h3 className="text-4xl font-bold text-white mb-6">
                Personalized Financial Guidance That Actually Works
              </h3>
              <p className="text-xl text-green-100 mb-8 leading-relaxed">
                Finley analyzes your spending patterns, suggests budget optimizations, 
                and helps you make smarter financial decisions. It's like having a personal 
                financial advisor available 24/7.
              </p>
              <ul className="space-y-4 text-green-100">
                <li className="flex items-center space-x-3">
                  <Check className="w-5 h-5 text-white" />
                  <span>Smart spending insights and alerts</span>
                </li>
                <li className="flex items-center space-x-3">
                  <Check className="w-5 h-5 text-white" />
                  <span>Automated debt payoff strategies</span>
                </li>
                <li className="flex items-center space-x-3">
                  <Check className="w-5 h-5 text-white" />
                  <span>Personalized savings recommendations</span>
                </li>
                <li className="flex items-center space-x-3">
                  <Check className="w-5 h-5 text-white" />
                  <span>Goal tracking and milestone celebrations</span>
                </li>
              </ul>
            </div>

            {/* Chat Demo */}
            <div className="bg-white rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-[#aed274] rounded-full flex items-center justify-center">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Finley</h4>
                    <p className="text-xs text-gray-500">Your AI financial assistant</p>
                  </div>
                </div>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              </div>

              <div className="space-y-4 h-64 overflow-y-auto">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-[#aed274] rounded-full flex items-center justify-center flex-shrink-0">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-gray-100 rounded-2xl p-3 max-w-xs">
                    <p className="text-sm text-gray-900">Hi! I noticed you've been spending more on dining out this month. Would you like me to suggest some ways to optimize your food budget?</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 flex-row-reverse">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-[#aed274] rounded-2xl p-3 max-w-xs">
                    <p className="text-sm text-white">Yes, please! I want to save more for my vacation fund.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-[#aed274] rounded-full flex items-center justify-center flex-shrink-0">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-gray-100 rounded-2xl p-3 max-w-xs">
                    <p className="text-sm text-gray-900">Perfect! I suggest moving $150 from your dining budget to vacation savings. You're currently 70% towards your goal - this will get you to 85%! 🎉</p>
                    <button className="mt-2 bg-[#aed274] text-white px-3 py-1 rounded-lg text-xs font-medium">
                      Let's Do It
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Transform Your Financial Future?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join thousands of users who have taken control of their money with BudgetWise. 
            Start your journey to financial freedom today.
          </p>
          <button
            onClick={handleSignIn}
            className="bg-[#aed274] text-white px-8 py-4 rounded-xl hover:bg-[#9bc267] transition-all duration-300 font-semibold text-lg inline-flex items-center space-x-2 shadow-lg hover:shadow-xl hover:scale-105"
          >
            <span>Get Started Free</span>
            <ArrowRight className="w-5 h-5" />
          </button>
          <p className="text-gray-400 text-sm mt-4">
            No credit card required • Free forever plan available • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="w-10 h-10">
                <Image 
                  src="/img/PNG/logo_2.png" 
                  alt="Logo" 
                  width={40} 
                  height={40}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <div className="text-sm text-gray-500">
              © 2024. Built with ❤️ for financial freedom.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;