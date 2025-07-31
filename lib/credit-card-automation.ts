import { PrismaClient } from '@prisma/client';
import { getCategoryGroup, isPredefinedCategory, getAllBudgetCategories } from './default-budgets';

const prisma = new PrismaClient();

// Removed CreditCardTransferResult - using BudgetAssignmentResult for all automation

export interface BudgetAssignmentResult {
  success: boolean;
  transferAmount: number;
  fromBudget?: string;
  toBudget?: string;
  message: string;
  creditCardTransfers?: Array<{
    creditCard: string;
    amount: number;
  }>;
}

export class CreditCardAutomation {
  // This method has been removed - credit card automation now only triggers on budget assignments,
  // not transaction creation. See processBudgetAssignment() method below.

  /**
   * Enhanced smart categorization using Plaid's detailed category hierarchy and predefined categories
   */
  static categorizeTransaction(merchantName: string, plaidCategories: string[] = [], plaidDetailedCategory?: string): string {
    const merchant = merchantName.toLowerCase();
    const primaryCategory = plaidCategories[0]?.toLowerCase() || '';
    const subCategory = plaidCategories[1]?.toLowerCase() || '';
    const detailedCategory = plaidCategories[2]?.toLowerCase() || '';

    // Plaid provides excellent hierarchical categorization - prioritize it first
    if (plaidCategories.length > 0) {
      const enhancedPlaidMapping = this.getEnhancedPlaidCategoryMapping(plaidCategories, merchantName);
      if (enhancedPlaidMapping) {
        return enhancedPlaidMapping;
      }
    }

    // Enhanced merchant matching with predefined categories (fallback)
    const categoryRules = {
      'Eating Out': [
        // Fast food chains
        'mcdonalds', 'burger king', 'taco bell', 'kfc', 'subway', 'chipotle', 'panera',
        'starbucks', 'dunkin', 'tim hortons', 'five guys', 'in-n-out', 'whataburger',
        'chick-fil-a', 'popeyes', 'wendys', 'arbys', 'dairy queen', 'sonic',
        // Restaurants and dining
        'restaurant', 'cafe', 'bistro', 'grill', 'diner', 'pizza', 'sushi', 'thai',
        'chinese', 'mexican', 'italian', 'steakhouse', 'seafood', 'bbq', 'brewery',
        'bar', 'pub', 'tavern', 'food truck', 'catering', 'delivery', 'doordash',
        'uber eats', 'grubhub', 'postmates', 'seamless'
      ],
      
      'Groceries': [
        // Major grocery chains
        'walmart', 'target', 'kroger', 'safeway', 'albertsons', 'publix', 'wegmans',
        'whole foods', 'trader joe', 'aldi', 'costco', 'sams club', 'bjs wholesale',
        'fresh market', 'harris teeter', 'giant', 'stop shop', 'food lion', 'winn dixie',
        // Grocery-related terms
        'supermarket', 'grocery', 'market', 'fresh', 'organic', 'produce', 'butcher',
        'bakery', 'deli'
      ],
      
      'Transportation': [
        // Gas stations
        'shell', 'exxon', 'chevron', 'bp', 'mobil', 'texaco', 'conoco', 'phillips 66',
        'marathon', 'speedway', 'wawa', 'sheetz', 'circle k', '7-eleven', 'casey',
        'pilot', 'loves', 'flying j', 'ta petro', 'valero', 'citgo', 'sunoco',
        // Transport services
        'uber', 'lyft', 'taxi', 'cab', 'public transport', 'metro', 'bus', 'train',
        'amtrak', 'greyhound', 'airline', 'airport', 'parking', 'toll', 'ez pass',
        'rental car', 'hertz', 'enterprise', 'budget', 'avis', 'zipcar', 'car2go',
        // Auto services
        'auto repair', 'mechanic', 'oil change', 'tire', 'car wash', 'towing',
        'gas station', 'fuel', 'petroleum', 'truck stop', 'service station'
      ],
      
      'Entertainment': [
        // Major retailers
        'amazon', 'ebay', 'walmart', 'target', 'best buy', 'apple store', 'microsoft',
        'home depot', 'lowes', 'menards', 'ikea', 'bed bath beyond', 'tj maxx',
        'marshalls', 'nordstrom', 'macys', 'kohls', 'jcpenney', 'sears',
        // Shopping terms
        'department store', 'retail', 'mall', 'outlet', 'clothing', 'apparel',
        'electronics', 'computer', 'phone', 'bookstore', 'toy store', 'gift shop',
        // Entertainment venues
        'movie', 'cinema', 'theater', 'concert', 'stadium', 'arena', 'amusement park',
        'zoo', 'museum', 'arcade', 'bowling', 'golf', 'mini golf', 'laser tag'
      ],
      
      'Hobbies': [
        // Fitness and recreation
        'gym', 'fitness', 'yoga', 'pilates', 'spa', 'massage', 'salon', 'barber'
      ],
      
      'Electric': [
        // Utilities
        'electric', 'electricity', 'power company', 'electric utility', 'pge', 'duke energy'
      ],
      
      'Water': [
        'water', 'sewer', 'water utility', 'water department'
      ],
      
      'Internet': [
        'internet', 'cable', 'satellite', 'comcast', 'xfinity', 'verizon fios', 'att internet'
      ],
      
      'Cellphone': [
        'cell phone', 'wireless', 'verizon', 'att', 't-mobile', 'sprint', 'phone bill'
      ],
      
      'Rent/Mortgage': [
        'rent', 'mortgage', 'housing payment', 'property management'
      ],
      
      'Health & Wellness': [
        'doctor', 'physician', 'hospital', 'clinic', 'pharmacy', 'cvs', 'walgreens',
        'rite aid', 'medical', 'dental', 'dentist', 'optometrist', 'eye care',
        'urgent care', 'emergency room', 'lab', 'x-ray', 'mri', 'ct scan',
        'physical therapy', 'chiropractor', 'dermatologist', 'specialist'
      ],
      
      'Home Maintenance': [
        'home improvement', 'repair', 'plumber', 'electrician', 'contractor', 'handyman'
      ],
      
      'Auto Maintenance': [
        'auto repair', 'mechanic', 'oil change', 'tire', 'car wash', 'towing'
      ],
      
      'Gifts': [
        'gift', 'present', 'birthday', 'holiday', 'christmas', 'wedding'
      ]
    };

    // Check merchant name against category rules
    for (const [category, keywords] of Object.entries(categoryRules)) {
      if (keywords.some(keyword => merchant.includes(keyword))) {
        return category;
      }
    }

    // Default to a predefined category if available
    return 'Entertainment'; // Default fallback category
  }

