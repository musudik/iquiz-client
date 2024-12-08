// src/components/AnalyticsDashboard.js
import React, { useState, useEffect } from 'react';
import { rtdb } from '../firebaseConfig';
import { ref, onValue } from 'firebase/database';

function AnalyticsDashboard() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const resultsRef = ref(rtdb, 'results');
    
    const unsubscribe = onValue(resultsRef, (snapshot) => {
      try {
        const resultsData = [];
        const data = snapshot.val();
        
        if (data) {
          Object.keys(data).forEach((key) => {
            resultsData.push({
              id: key,
              ...data[key]
            });
          });
        }
        
        setResults(resultsData);
        setError(null);
      } catch (err) {
        console.error('Error processing data:', err);
        setError('Error loading results');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Analytics Dashboard</h2>
      {results.map((result) => (
        <div key={result.id}>
          <p>Participant: {result.participantName}</p>
          <p>Score: {result.score}</p>
        </div>
      ))}
    </div>
  );
}

export default AnalyticsDashboard;