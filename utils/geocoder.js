const https = require('https');

/**
 * Geocode an address using Nominatim (OpenStreetMap)
 * Free service, no API key required
 * @param {string} address - Address to geocode
 * @returns {Promise<Object|null>} - {latitude, longitude, formattedAddress} or null
 */
async function geocodeAddress(address) {
  if (!address) return null;

  return new Promise((resolve) => {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1&addressdetails=1`;

    https.get(url, {
      headers: {
        'User-Agent': 'SanQuintinJobsApp/1.0'
      }
    }, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          if (results && results.length > 0) {
            const result = results[0];
            let formatted = result.display_name;
            
            if (result.address) {
                const parts = [];
                const a = result.address;
                
                // Street
                if (a.road) {
                    parts.push(a.house_number ? `${a.house_number} ${a.road}` : a.road);
                }
                
                // Neighborhood
                if (a.suburb && a.suburb !== a.city) parts.push(a.suburb);
                else if (a.neighbourhood && a.neighbourhood !== a.city) parts.push(a.neighbourhood);
                
                // City
                const city = a.city || a.town || a.village || a.hamlet;
                if (city) parts.push(city);
                
                // State
                if (a.state) parts.push(a.state);
                
                if (parts.length > 0) formatted = parts.join(', ');
            }
            
            resolve({
              latitude: parseFloat(result.lat),
              longitude: parseFloat(result.lon),
              formattedAddress: formatted
            });
          } else {
            console.log('No geocoding results for:', address);
            resolve(null);
          }
        } catch (error) {
          console.error('Geocoding error:', error);
          resolve(null);
        }
      });
    }).on('error', (error) => {
      console.error('Geocoding request error:', error);
      resolve(null);
    });
  });
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} - Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;

  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

module.exports = {
  geocodeAddress,
  calculateDistance
};
