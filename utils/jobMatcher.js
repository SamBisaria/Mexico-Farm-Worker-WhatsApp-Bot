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
  //Demographic-Based Collaborative Filtering
  return new Promise((resolve) => {
    db.get(`
      SELECT 
        COUNT(DISTINCT a.id) as total_interactions,
        SUM(CASE WHEN a.status = 'accepted' THEN 1 ELSE 0 END) as positive_interactions
      FROM applications a
      JOIN workers w ON a.worker_id = w.id
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
        resolve(20);
        return;
      }

      if (!result || result.total_interactions === 0) {
        resolve(20); // Neutral baseline for cold start
        return;
      }
      
      const acceptanceRate = result.positive_interactions / result.total_interactions;
      //30 points max
      resolve(Math.round(acceptanceRate * 30));
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
    db.get(`
      SELECT 
        COUNT(*) as total_apps,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_count
      FROM applications
      WHERE worker_id = ?
    `, [worker.id], (err, result) => {
      if (err || !result || result.total_apps === 0) {
        resolve(10); // New workers get neutral score
        return;
      }
      
      const acceptanceRate = result.accepted_count / result.total_apps;
      
      //20 points max
      resolve(Math.round(acceptanceRate * 20));
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
