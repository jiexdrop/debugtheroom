import * as THREE from 'three';
import Player2API from './player2-api.js';

// DOM Elements
const authButton = document.getElementById('auth-button');
const verificationInfo = document.getElementById('verification-info');
const verificationLink = document.getElementById('verification-link');
const userCode = document.getElementById('user-code');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages');

// Initialize Player2 API Client
const p2 = new Player2API();
let selectedVoiceId = null;

// Three.js Basic Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth - 350, window.innerHeight);
document.getElementById('threejs-container').appendChild(renderer.domElement);

// Add basic cube for visualization
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);
camera.position.z = 5;

function animate() {
  requestAnimationFrame(animate);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}
animate();

// Authentication Flow
authButton.addEventListener('click', async () => {
  try {
    authButton.disabled = true;
    authButton.textContent = 'Starting authentication...';
    // The backend may allow unauthenticated chat. Try to start device auth but don't block chat.
    try {
      const authData = await p2.startDeviceAuth('susume-bratislava');
      if (authData?.verificationUri) {
        verificationInfo.style.display = 'block';
        verificationLink.href = authData.verificationUriComplete || authData.verificationUri;
        verificationLink.textContent = authData.verificationUri;
        userCode.textContent = authData.userCode || '';
      }

      // Try to poll for a token but don't fail the whole flow if polling isn't supported.
      try {
        await p2.pollForToken(authData.deviceCode, 'susume-bratislava');
        verificationInfo.style.display = 'none';
        authButton.style.display = 'none';
      } catch (pollErr) {
        console.warn('Token polling failed or unsupported:', pollErr);
        // keep auth UI visible so the user can manually authenticate if desired
      }
    } catch (err) {
      console.warn('Device auth not available or failed, continuing without auth:', err);
      // Hide verification UI if server doesn't support device auth
      verificationInfo.style.display = 'none';
    }

    // Enable chat UI regardless of whether auth succeeded
    messageInput.disabled = false;
    messageForm.querySelector('button').disabled = false;
    p2.startHealthChecks();
    loadVoices();
  } catch (error) {
    console.error('Authentication failed:', error);
    authButton.disabled = false;
    authButton.textContent = 'Login failed - Try again';
  }
});

// Voice Selection
async function loadVoices() {
  try {
    const voices = await p2.getAvailableVoices();
    selectedVoiceId = voices.voices[0]?.id;
  } catch (error) {
    console.error('Failed to load voices:', error);
  }
}

// Chat Handling
messageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();
  if (!message) return;

  appendMessage(message, 'user');
  messageInput.value = '';

  try {
    const response = await p2.chatCompletion([{
      role: 'user',
      content: message
    }]);

    const aiMessage = response.choices[0].message.content;
    appendMessage(aiMessage, 'ai');
    
    // Convert response to speech
    if (selectedVoiceId) {
      const audioData = await p2.textToSpeech(aiMessage, selectedVoiceId);
      if (audioData) {
        playAudio(audioData);
      } else {
        console.debug('No TTS audio returned by backend (dev fallback or missing endpoint)');
      }
    }
  } catch (error) {
    console.error('Chat failed:', error);
    appendMessage('Failed to get response', 'error');
  }
});

function appendMessage(text, type) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}-message`;
  messageDiv.textContent = text;
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function playAudio(base64Data) {
  const audio = new Audio(`data:audio/mp3;base64,${base64Data}`);
  audio.play();
}

// Window resize handler
window.addEventListener('resize', () => {
  camera.aspect = (window.innerWidth - 350) / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth - 350, window.innerHeight);
});
