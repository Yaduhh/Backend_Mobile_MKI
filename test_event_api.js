const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000/api';

// Test function untuk login dan mendapatkan token
async function login() {
  try {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@mki.com',
        password: 'admin123'
      })
    });

    const data = await response.json();
    
    if (data.success) {
      return data.data.token;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
}

// Test function untuk mengambil events
async function testGetEvents(token) {
  try {
    const response = await fetch(`${BASE_URL}/events`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (data.success && data.data.length > 0) {
      return data.data[0].id; // Return first event ID
    } else {
      return null;
    }
  } catch (error) {
    console.error('Get events error:', error);
    return null;
  }
}

// Test function untuk mengambil detail event
async function testGetEventDetail(token, eventId) {
  try {
    const response = await fetch(`${BASE_URL}/events/${eventId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    return data;
  } catch (error) {
    console.error('Get event detail error:', error);
    return null;
  }
}

// Main test function
async function runTests() {
    // Test login
  const token = await login();
  if (!token) {
    return;
  }
    // Test get events
  const eventId = await testGetEvents(token);
  if (!eventId) {
    return;
  }
    // Test get event detail
  const eventDetail = await testGetEventDetail(token, eventId);
  if (eventDetail) {
    return;
  }
}

runTests().catch(console.error); 