  /**
   * Enhanced Plaid category mapping using their detailed hierarchy
   */
  private static getEnhancedPlaidCategoryMapping(plaidCategories: string[], merchantName: string): string | null {
    const primary = plaidCategories[0]?.toLowerCase() || '';
    const secondary = plaidCategories[1]?.toLowerCase() || '';
    const detailed = plaidCategories[2]?.toLowerCase() || '';
    const merchant = merchantName.toLowerCase();

    // Log for debugging
    console.log('Plaid categorization debug:', {
      merchant: merchantName,
      categories: plaidCategories,
      primary,
      secondary,
      detailed
    });

    // Map Plaid's detailed categories to YNAB-style budget categories
    // This handles both legacy categories and new personal finance categories
    const plaidMappings: { [key: string]: string } = {
      // Food & Dining - Multiple variations
      'food_and_drink': 'Eating Out',
      'food and drink': 'Eating Out', 
      'restaurants': 'Eating Out',
      'fast_food': 'Eating Out',
      'fast food': 'Eating Out',
      'coffee_shops': 'Eating Out',
      'coffee shop': 'Eating Out',
      'bars': 'Eating Out',
      'bar': 'Eating Out',
      'food_delivery': 'Eating Out',
      'food delivery': 'Eating Out',
      'restaurants_fast_food': 'Eating Out',
      'restaurants_coffee': 'Eating Out',
      
      // Groceries - Multiple variations
      'food_and_drink_groceries': 'Groceries',
      'food and drink, groceries': 'Groceries',
      'groceries': 'Groceries',
      'supermarkets': 'Groceries',
      'supermarkets_and_grocery_stores': 'Groceries',
      'supermarkets and grocery stores': 'Groceries',
      'grocery': 'Groceries',
      
      // Transportation & Gas - Multiple variations  
      'transportation': 'Transportation',
      'transportation_gas_stations': 'Transportation',
      'gas_stations': 'Transportation',
      'gas stations': 'Transportation',
      'taxi': 'Transportation',
      'parking': 'Transportation',
      'tolls': 'Transportation',
      'public_transportation': 'Transportation',
      'public transportation': 'Transportation',
      'ride_share': 'Transportation',
      'ride share': 'Transportation',
      'automotive': 'Transportation',
      'automotive_fuel': 'Transportation',
      'automotive_parking': 'Transportation',
      'gas': 'Transportation',
      'fuel': 'Transportation',
      
      // Shopping - Multiple variations
      'shops': 'Misc. Needs',
      'general_merchandise': 'Misc. Needs',
      'general merchandise': 'Misc. Needs',
      'department_stores': 'Misc. Needs', 
      'department stores': 'Misc. Needs',
      'clothing_and_accessories': 'Clothing',
      'clothing and accessories': 'Clothing',
      'electronics': 'Misc. Needs',
      'electronics_computers': 'Misc. Needs',
      'sporting_goods': 'Misc. Needs',
      'sporting goods': 'Misc. Needs',
      'bookstores': 'Misc. Needs',
      'home_improvement': 'Home Improvement',
      'home improvement': 'Home Improvement',
      'home_and_garden': 'Home Improvement',
      'home and garden': 'Home Improvement',
      
      // Bills & Utilities - Multiple variations
      'utilities': 'Monthly Bills',
      'utilities_electric': 'Electric',
      'utilities_gas': 'Gas',
      'utilities_water': 'Water', 
      'utilities_internet_and_cable': 'Internet',
      'internet_and_cable': 'Internet',
      'internet and cable': 'Internet',
      'phone': 'Cellphone',
      'telecommunications': 'Cellphone',
      'electric': 'Electric',
      'gas_utility': 'Gas',
      'gas utility': 'Gas',
      'water': 'Water',
      'waste_management': 'Trash',
      'waste management': 'Trash',
      
      // Financial Services
      'payment, credit card': 'Credit Card Payments',
      'payment, mortgage': 'Mortgage',
      'payment, rent': 'Monthly Bills',
      'interest earned': 'Income',
      'interest charged': 'Interest Charges',
      'bank fees': 'Monthly Bills',
      'loan payments': 'Monthly Bills',
      
      // Healthcare
      'healthcare': 'Medical',
      'pharmacies': 'Medical',
      'hospitals': 'Medical',
      'dentists': 'Medical',
      'optometrists': 'Medical',
      
      // Entertainment & Recreation
      'recreation': 'Misc. Needs',
      'entertainment': 'Misc. Needs',
      'gyms and fitness centers': 'Misc. Needs',
      'movie theaters': 'Misc. Needs',
      'amusement parks': 'Misc. Needs',
      'music and video': 'Subscriptions',
      'streaming services': 'Subscriptions',
      
      // Personal Care
      'personal care': 'Misc. Needs',
      'hair salons and barbers': 'Hair',
      
      // Professional Services
      'professional services': 'Misc. Needs',
      'legal': 'Misc. Needs',
      'accounting': 'Misc. Needs',
      
      // Education
      'education': 'Misc. Needs',
      'schools': 'Misc School',
      
      // Travel
      'travel': 'Misc. Needs',
      'airlines': 'Misc. Needs',
      'hotels': 'Misc. Needs',
      'car rental': 'Transportation',
      
      // Government & Non-Profit
      'government departments': 'Taxes',
      'tax payment': 'Taxes',
      'charitable giving': 'Tithing',
      'religious organizations': 'Tithing'
    };

    // Try exact match with full category path
    const fullCategory = plaidCategories.join(', ').toLowerCase();
    if (plaidMappings[fullCategory]) {
      return plaidMappings[fullCategory];
    }

    // Try primary + secondary category
    if (secondary) {
      const primarySecondary = `${primary}, ${secondary}`;
      if (plaidMappings[primarySecondary]) {
        return plaidMappings[primarySecondary];
      }
    }

    // Try just secondary category (most specific)
    if (secondary && plaidMappings[secondary]) {
      return plaidMappings[secondary];
    }

    // Try primary category
    if (plaidMappings[primary]) {
      return plaidMappings[primary];
    }

    // Special handling for specific merchants
    if (merchant.includes('target') || merchant.includes('walmart')) {
      // These can be groceries or general shopping
      if (secondary?.includes('groceries') || secondary?.includes('food')) {
        return 'Groceries';
      }
      return 'Misc. Needs';
    }

    if (merchant.includes('amazon')) {
      // Amazon can be many things, default to general shopping
      return 'Misc. Needs';
    }

    return null; // No mapping found, will fall back to merchant-based rules
  }

