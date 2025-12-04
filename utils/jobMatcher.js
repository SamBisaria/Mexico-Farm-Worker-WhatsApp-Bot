const db = require('../database/db');
const { calculateDistance } = require('./geocoder');

// Maximum distance to recommend jobs (in kilometers)
const MAX_DISTANCE_KM = 10;


async function calculateJobScore(worker, job) {
  let score = 0;
  
  score += await calculateCollaborativeScore(worker);
  score += calculateExperienceScore(worker, job);
  score += await calculateReliabilityScore(worker);
  score += await calculateRepeatEmployerScore(worker, job);
  
  return Math.min(score, 100); // Cap at 100
}


function calculateCollaborativeScore(worker) {
  // Demographic-Based Collaborative Filtering
  return new Promise((resolve) => {
    db.get(`
      SELECT 
        COUNT(DISTINCT j.date) as total_unique_work_days,
        COUNT(DISTINCT w.id) as neighbor_count
      FROM applications a
      JOIN workers w ON a.worker_id = w.id
      JOIN jobs j ON a.job_id = j.id
      WHERE w.id != ?
        AND (
          (CASE WHEN ABS(COALESCE(w.experience, 0) - COALESCE(?, 0)) <= 2 THEN 3 ELSE 0 END) +
          (CASE WHEN w.age BETWEEN COALESCE(?, 0) - 5 AND COALESCE(?, 0) + 5 THEN 2 ELSE 0 END) +
          (CASE WHEN w.gender = ? THEN 1 ELSE 0 END)
        ) >= 3
    `, [
      worker.id,
      worker.experience || 0,
      worker.age || 0,
      worker.age || 0,
      worker.gender
    ], (err, result) => {
      if (err) {
        console.error('Error in collaborative scoring:', err);
        resolve(10);
        return;
      }

      if (!result || result.neighbor_count === 0) {
        resolve(10); // Neutral baseline for cold start
        return;
      }
      
      // Calculate average UNIQUE DAYS worked per neighbor
      // This filters out "spamming" behavior from the demographic baseline
      const avgDaysPerNeighbor = result.total_unique_work_days / result.neighbor_count;
      
      const score = 30 * (1 - Math.exp(-0.1 * avgDaysPerNeighbor));
      
      resolve(Math.round(score));
    });
  });
}


function calculateExperienceScore(worker, job) {
  // If no experience data, give neutral score
  if (worker.experience === null || worker.experience === undefined) {
    return 10;
  }

  const workerExp = worker.experience;
  
  if (workerExp >= 5) {
    return 30; 
  } else if (workerExp >= 2) {
    return 25; 
  } else if (workerExp >= 1) {
    return 20;
  } else {
    return 15;
  }
}


function calculateReliabilityScore(worker) {
  return new Promise((resolve) => {
    // Get dates of all accepted jobs to detect consistency vs spamming
    db.all(`
      SELECT j.date
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      WHERE a.worker_id = ? AND a.status = 'accepted'
    `, [worker.id], (err, rows) => {
      if (err || !rows || rows.length === 0) {
        resolve(0); 
        return;
      }
      
      // 1. Detect Overbooking (Spamming)
      const dateCounts = {};
      let spamDays = 0;
      let uniqueDays = 0;

      rows.forEach(row => {
        if (!dateCounts[row.date]) {
          dateCounts[row.date] = 0;
          uniqueDays++;
        }
        dateCounts[row.date]++;
        if (dateCounts[row.date] === 3) { // Counted as spam if > 2 jobs/day
            spamDays++;
        }
      });

      // 2. Calculate "Honest Work Days"
      // We penalize spam days heavily. If you double-book, that day counts as negative.
      let rawScore = uniqueDays - (spamDays * 2);
      
      // 3. Logarithmic Growth (Diminishing Returns)
      // We want 30 days of work (a full month) to be "Excellent" (near 20 pts)
      // Formula: 20 * (1 - e^(-0.1 * rawScore))
      // If rawScore = 5 days -> 7.8 pts
      // If rawScore = 10 days -> 12.6 pts
      // If rawScore = 30 days -> 19.0 pts
      
      let finalScore = 0;
      if (rawScore > 0) {
        finalScore = 20 * (1 - Math.exp(-0.1 * rawScore));
      }

      resolve(Math.round(finalScore));
    });
  });
}

