const fs = require('fs');
const path = require('path');

// List of API files that need fixing
const files = [
  'pages/api/budgets.ts',
  'pages/api/dashboard.ts',
  'pages/api/transactions.ts',
  'pages/api/goals.ts',
  'pages/api/insights.ts',
  'pages/api/charts.ts',
  'pages/api/seed.ts',
  'pages/api/transactions/update-category.ts',
  'pages/api/plaid/create-link-token.ts',
  'pages/api/plaid/exchange-token.ts',
  'pages/api/plaid/sync.ts'
];

function fixAuthInFile(filePath) {
  console.log(`Fixing ${filePath}...`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Pattern 1: Fix the initial auth check
    const authCheckPattern = /if \(!session\?\.\user\?\.\id\) \{\s*return res\.status\(401\)\.json\(\{ error: 'Unauthorized' \}\);\s*\}/g;
    const authCheckReplacement = `if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return res.status(401).json({ error: 'No user ID found' });
  }`;

    content = content.replace(authCheckPattern, authCheckReplacement);
    
    // Pattern 2: Replace all uses of session.user.id with userId
    content = content.replace(/session\.user\.id/g, 'userId');
    
    // Pattern 3: Fix error handling
    content = content.replace(/error\.message/g, 'error instanceof Error ? error.message : "Unknown error"');
    content = content.replace(/error\.stack/g, 'error instanceof Error ? error.stack : "No stack trace"');
    
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${filePath}`);
  } catch (error) {
    console.error(`Error fixing ${filePath}:`, error.message);
  }
}

// Fix all files
files.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    fixAuthInFile(fullPath);
  } else {
    console.log(`File not found: ${fullPath}`);
  }
});

console.log('Finished fixing auth type issues');