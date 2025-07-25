import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Target, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  ArrowRight,
  MoreVertical,
  Play,
  Pause,
  Check
} from 'lucide-react';

interface AIPlan {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  timeframe: string;
  estimatedImpact: string;
  steps: string; // JSON string
  status: string;
  aiGenerated: boolean;
  metadata?: string; // JSON string
  createdAt: string;
  updatedAt: string;
}

interface AIGeneratedPlansProps {
  category?: string; // Filter by category (e.g., 'debt' for debt payoff section)
}

const AIGeneratedPlans: React.FC<AIGeneratedPlansProps> = ({ category }) => {
  const [plans, setPlans] = useState<AIPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ai-advisor/plans');
      const data = await response.json();
      
      if (data.success) {
        let filteredPlans = data.data;
        if (category) {
          filteredPlans = data.data.filter((plan: AIPlan) => plan.category === category);
        }
        setPlans(filteredPlans);
      } else {
        setError(data.error || 'Failed to load plans');
      }
    } catch (err) {
      setError('Failed to load AI plans');
      console.error('Error loading plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const updatePlanStatus = async (planId: string, status: string) => {
    try {
      const response = await fetch('/api/ai-advisor/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, status })
      });

      if (response.ok) {
        setPlans(prevPlans => 
          prevPlans.map(plan => 
            plan.id === planId ? { ...plan, status } : plan
          )
        );
      }
    } catch (error) {
      console.error('Error updating plan status:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'border-red-300 bg-red-50';
      case 'high': return 'border-orange-300 bg-orange-50';
      case 'medium': return 'border-yellow-300 bg-yellow-50';
      case 'low': return 'border-blue-300 bg-blue-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'high': return <Target className="w-4 h-4 text-orange-600" />;
      case 'medium': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'low': return <CheckCircle className="w-4 h-4 text-blue-600" />;
      default: return <Target className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-700 bg-green-100';
      case 'in_progress': return 'text-blue-700 bg-blue-100';
      case 'completed': return 'text-gray-700 bg-gray-100';
      case 'paused': return 'text-yellow-700 bg-yellow-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Brain className="w-5 h-5 text-purple-600 animate-pulse" />
          <h3 className="text-lg font-semibold text-gray-900">AI Generated Plans</h3>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading your AI plans...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Brain className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">AI Generated Plans</h3>
        </div>
        <div className="text-center py-8">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-600">{error}</p>
          <button 
            onClick={loadPlans}
            className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Brain className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">AI Generated Plans</h3>
        </div>
        <div className="text-center py-8">
          <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No AI plans yet</p>
          <p className="text-sm text-gray-500">
            Chat with your AI advisor to create personalized financial plans
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Brain className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            AI Generated Plans
            {category && ` (${category.charAt(0).toUpperCase() + category.slice(1)})`}
          </h3>
        </div>
        <div className="text-sm text-gray-500">
          {plans.length} active plan{plans.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="space-y-4">
        {plans.map((plan) => {
          const steps = JSON.parse(plan.steps || '[]');
          const metadata = plan.metadata ? JSON.parse(plan.metadata) : {};
          
          return (
            <div 
              key={plan.id} 
              className={`border rounded-lg p-4 ${getPriorityColor(plan.priority)}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start space-x-3 flex-1">
                  {getPriorityIcon(plan.priority)}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-semibold text-gray-900">{plan.title}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(plan.status)}`}>
                        {plan.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-500">
                        {plan.priority} priority
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{plan.description}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                      <div>⏱️ <strong>Timeline:</strong> {plan.timeframe}</div>
                      <div>🎯 <strong>Impact:</strong> {plan.estimatedImpact}</div>
                      {metadata.confidence && (
                        <div>🤖 <strong>AI Confidence:</strong> {Math.round(metadata.confidence * 100)}%</div>
                      )}
                      <div>📅 <strong>Created:</strong> {new Date(plan.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  {plan.status === 'active' && (
                    <button
                      onClick={() => updatePlanStatus(plan.id, 'in_progress')}
                      className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
                      title="Start this plan"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  
                  {plan.status === 'in_progress' && (
                    <>
                      <button
                        onClick={() => updatePlanStatus(plan.id, 'completed')}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                        title="Mark as completed"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updatePlanStatus(plan.id, 'paused')}
                        className="p-1 text-yellow-600 hover:bg-yellow-100 rounded transition-colors"
                        title="Pause this plan"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  
                  {plan.status === 'paused' && (
                    <button
                      onClick={() => updatePlanStatus(plan.id, 'in_progress')}
                      className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
                      title="Resume this plan"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Implementation Steps */}
              {steps.length > 0 && (
                <div className="bg-white bg-opacity-60 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-900 mb-2">Implementation Steps:</p>
                  <ol className="text-sm text-gray-700 space-y-1">
                    {steps.map((step: string, index: number) => (
                      <li key={index} className="flex items-start space-x-2">
                        <span className="font-medium text-gray-500 mt-0.5">{index + 1}.</span>
                        <span className="flex-1">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AIGeneratedPlans;