function calculateRepeatEmployerScore(worker, job) {
  // Bonus points if the worker has worked for same employer before
  return new Promise((resolve) => {
    if (!job.employer_id) {
      resolve(0);
      return;
    }

    db.get(`
      SELECT COUNT(*) as count 
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      WHERE a.worker_id = ? 
      AND j.employer_id = ?
      AND a.status = 'accepted'
    `, [worker.id, job.employer_id], (err, result) => {
      if (err || !result) {
        resolve(0);
        return;
      }

      if (result.count > 0) {
        resolve(20);
      } else {
        resolve(0);
      }
    });
  });
}

/**
 * Get recommended workers for a job based on distance filtering + scoring algorithm
 * @param {Object} job - Job object with title, location, latitude, longitude, etc.
 * @param {Number} threshold - Minimum score required (default 50 out of 100)
 * @param {Number} maxDistanceKm - Maximum distance in kilometers (default 10)
 * @param {Number} maxWorkers - Maximum number of workers to notify (default unlimited)
 * @returns {Promise<Array>} Array of workers sorted by score (highest first)
 */
async function getRecommendedWorkers(job, threshold = 50, maxDistanceKm = MAX_DISTANCE_KM, maxWorkers = null) {
  return new Promise((resolve) => {
    db.all('SELECT * FROM workers WHERE active = 1', [], async (err, workers) => {
      if (err || !workers || workers.length === 0) {
        console.log('No active workers found');
        resolve([]);
        return;
      }
      
      const workersWithDistance = workers
        .map(worker => {
          const distance = calculateDistance(
            worker.latitude,
            worker.longitude,
            job.latitude,
            job.longitude
          );
          return { ...worker, distance };
        })
        .filter(worker => {
          // If job or worker has no coordinates, include them (don't exclude due to missing data)
          if (worker.distance === null) {
            console.log(`Worker ${worker.id} (${worker.name}) has no location data - including by default`);
            return true;
          }
          return worker.distance <= maxDistanceKm;
        });
      
      console.log(`${workersWithDistance.length} workers within ${maxDistanceKm}km of job`);
      
      if (workersWithDistance.length === 0) {
        console.log('No workers within distance threshold');
        resolve([]);
        return;
      }
      
      const scoredWorkers = await Promise.all(
        workersWithDistance.map(async (worker) => ({
          ...worker,
          score: await calculateJobScore(worker, job)
        }))
      );
      
      // Filter by threshold and sort by score (highest first)
      let recommended = scoredWorkers
        .filter(w => w.score >= threshold)
        .sort((a, b) => b.score - a.score);
      
      console.log(`${recommended.length} workers passed score threshold of ${threshold}`);
      
      // Limit number of workers if maxWorkers specified
      if (maxWorkers && recommended.length > maxWorkers) {
        recommended = recommended.slice(0, maxWorkers);
      }
      
      //If too few workers match, lower threshold
      if (recommended.length < 3 && scoredWorkers.length >= 3) {
        const lowerThreshold = Math.max(30, threshold - 20);
        console.log(`Only ${recommended.length} workers found, lowering threshold to ${lowerThreshold}`);
        recommended = scoredWorkers
          .filter(w => w.score >= lowerThreshold)
          .sort((a, b) => b.score - a.score);
        
        if (maxWorkers && recommended.length > maxWorkers) {
          recommended = recommended.slice(0, maxWorkers);
        }
      }
      
      resolve(recommended);
    });
  });
}

module.exports = {
  getRecommendedWorkers,
  calculateJobScore,
  MAX_DISTANCE_KM
};
