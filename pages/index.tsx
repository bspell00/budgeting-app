import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Dashboard from '../components/Dashboard';
import LandingPage from '../components/LandingPage';

export default function Home() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <>
        <Head>
          <title>Loading - AccountAbility | AI-Powered Budgeting App</title>
        </Head>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#aed274] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </>
    );
  }

  // Show landing page for unauthenticated users
  if (!session) {
    return (
      <>
        <Head>
          {/* Primary Meta Tags */}
          <title>AccountAbility | AI-Powered Budgeting & Financial Management App</title>
          <meta name="title" content="AccountAbility | AI-Powered Budgeting & Financial Management App" />
          <meta name="description" content="Take control of your finances with AccountAbility - the smart budgeting app with AI assistant Finley. Connect real bank accounts, automate credit card payments, and achieve your financial goals faster. Free to start." />
          <meta name="keywords" content="budgeting app, AI financial assistant, personal finance, credit card automation, zero-based budgeting, financial planning, money management, banking integration, debt payoff, savings goals" />
          <meta name="author" content="AccountAbility" />
          
          {/* Open Graph / Facebook */}
          <meta property="og:type" content="website" />
          <meta property="og:url" content="https://aamoney.cc/" />
          <meta property="og:title" content="AccountAbility | AI-Powered Budgeting & Financial Management App" />
          <meta property="og:description" content="Take control of your finances with AccountAbility - the smart budgeting app with AI assistant Finley. Connect real bank accounts, automate credit card payments, and achieve your financial goals faster." />
          <meta property="og:image" content="https://aamoney.cc/og-image.png" />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:site_name" content="AccountAbility" />
          
          {/* Twitter */}
          <meta property="twitter:card" content="summary_large_image" />
          <meta property="twitter:url" content="https://aamoney.cc/" />
          <meta property="twitter:title" content="AccountAbility | AI-Powered Budgeting & Financial Management App" />
          <meta property="twitter:description" content="Take control of your finances with AccountAbility - the smart budgeting app with AI assistant Finley. Connect real bank accounts, automate credit card payments, and achieve your financial goals faster." />
          <meta property="twitter:image" content="https://aamoney.cc/og-image.png" />
          <meta property="twitter:creator" content="@accountabilityapp" />
          
          {/* Additional SEO Tags */}
          <meta name="theme-color" content="#00332B" />
          <meta name="application-name" content="AccountAbility" />
          <meta name="apple-mobile-web-app-title" content="AccountAbility" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="mobile-web-app-capable" content="yes" />
          
          {/* Structured Data - JSON-LD */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "SoftwareApplication",
                "name": "AccountAbility",
                "description": "AI-powered budgeting and financial management application with real bank account integration and intelligent automation features.",
                "url": "https://aamoney.cc",
                "applicationCategory": "FinanceApplication",
                "operatingSystem": "Web Browser",
                "offers": {
                  "@type": "Offer",
                  "price": "0",
                  "priceCurrency": "USD"
                },
                "aggregateRating": {
                  "@type": "AggregateRating",
                  "ratingValue": "4.9",
                  "ratingCount": "10000"
                },
                "creator": {
                  "@type": "Organization",
                  "name": "AccountAbility",
                  "url": "https://aamoney.cc"
                },
                "featureList": [
                  "AI Financial Assistant (Finley)",
                  "Real Bank Account Integration via Plaid",
                  "Automated Credit Card Payment Management",
                  "Zero-Based Budgeting System",
                  "Debt Payoff Planning",
                  "Goal Tracking and Savings Automation",
                  "Smart Transaction Categorization",
                  "Financial Insights and Recommendations"
                ]
              })
            }}
          />
        </Head>
        <LandingPage />
      </>
    );
  }

  // Show dashboard for authenticated users
  return (
    <>
      <Head>
        <title>Dashboard - AccountAbility | Your Financial Command Center</title>
        <meta name="description" content="Access your personal financial dashboard with real-time budget tracking, AI insights from Finley, and comprehensive money management tools." />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Dashboard />
    </>
  );
}