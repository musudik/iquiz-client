// src/components/Leaderboard.jsx
import React, { useState, useEffect } from 'react';
import { rtdb } from '../firebaseConfig';
import { ref, onValue } from 'firebase/database';

function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const leaderboardRef = ref(rtdb, 'leaderboard');
    
    const unsubscribe = onValue(leaderboardRef, (snapshot) => {
      try {
        const leaderboardData = [];
        const data = snapshot.val();
        
        if (data) {
          Object.keys(data).forEach((key) => {
            leaderboardData.push({
              id: key,
              ...data[key]
            });
          });
        }
        
        setLeaderboard(leaderboardData);
        setError(null);
      } catch (err) {
        console.error('Error processing data:', err);
        setError('Error loading leaderboard');
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
      <h2>Leaderboard</h2>
      {leaderboard.map((entry) => (
        <div key={entry.id}>
          <p>{entry.name}: {entry.score}</p>
        </div>
      ))}
    </div>
  );
}

export default Leaderboard;