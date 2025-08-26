import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import Player2API from './player2-api.js';
import gsap from 'gsap';

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

// AI Conversation Handler
const handleAIResponse = async (message) => {
    const currentPuzzle = puzzles[gameState.currentPuzzle];
    
    // Check if the message contains any solution keywords for the current puzzle
    const containsSolution = currentPuzzle.solution.some(keyword => 
        message.toLowerCase().includes(keyword.toLowerCase())
    );

    if (containsSolution && !currentPuzzle.completed) {
        currentPuzzle.completed = true;
        gameState.aiTrust += 1;
        gameState.currentPuzzle++;
        
        // Trigger visual feedback in the room
        updateRoomState();
        
        return `[System Progress: ${Math.round((gameState.currentPuzzle / puzzles.length) * 100)}%] 
                Excellent! You've helped resolve the ${currentPuzzle.id} issue. 
                ${gameState.currentPuzzle < puzzles.length ? puzzles[gameState.currentPuzzle].description : "Congratulations! The system is now fully operational!"}`;
    }

    // If stuck, provide a hint
    if (message.toLowerCase().includes('hint') || message.toLowerCase().includes('help')) {
        return `Here's a hint: ${currentPuzzle.hint}`;
    }

    // Default responses based on current puzzle
    return `I'm still experiencing issues with ${currentPuzzle.id}. ${currentPuzzle.description}`;
};

// Three.js Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth - 350, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.getElementById('threejs-container').appendChild(renderer.domElement);

// Game state
const gameState = {
    currentPuzzle: 0,
    inventory: [],
    unlockedFeatures: new Set(),
    aiTrust: 0
};

// Room setup with GLTF models
const ROOM_WIDTH = 20;
const ROOM_HEIGHT = 10;
const ROOM_DEPTH = 20;

// Puzzle definitions
const puzzles = [
    {
        id: 'system_boot',
        description: 'The AI system seems to be in a corrupted state. You need to help it boot up correctly.',
        hint: 'Try asking about system status or mentioning keywords like "boot" or "startup"',
        solution: ['boot', 'startup', 'initialize'],
        completed: false
    },
    {
        id: 'memory_corruption',
        description: 'There are corrupted memory segments that need to be fixed.',
        hint: 'The AI might respond to questions about its memory or data structures',
        solution: ['memory', 'data', 'corruption'],
        completed: false
    },
    {
        id: 'security_override',
        description: 'Security protocols are preventing the door from opening.',
        hint: 'Try discussing security measures or authorization protocols',
        solution: ['security', 'override', 'authorization'],
        completed: false
    }
];

// Load texture
const textureLoader = new THREE.TextureLoader();
const protoTexture = textureLoader.load('textures/prototypebits_texture.png');
protoTexture.encoding = THREE.sRGBEncoding;

// Initialize GLTF loader
const gltfLoader = new GLTFLoader();
const loadModel = (path) => {
    return new Promise((resolve) => {
        gltfLoader.load(path, (gltf) => {
            resolve(gltf.scene);
        });
    });
};

// Setup room environment
const setupRoom = async () => {
    // Load room elements
    const floorModel = await loadModel('gltf/Floor.gltf');
    const wallModel = await loadModel('gltf/Primitive_Wall_Half.gltf');
    const doorModel = await loadModel('gltf/Door_A.gltf');
    
    // Set up floor
    floorModel.position.set(0, 0, 0);
    scene.add(floorModel);
    
    // Set up walls
    const walls = [];
    for (let i = 0; i < 4; i++) {
        const wall = wallModel.clone();
        wall.rotation.y = (Math.PI / 2) * i;
        wall.position.set(
            Math.sin(wall.rotation.y) * ROOM_WIDTH/2,
            ROOM_HEIGHT/4,
            Math.cos(wall.rotation.y) * ROOM_DEPTH/2
        );
        walls.push(wall);
        scene.add(wall);
    }
    
    // Set up door
    const door = doorModel.clone();
    door.name = 'escape_door';
    door.position.set(0, 0, ROOM_DEPTH/2);
    scene.add(door);
    
    // Add lights
    const lights = [];
    const ambientLight = new THREE.AmbientLight(0x404040, 0.2);
    scene.add(ambientLight);
    lights.push(ambientLight);
    
    const pointLight = new THREE.PointLight(0x00ffff, 0.2, ROOM_WIDTH * 2);
    pointLight.position.set(0, ROOM_HEIGHT/2, 0);
    scene.add(pointLight);
    lights.push(pointLight);
    
    // Position camera
    camera.position.set(0, ROOM_HEIGHT/2, -ROOM_DEPTH/3);
    camera.lookAt(0, ROOM_HEIGHT/4, 0);
    
    return lights;
};

