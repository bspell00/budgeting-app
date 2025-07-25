const fs = require('fs');
const path = require('path');

// Files that need fixing
const files = [
  'pages/test/import-sample-data.tsx',
  'pages/test/plaid-test.tsx'
];

function fixErrorHandling(filePath) {
  console.log(`Fixing ${filePath}...`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix error.message patterns
    content = content.replace(/err\.message/g, '(err instanceof Error ? err.message : "Unknown error")');
    
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
    fixErrorHandling(fullPath);
  } else {
    console.log(`File not found: ${fullPath}`);
  }
});

console.log('Finished fixing test error handling');