  /**
   * Get or create a budget for automatic categorization using predefined categories
   */
  static async getOrCreateBudget(
    userId: string,
    categoryName: string,
    month: number,
    year: number,
    defaultAmount: number = 100
  ) {
    try {
      // Try to find existing budget by name (not category group)
      let budget = await prisma.budget.findFirst({
        where: {
          userId: userId,
          name: categoryName,
          month: month,
          year: year,
        }
      });

      // Create budget if it doesn't exist
      if (!budget) {
        // Get the appropriate category group for this budget name
        const categoryGroup = getCategoryGroup(categoryName);
        
        budget = await prisma.budget.create({
          data: {
            userId: userId,
            name: categoryName,
            amount: defaultAmount,
            category: categoryGroup,
            month: month,
            year: year,
            spent: 0,
          }
        });
        
        console.log(`✅ Auto-created budget: ${categoryName} in ${categoryGroup} group`);
      }

      return budget;
    } catch (error) {
      console.error('Error getting or creating budget:', error);
      throw error;
    }
  }

  // This method has been removed and replaced with processBudgetAssignment() which correctly
  // handles the YNAB-style automation based on budget assignments, not transaction presence.

  /**
   * Process budget assignment automation: When money is assigned to a budget,
   * check if there are unassigned credit card expenses in that category and 
   * automatically move the assigned money to cover those expenses.
   */
  static async processBudgetAssignment(
    userId: string,
    budgetId: string,
    assignedAmount: number,
    options: {
      forceTransfer?: boolean;
    } = {}
  ): Promise<BudgetAssignmentResult> {
    try {
      // Get the budget being assigned money to
      const budget = await prisma.budget.findUnique({
        where: { id: budgetId },
      });

      if (!budget || budget.userId !== userId) {
        return {
          success: false,
          transferAmount: 0,
          message: 'Budget not found or access denied'
        };
      }

      // Find all unassigned credit card transactions in this category
      const uncoveredCreditTransactions = await prisma.transaction.findMany({
        where: {
          userId: userId,
          category: budget.name,
          account: {
            accountType: 'credit'
          },
          amount: { lt: 0 }, // Expenses (negative amounts)
          // Check if this transaction is not already covered by looking for existing transfers
          NOT: {
            budgetTransfers: {
              some: {
                fromBudgetId: budgetId
              }
            }
          }
        },
        include: {
          account: true,
          budgetTransfers: true
        },
        orderBy: { date: 'asc' } // Process oldest first
      });

      if (uncoveredCreditTransactions.length === 0) {
        return {
          success: true,
          transferAmount: 0,
          message: `No uncovered credit card expenses found in ${budget.name}`
        };
      }

      let remainingAssignment = assignedAmount;
      const transfers: Array<{ creditCard: string; amount: number }> = [];
      let totalTransferred = 0;

      // Process each uncovered transaction
      for (const transaction of uncoveredCreditTransactions) {
        if (remainingAssignment <= 0) break;

        const expenseAmount = Math.abs(transaction.amount);
        const transferAmount = Math.min(remainingAssignment, expenseAmount);

        // Find or create the credit card payment budget
        const creditCardName = transaction.account.accountName;
        let creditCardBudget = await prisma.budget.findFirst({
          where: {
            userId: userId,
            name: `${creditCardName} Payment`,
            category: 'Credit Card Payments'
          }
        });

        if (!creditCardBudget) {
          // Create the credit card payment budget
          creditCardBudget = await prisma.budget.create({
            data: {
              userId: userId,
              name: `${creditCardName} Payment`,
              category: 'Credit Card Payments',
              amount: 0,
              spent: 0,
              month: budget.month,
              year: budget.year
            }
          });
        }

        // Transfer money from spending budget to credit card payment budget
        await prisma.budget.update({
          where: { id: budgetId },
          data: { amount: { decrement: transferAmount } }
        });

        await prisma.budget.update({
          where: { id: creditCardBudget.id },
          data: { amount: { increment: transferAmount } }
        });

        // Record the transfer for audit trail
        await prisma.budgetTransfer.create({
          data: {
            userId: userId,
            fromBudgetId: budgetId,
            toBudgetId: creditCardBudget.id,
            amount: transferAmount,
            transactionId: transaction.id,
            reason: `Auto-transfer to cover ${creditCardName} expense in ${budget.name}`,
            automated: true
          }
        });

        transfers.push({
          creditCard: creditCardName,
          amount: transferAmount
        });

        totalTransferred += transferAmount;
        remainingAssignment -= transferAmount;
      }

      const message = transfers.length > 0 
        ? `Transferred $${totalTransferred.toFixed(2)} from ${budget.name} to credit card payments: ${transfers.map(t => `$${t.amount.toFixed(2)} to ${t.creditCard}`).join(', ')}`
        : `No transfers needed for ${budget.name}`;

      return {
        success: true,
        transferAmount: totalTransferred,
        fromBudget: budget.name,
        message,
        creditCardTransfers: transfers
      };

    } catch (error) {
      console.error('Error processing budget assignment automation:', error);
      return {
        success: false,
        transferAmount: 0,
        message: `Budget assignment automation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export default CreditCardAutomation;