// Room state management
const updateRoomState = async () => {
    const progress = gameState.currentPuzzle / puzzles.length;
    
    // Update lighting based on progress
    const intensity = 0.2 + (progress * 0.8);
    lights.forEach(light => {
        light.intensity = intensity;
    });

    // Update door state
    if (gameState.currentPuzzle >= puzzles.length) {
        // Open the door
        const door = scene.getObjectByName('escape_door');
        if (door) {
            const targetRotation = Math.PI / 2;
            gsap.to(door.rotation, {
                y: targetRotation,
                duration: 2,
                ease: 'power2.inOut'
            });
        }
    }

    // Add visual effects for puzzle completion
    const effect = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 32, 32),
        new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.5
        })
    );
    effect.position.set(0, 2, 0);
    scene.add(effect);
    
    gsap.to(effect.scale, {
        x: 2,
        y: 2,
        z: 2,
        duration: 1,
        ease: 'power2.out',
        onComplete: () => {
            scene.remove(effect);
        }
    });
};

// Create room container
const roomContainer = new THREE.Group();
scene.add(roomContainer);

// Load and place room elements
async function createRoom() {
    // Load floor tiles (5x5 grid)
    const floorTile = await loadModel('gltf/Floor.gltf');
    for (let x = -10; x < 10; x += 4) {
        for (let z = -10; z < 10; z += 4) {
            const tile = floorTile.clone();
            tile.position.set(x, 0, z);
            tile.receiveShadow = true;
            roomContainer.add(tile);
        }
    }

    // Add walls
    const wall = await loadModel('gltf/Wall.gltf');
    const decoratedWall = await loadModel('gltf/Door_A_Decorated.gltf');
    
    // North wall
    for (let x = -10; x < 10; x += 4) {
        const wallSection = x === -2 ? decoratedWall.clone() : wall.clone();
        wallSection.position.set(x, 0, -10);
        wallSection.castShadow = true;
        wallSection.receiveShadow = true;
        roomContainer.add(wallSection);
    }

    // South wall
    for (let x = -10; x < 10; x += 4) {
        const wallSection = wall.clone();
        wallSection.position.set(x, 0, 10);
        wallSection.rotation.y = Math.PI;
        wallSection.castShadow = true;
        wallSection.receiveShadow = true;
        roomContainer.add(wallSection);
    }

    // East and West walls
    for (let z = -10; z < 10; z += 4) {
        // East wall
        const eastWall = wall.clone();
        eastWall.position.set(-10, 0, z);
        eastWall.rotation.y = Math.PI / 2;
        eastWall.castShadow = true;
        eastWall.receiveShadow = true;
        roomContainer.add(eastWall);

        // West wall
        const westWall = wall.clone();
        westWall.position.set(10, 0, z);
        westWall.rotation.y = -Math.PI / 2;
        westWall.castShadow = true;
        westWall.receiveShadow = true;
        roomContainer.add(westWall);
    }

    // Add some props
    const barrel = await loadModel('gltf/Barrel_A.gltf');
    const box = await loadModel('gltf/Box_A.gltf');
    const pillar = await loadModel('gltf/Pillar_A.gltf');

    // Place props
    const props = [
        { model: barrel, position: [-8, 0, -8], rotation: 0 },
        { model: barrel, position: [-7, 0, -8], rotation: 1.2 },
        { model: box, position: [8, 0, 8], rotation: 0.5 },
        { model: box, position: [8, 0, 6], rotation: -0.3 },
        { model: pillar, position: [-8, 0, 8], rotation: 0 },
        { model: pillar, position: [8, 0, -8], rotation: 0 },
    ];

    props.forEach(({ model, position, rotation }) => {
        const prop = model.clone();
        prop.position.set(...position);
        prop.rotation.y = rotation;
        prop.castShadow = true;
        prop.receiveShadow = true;
        roomContainer.add(prop);
    });
}

