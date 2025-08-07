import useSWR, { mutate } from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useDashboard() {
  const { data, error, isLoading } = useSWR('/api/dashboard', fetcher, {
    refreshInterval: 10000, // Refresh every 10 seconds
    revalidateOnFocus: true, // Refresh when window gains focus
    revalidateOnReconnect: true, // Refresh when connection is restored
    dedupingInterval: 2000, // Prevent duplicate requests within 2 seconds
  });

  // Optimistic update for budget changes
  const updateBudgetOptimistic = async (budgetId: string, updates: any) => {
    // Get current data
    const currentData = data;
    if (!currentData) return;

    // Find the budget first to make sure it exists
    let budgetFound = false;
    currentData.categories?.forEach((category: any) => {
      category.budgets?.forEach((budget: any) => {
        if (budget.id === budgetId) {
          budgetFound = true;
        }
      });
    });
    
    if (!budgetFound) {
      throw new Error(`Budget with ID ${budgetId} not found`);
    }

    // Create optimistic update - need to find budget inside categories
    const optimisticData = {
      ...currentData,
      categories: currentData.categories?.map((category: any) => {
        const updatedBudgets = category.budgets?.map((budget: any) => {
          if (budget.id === budgetId) {
            const updatedBudget = { ...budget };
            if (updates.name !== undefined) updatedBudget.name = updates.name;
            if (updates.amount !== undefined) {
              const oldAmount = updatedBudget.budgeted || 0;
              const newAmount = updates.amount;
              updatedBudget.budgeted = newAmount;
              updatedBudget.available = newAmount - (updatedBudget.spent || 0);
              
              // Update status
              if (updatedBudget.available > 0) {
                updatedBudget.status = 'on-track';
              } else if (updatedBudget.available === 0) {
                updatedBudget.status = 'on-track';
              } else {
                updatedBudget.status = 'overspent';
              }
            }
            return updatedBudget;
          }
          return budget;
        });
        
        return {
          ...category,
          budgets: updatedBudgets
        };
      })
    };
    
    // Update "To Be Assigned" if amount changed
    if (updates.amount !== undefined) {
      let oldAmount = 0;
      currentData.categories?.forEach((category: any) => {
        category.budgets?.forEach((budget: any) => {
          if (budget.id === budgetId) {
            oldAmount = budget.budgeted || 0;
          }
        });
      });
      const amountDifference = updates.amount - oldAmount;
      optimisticData.toBeAssigned = (currentData.toBeAssigned || 0) - amountDifference;
    }

    // Update cache optimistically
    mutate('/api/dashboard', optimisticData, false);

    try {
      // Make API call
      const response = await fetch('/api/budgets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: budgetId, ...updates }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update budget: ${response.status} ${errorText}`);
      }

      // Revalidate to sync with server
      mutate('/api/dashboard');
    } catch (error) {
      // Revert optimistic update on error
      mutate('/api/dashboard', currentData, false);
      throw error;
    }
  };

  // Optimistic update for creating budgets
  const createBudgetOptimistic = async (budgetData: any) => {
    const currentData = data;
    if (!currentData) return;

    // Create temporary budget with optimistic ID
    const tempBudget = {
      id: `temp-${Date.now()}`,
      name: budgetData.name,
      spent: 0,
      available: budgetData.amount || 0,
      status: (budgetData.amount || 0) > 0 ? 'on-track' : 'on-track',
      budgeted: budgetData.amount || 0,
    };

    // Find or create category
    const categoryName = budgetData.category || 'Misc';
    const existingCategoryIndex = currentData.categories?.findIndex((cat: any) => cat.name === categoryName);
    
    let updatedCategories;
    if (existingCategoryIndex !== undefined && existingCategoryIndex >= 0) {
      // Add to existing category
      updatedCategories = currentData.categories.map((cat: any, index: number) => {
        if (index === existingCategoryIndex) {
          return {
            ...cat,
            budgets: [...(cat.budgets || []), tempBudget]
          };
        }
        return cat;
      });
    } else {
      // Create new category
      const newCategory = {
        id: categoryName.toLowerCase().replace(/\s+/g, '-'),
        name: categoryName,
        category: categoryName,
        budgets: [tempBudget],
        totalBudgeted: budgetData.amount || 0,
        totalSpent: 0,
        totalAvailable: budgetData.amount || 0,
      };
      updatedCategories = [...(currentData.categories || []), newCategory];
    }

    // Add to optimistic data
    const optimisticData = {
      ...currentData,
      categories: updatedCategories,
      toBeAssigned: (currentData.toBeAssigned || 0) - (budgetData.amount || 0)
    };

    // Update cache optimistically
    mutate('/api/dashboard', optimisticData, false);

    try {
      // Make API call
      const response = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(budgetData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create budget: ${response.status} ${errorText}`);
      }

      // Revalidate to get real data from server and replace temporary data
      await mutate('/api/dashboard');
    } catch (error) {
      // Revert optimistic update on error
      mutate('/api/dashboard', currentData, false);
      throw error;
    }
  };

  // Optimistic update for deleting budgets
  const deleteBudgetOptimistic = async (budgetId: string) => {
    const currentData = data;
    if (!currentData) return;

    // Find budget to delete within categories
    let budgetToDelete: any = null;
    let categoryIndex = -1;
    let budgetIndex = -1;

    currentData.categories?.forEach((category: any, catIdx: number) => {
      category.budgets?.forEach((budget: any, budIdx: number) => {
        if (budget.id === budgetId) {
          budgetToDelete = budget;
          categoryIndex = catIdx;
          budgetIndex = budIdx;
        }
      });
    });

    if (!budgetToDelete) return;

    // Remove budget from optimistic data
    const optimisticData = {
      ...currentData,
      categories: currentData.categories?.map((category: any, catIdx: number) => {
        if (catIdx === categoryIndex) {
          return {
            ...category,
            budgets: category.budgets?.filter((_: any, budIdx: number) => budIdx !== budgetIndex) || []
          };
        }
        return category;
      }),
      toBeAssigned: (currentData.toBeAssigned || 0) + (budgetToDelete.budgeted || 0)
    };

    // Update cache optimistically
    mutate('/api/dashboard', optimisticData, false);

    try {
      // Make API call
      const response = await fetch(`/api/budgets?id=${budgetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete budget');
      }

      // Revalidate to sync with server
      mutate('/api/dashboard');
    } catch (error) {
      // Revert optimistic update on error
      mutate('/api/dashboard', currentData, false);
      throw error;
    }
  };

  // Optimistic update for transaction categorization affecting budgets
  const updateTransactionCategoriesOptimistic = async (transactionUpdates: Array<{id: string, amount: number, oldCategory?: string, newCategory: string}>) => {
    const currentData = data;
    if (!currentData) {
      console.log('❌ No dashboard data available for budget updates');
      return;
    }

    console.log('💰 Updating budget spending optimistically after transaction categorization:', transactionUpdates);
    console.log('📊 Current dashboard data structure:', {
      categoriesCount: currentData.categories?.length,
      categories: currentData.categories?.map((c: any) => ({ name: c.name, budgetsCount: c.budgets?.length }))
    });

    // Calculate budget changes from transaction updates
    const budgetChanges: Record<string, number> = {};
    
    transactionUpdates.forEach(update => {
      console.log(`🔍 Processing transaction: ${update.id}, amount: ${update.amount}, ${update.oldCategory} -> ${update.newCategory}`);
      
      // Remove spending from old category budget (if it exists)
      if (update.oldCategory && update.oldCategory !== 'Needs a Category' && update.amount < 0) {
        const oldBudgetKey = update.oldCategory;
        const changeAmount = Math.abs(update.amount);
        budgetChanges[oldBudgetKey] = (budgetChanges[oldBudgetKey] || 0) + changeAmount; // Reduce spending (add back)
        console.log(`📉 Reducing spending in "${oldBudgetKey}" by $${changeAmount}`);
      }
      
      // Add spending to new category budget (for expenses only)
      if (update.newCategory && update.newCategory !== 'Needs a Category' && update.amount < 0) {
        const newBudgetKey = update.newCategory;
        const changeAmount = Math.abs(update.amount);
        budgetChanges[newBudgetKey] = (budgetChanges[newBudgetKey] || 0) - changeAmount; // Increase spending (subtract)
        console.log(`📈 Increasing spending in "${newBudgetKey}" by $${changeAmount}`);
      }
      
      // Log if transaction is income (positive amount)
      if (update.amount > 0) {
        console.log(`💰 Skipping income transaction: ${update.id} ($${update.amount})`);
      }
    });

    console.log('📊 Budget changes calculated:', budgetChanges);

    // Create optimistic update
    const optimisticData = {
      ...currentData,
      categories: currentData.categories?.map((category: any) => ({
        ...category,
        budgets: category.budgets?.map((budget: any) => {
          const budgetChange = budgetChanges[budget.name];
          console.log(`🔍 Checking budget "${budget.name}" for changes:`, { budgetChange, hasChange: budgetChange !== undefined && budgetChange !== 0 });
          
          if (budgetChange !== undefined && budgetChange !== 0) {
            const oldSpent = budget.spent || 0;
            const newSpent = Math.max(0, oldSpent + budgetChange);
            const newAvailable = (budget.budgeted || 0) - newSpent;
            
            console.log(`🔄 Updating budget "${budget.name}": spent ${oldSpent} -> ${newSpent} (change: ${budgetChange}), available: ${newAvailable}`);
            
            return {
              ...budget,
              spent: newSpent,
              available: newAvailable,
              status: newAvailable < 0 ? 'overspent' : 'on-track'
            };
          }
          return budget;
        })
      }))
    };

    // Update cache optimistically
    mutate('/api/dashboard', optimisticData, false);
    
    console.log('✅ Budget spending updated optimistically');

    // Refresh from server after a short delay to get accurate data
    setTimeout(() => {
      mutate('/api/dashboard');
    }, 500);
  };

  return {
    data,
    error,
    isLoading,
    updateBudgetOptimistic,
    updateTransactionCategoriesOptimistic,
    createBudgetOptimistic,
    deleteBudgetOptimistic,
    refresh: () => mutate('/api/dashboard'),
  };
}