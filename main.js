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

// Three.js Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth - 350, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('threejs-container').appendChild(renderer.domElement);

// Room setup
const roomGeometry = new THREE.BoxGeometry(10, 8, 10);
const roomMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x808080,
    side: THREE.BackSide,
});
const room = new THREE.Mesh(roomGeometry, roomMaterial);
scene.add(room);

// Add lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(0, 4, 0);
pointLight.castShadow = true;
scene.add(pointLight);

// Add NPC
const npcGeometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
const npcMaterial = new THREE.MeshStandardMaterial({ color: 0x4444ff });
const npc = new THREE.Mesh(npcGeometry, npcMaterial);
npc.position.set(0, 0, -3);
scene.add(npc);

// First Person Controls setup
camera.position.set(0, 1.6, 4); // Set initial position (eye level)
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const clock = new THREE.Clock();

// Add collision detection
const playerRadius = 0.5;
const playerHeight = 1.6;

document.addEventListener('keydown', (event) => {
    switch(event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = true;
            break;
    }
});

document.addEventListener('keyup', (event) => {
    switch(event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = false;
            break;
    }
});

// Mouse look controls
const pitchObject = new THREE.Object3D();
pitchObject.add(camera);

const yawObject = new THREE.Object3D();
yawObject.position.y = 1.6;
yawObject.add(pitchObject);
scene.add(yawObject);

let isMouseLocked = false;

document.getElementById('threejs-container').addEventListener('click', () => {
    if (!isMouseLocked) {
        document.body.requestPointerLock();
    }
});

document.addEventListener('pointerlockchange', () => {
    isMouseLocked = document.pointerLockElement !== null;
});

document.addEventListener('mousemove', (event) => {
    if (isMouseLocked) {
        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;

        yawObject.rotation.y -= movementX * 0.002;
        pitchObject.rotation.x -= movementY * 0.002;
        pitchObject.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitchObject.rotation.x));
    }
});

function animate() {
    requestAnimationFrame(animate);

    if (isMouseLocked) {
        const delta = clock.getDelta();
        const moveSpeed = 5.0;

        // Reset velocity
        velocity.x = 0;
        velocity.z = 0;

        // Calculate movement direction
        if (moveForward) velocity.z -= moveSpeed * delta;
        if (moveBackward) velocity.z += moveSpeed * delta;
        if (moveLeft) velocity.x -= moveSpeed * delta;
        if (moveRight) velocity.x += moveSpeed * delta;

        // Apply rotation to movement
        if (moveForward || moveBackward || moveLeft || moveRight) {
            const rotation = yawObject.rotation.y;
            const newX = velocity.x * Math.cos(rotation) + velocity.z * Math.sin(rotation);
            const newZ = velocity.z * Math.cos(rotation) - velocity.x * Math.sin(rotation);
            velocity.x = newX;
            velocity.z = newZ;
        }

        // Check room boundaries (with some margin)
        const margin = playerRadius + 0.1;
        const roomHalfWidth = 5 - margin;
        const roomHalfDepth = 5 - margin;

        yawObject.position.x = Math.max(-roomHalfWidth, Math.min(roomHalfWidth, yawObject.position.x + velocity.x));
        yawObject.position.z = Math.max(-roomHalfDepth, Math.min(roomHalfDepth, yawObject.position.z + velocity.z));

        // Check distance to NPC for interaction
        const distanceToNPC = yawObject.position.distanceTo(npc.position);
        if (distanceToNPC < 2) {
            messageInput.placeholder = "Talk to NPC...";
        } else {
            messageInput.placeholder = "Get closer to NPC to talk...";
            messageInput.disabled = true;
        }
    }

    // Make NPC look at player
    npc.lookAt(yawObject.position);
    
    renderer.render(scene, camera);
}
animate();

// Initialize chat immediately
document.addEventListener('DOMContentLoaded', () => {
    messageInput.disabled = false;
    messageForm.querySelector('button').disabled = false;
    authButton.style.display = 'none';
    verificationInfo.style.display = 'none';
    loadVoices();
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
