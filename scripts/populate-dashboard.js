// Simple script to populate the dashboard with sample data
// Run this after starting the development server

const populateDashboard = async () => {
  try {
    console.log('Populating dashboard with YNAB categories...');
    
    const response = await fetch('http://localhost:3000/api/seed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Note: In a real scenario, you'd need to be logged in with a valid session
      // For now, this will require manual testing through the browser
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Dashboard populated successfully:', data);
    } else {
      console.error('Failed to populate dashboard:', await response.text());
    }
  } catch (error) {
    console.error('Error populating dashboard:', error);
  }
};

// Note: This script requires authentication, so it's better to call the API directly
// through the browser or create a test page
console.log('To populate the dashboard:');
console.log('1. Start the development server: npm run dev');
console.log('2. Login to your account');
console.log('3. Navigate to: http://localhost:3000/api/seed (POST request)');
console.log('4. Or create a test page to call the seed API');