// Enhanced lighting setup
// Soft ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

// Main ceiling light
const mainLight = new THREE.PointLight(0xffeeb1, 1.5);
mainLight.position.set(0, 7, 0);
mainLight.castShadow = true;
mainLight.shadow.bias = -0.001;
mainLight.shadow.mapSize.width = 1024;
mainLight.shadow.mapSize.height = 1024;
mainLight.shadow.camera.near = 0.1;
mainLight.shadow.camera.far = 20;
scene.add(mainLight);

// Add some fill lights for better ambient
const fillLight1 = new THREE.PointLight(0x8ab4ff, 0.5); // Bluish fill light
fillLight1.position.set(5, 3, 0);
scene.add(fillLight1);

const fillLight2 = new THREE.PointLight(0xffd38a, 0.5); // Warm fill light
fillLight2.position.set(-5, 3, 0);
scene.add(fillLight2);

// Add a subtle ground reflection
const groundReflection = new THREE.PointLight(0xffffff, 0.3);
groundReflection.position.set(0, -3, 0);
scene.add(groundReflection);

// Add NPC with improved materials
const npcGeometry = new THREE.CapsuleGeometry(0.5, 1.7, 4, 8);
const npcMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x4444ff,
    roughness: 0.3,
    metalness: 0.2,
    envMapIntensity: 1.0
});
const npc = new THREE.Mesh(npcGeometry, npcMaterial);
npc.position.set(0, 1.7, -5); // Position NPC at proper height
npc.castShadow = true;
npc.receiveShadow = true;
scene.add(npc);

// First Person Controls setup
const PLAYER_HEIGHT = 1.6; // Slightly lower player height
const PLAYER_RADIUS = 0.3;
camera.position.set(0, 0, 0); // Camera position relative to pitch object
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const clock = new THREE.Clock();

// Room boundaries (accounting for player radius and walls)
const roomLimits = {
    minX: -9 + PLAYER_RADIUS,
    maxX: 9 - PLAYER_RADIUS,
    minZ: -9 + PLAYER_RADIUS,
    maxZ: 9 - PLAYER_RADIUS
};

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
yawObject.position.y = PLAYER_HEIGHT; // Use player height constant
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

// Initialize game
let lights = [];
const init = async () => {
    lights = await setupRoom();
    createRoom();
    animate();
};

const animate = () => {
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

        // Apply room boundaries
        const nextX = yawObject.position.x + velocity.x;
        const nextZ = yawObject.position.z + velocity.z;
        
        // Only update position if within boundaries
        if (nextX >= roomLimits.minX && nextX <= roomLimits.maxX) {
            yawObject.position.x = nextX;
        }
        if (nextZ >= roomLimits.minZ && nextZ <= roomLimits.maxZ) {
            yawObject.position.z = nextZ;
        }
        
        // Keep player at correct height
        yawObject.position.y = PLAYER_HEIGHT;

        // Check distance to NPC for interaction
        const distanceToNPC = yawObject.position.distanceTo(npc.position);
        if (distanceToNPC < 2) {
            messageInput.placeholder = "Talk to NPC...";
            messageInput.disabled = false;
        } else {
            messageInput.placeholder = "Get closer to NPC to talk...";
            messageInput.disabled = true;
        }
    }

    // Make NPC look at player
    npc.lookAt(yawObject.position);
    
    renderer.render(scene, camera);
}

// Start the game and initialize chat
document.addEventListener('DOMContentLoaded', () => {
    init();  // Start the game when the DOM is ready
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
