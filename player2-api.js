class Player2API {
  constructor() {
  // Use the Vite proxy prefix so requests are forwarded to the backend target in vite.config.js
  // Postman uses http://127.0.0.1:4315/v1/..., so the client uses /v1 and the dev server should proxy /v1 -> backend.
  this.baseUrl = '/v1';
    this.authToken = null;
    this.healthCheckInterval = null;
  // Enable lightweight dev mock responses when running on localhost so UI can be tested
  this.devMock = (typeof window !== 'undefined') && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  }

  // Health Check Endpoint
  async checkHealth() {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }

  // Start periodic health checks (every 60 seconds)
  startHealthChecks() {
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth()
        .then(data => console.log('Health check:', data))
        .catch(error => console.error('Health check error:', error));
    }, 60000);
  }

  // Device Authorization Flow
  async startDeviceAuth(clientId) {
    const response = await fetch(`${this.baseUrl}/login/device/new`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ client_id: clientId })
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 404 && this.devMock) {
        // backend doesn't implement device auth in this environment
        return {};
      }
      throw new Error(`Device auth failed: ${response.status} ${response.statusText} - ${errText}`);
    }

    // some servers may return empty body on unsupported endpoints
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await response.json();
    }
    const bodyText = await response.text();
    try {
      return JSON.parse(bodyText);
    } catch (e) {
      throw new Error(`Unexpected response from device auth endpoint: ${bodyText}`);
    }
  }

  async pollForToken(deviceCode, clientId, interval = 5000) {
    return new Promise((resolve, reject) => {
      const checkAuth = async () => {
        try {
          const response = await fetch(`${this.baseUrl}/login/device/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              device_code: deviceCode,
              client_id: clientId,
              grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            if (response.status === 404 && this.devMock) {
              // token polling not implemented in dev backend
              return reject(new Error('Token polling unsupported in dev environment'));
            }
            return reject(new Error(`Token poll failed: ${response.status} ${response.statusText} - ${errText}`));
          }

          const contentType = response.headers.get('content-type') || '';
          let data;
          if (contentType.includes('application/json')) {
            data = await response.json();
          } else {
            const bodyText = await response.text();
            try { data = JSON.parse(bodyText); } catch (e) { data = null; }
          }

          if (data && data.p2Key) {
            this.authToken = data.p2Key;
            resolve(data);
          } else {
            // keep polling until resolved or an error is thrown
            setTimeout(checkAuth, interval);
          }
        } catch (error) {
          reject(error);
        }
      };

      checkAuth();
    });
  }

  // Chat Completion
  async chatCompletion(messages, stream = false) {
    // Allow unauthenticated chat requests if the backend supports it.
    const headers = { 'Content-Type': 'application/json' };
    if (this.authToken) headers['Authorization'] = `Bearer ${this.authToken}`;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages, stream })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Chat request failed: ${response.status} ${response.statusText} - ${errText}`);
    }

    if (stream) {
      if (!response.body) throw new Error('Streaming response has no body');
      return response.body.getReader();
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await response.json();
    }
    const bodyText = await response.text();
    try { return JSON.parse(bodyText); } catch (e) { throw new Error(`Unexpected non-JSON response: ${bodyText}`); }
  }

  // Text-to-Speech
  async getAvailableVoices() {
    try {
      const response = await fetch(`${this.baseUrl}/tts/voices`);
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to get voices: ${response.status} ${response.statusText} - ${errText}`);
      }
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await response.json();
      }
      const bodyText = await response.text();
      try { return JSON.parse(bodyText); } catch (e) { return { voices: [] }; }
    } catch (error) {
      console.error('getAvailableVoices error:', error);
      return { voices: [] };
    }
  }

  async textToSpeech(text, voiceId, speed = 1.0, format = 'mp3') {
    const headers = { 'Content-Type': 'application/json' };
    if (this.authToken) headers['Authorization'] = `Bearer ${this.authToken}`;

    const response = await fetch(`${this.baseUrl}/tts/speak`, {
      method: 'POST',
      headers,
      // include play_in_app because the backend requires it (422 if missing)
      body: JSON.stringify({ text, voice_ids: [voiceId], speed, audio_format: format, play_in_app: true })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`TTS request failed: ${response.status} ${response.statusText} - ${errText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return data.data; // Base64 encoded audio
    }
    const bodyText = await response.text();
    try {
      const parsed = JSON.parse(bodyText);
      return parsed.data;
    } catch (e) {
      throw new Error(`Unexpected non-JSON TTS response: ${bodyText}`);
    }
  }
}

export default Player2API;
