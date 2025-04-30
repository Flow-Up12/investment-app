import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchUserProfile, updateSettings } from '../store/slices/userSlice';
import Header from '../components/Header';

const SettingsPage = () => {
  const dispatch = useDispatch();
  const { profile, loading, error } = useSelector((state) => state.user);
  const [investmentLimit, setInvestmentLimit] = useState('');
  const [dailyLimit, setDailyLimit] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  useEffect(() => {
    dispatch(fetchUserProfile());
  }, [dispatch]);
  
  useEffect(() => {
    if (profile) {
      setInvestmentLimit(profile.investment_limit);
      setDailyLimit(profile.daily_limit);
    }
  }, [profile]);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    const settings = {
      investment_limit: parseFloat(investmentLimit),
      daily_limit: parseFloat(dailyLimit)
    };
    
    dispatch(updateSettings(settings)).then((result) => {
      if (!result.error) {
        setSuccessMessage('Settings updated successfully!');
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
      }
    });
  };
  
  return (
    <div>
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>
        
        {loading && !profile ? (
          <div className="card p-6 text-center">Loading user data...</div>
        ) : (
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Investment Limits</h2>
            
            {successMessage && (
              <div className="bg-green-100 text-green-700 p-4 rounded mb-4">
                {successMessage}
              </div>
            )}
            
            {error && (
              <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">
                  Maximum Investment Per Stock ($)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={investmentLimit}
                  onChange={(e) => setInvestmentLimit(e.target.value)}
                  className="input"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  The maximum amount you can invest in a single stock
                </p>
              </div>
              
              <div className="mb-6">
                <label className="block text-gray-700 mb-2">
                  Daily Investment Limit ($)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                  className="input"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  The maximum amount you can invest in a single day
                </p>
              </div>
              
              <button
                type="submit"
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage; 