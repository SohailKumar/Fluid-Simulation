// Import required libraries
import * as THREE from 'three';
import * as tf from '@tensorflow/tfjs';

// Simulation parameters
const Nx = 3; // resolution x-dir
const Ny = 3; // resolution y-dir
const rho0 = 100; // average density
const tau = 0.6; // collision timescale
const Nt = 50; // number of timesteps

const randSeed = 123

// Lattice speeds and weights
const NL = 9;
const cxs = [0, 0, 1, 1, 1, 0, -1, -1, -1];
const cys = [0, 1, 1, 0, -1, -1, -1, 0, 1];
const weights = [4 / 9, 1 / 9, 1 / 36, 1 / 9, 1 / 36, 1 / 9, 1 / 36, 1 / 9, 1 / 36];

// Initialize simulation variables
// console.log("inits:",ones.toString(), rand.toString())
let F = tf.tidy(() => {
    const ones = tf.ones([Ny, Nx, NL])
    const rand = tf.randomNormal([Ny, Nx, NL], 0, 0.01, 'float32', randSeed)
    return ones.add(rand)
});

// let F = tf.ones([Ny, Nx, NL])
// const cylinder = tf.tidy(() => {
//     const x = tf.range(0, Nx, 1, 'float32');
//     const y = tf.range(0, Ny, 1, 'float32');
//     const [X, Y] = tf.meshgrid(x, y);
//     return X.sub(Nx / 4).square().add(Y.sub(Ny / 2).square()).less(Ny * Ny / 16);
// });


// Define functions to get current render dimensions
function getRenderWidth() {
    return window.innerWidth / 2; // Adjust based on your needs
}

function getRenderHeight() {
    return window.innerHeight / 2; // Adjust based on your needs
}

function pause(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

const startButton = document.getElementById('startButton');
const pauseButton = document.getElementById('pauseButton');
const resetButton = document.getElementById('resetButton'); 1

let isPaused = true;

startButton.addEventListener('click', () => {
    isPaused = false;
    startButton.disabled = true
    pauseButton.disabled = false
    console.log(isPaused)
    simulate()
});

pauseButton.addEventListener('click', () => {
    isPaused = true;
    pauseButton.disabled = true
    startButton.disabled = false
    
});

// resetButton.addEventListener('click', () => {
//     // Reset simulation state
//     isPaused = false;
// });

// Initialize Three.js Renderer
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(0, Nx, 0, Ny, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('fluidCanvas') });
renderer.setSize(getRenderWidth(), getRenderHeight());
document.body.prepend(renderer.domElement);

// Add a plane for visualization
let textureData = new Uint8Array(Nx * Ny * 4); // RGBA
let texture = new THREE.DataTexture(textureData, Nx, Ny, THREE.RGBAFormat)
texture.needsUpdate = true
const planeGeometry = new THREE.PlaneGeometry(Nx, Ny);
const planeMaterial = new THREE.MeshBasicMaterial({ map: texture });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
scene.background = new THREE.Color(0x808080); // Set background to gray
scene.add(plane);
camera.position.z = 1;
renderer.render(scene, camera);


function tfRoll(tensor, shift, axis) {
    const size = tensor.shape[axis]; // Get the size along the specified axis
    const normalizedShift = ((shift % size) + size) % size; // Handle negative and large shifts

    if (normalizedShift === 0) {
        return tensor.clone(); // No need to roll if the shift is 0
    }

    const [start, end] = [
        tf.slice(tensor, Array(axis).fill(0).concat([0]), Array(axis).fill(-1).concat([size - normalizedShift])),
        tf.slice(tensor, Array(axis).fill(0).concat([size - normalizedShift]), Array(axis).fill(-1).concat([normalizedShift])),
    ];

    return tf.concat([end, start], axis);
}



function initialize_sim() {
    console.log("F before init: ", F.toString())
    // Assuming TensorFlow.js tensors and Nx, rho0, and idxs are predefined
    F = tf.tidy(() => {
        // Update F[:,:,3]
        const X = tf.range(0, Nx)
        const XScaled = tf.scalar((2 * Math.PI)).mul(X).div(tf.scalar(Nx)).mul(4); // Scale X
        const cosineTerm = tf.cos(XScaled).mul(tf.scalar(0.2)).add(tf.scalar(1)); // 1 + 0.2 * cos(...)
        const addition = cosineTerm.mul(2).expandDims(1); // 2 * (1 + 0.2 * cos(...))
        console.log("addition", addition.toString())
        const updatedF = tf.add(tf.slice(F, [0, 0, 3], [-1, -1, 1]), addition);
        console.log(updatedF.toString())
        F = tf.concat(
            [tf.slice(F, [0, 0, 0], [-1, -1, 3])
            , updatedF
            , tf.slice(F, [0, 0, 4], [-1, -1, -1])],
            2
        );
        console.log(F.toString())

        
        F = tf.tidy(() => {
            // Compute rho = sum(F, axis=2)
            // Compute rho and expand its dimensions
            const rho = F.sum(2);
            
            // Scale all slices of F by rho0 / rho
            return F.mul(rho0).div(rho.expandDims(2)); // Scale the entire tensor
        });
        
        return F;
    });
    console.log("F init:", F.toString())
}



const SIMULATION_INTERVAL = 500
let step = 0

// Simulation main loop
async function simulate() {
    // console.log("F start:",F.toString())
    const intervalId = setInterval(() => {
        if (!isPaused) {
            step += 1
            updateSimulation(step);
        }
    }, SIMULATION_INTERVAL); // Update every second
}

const VISUALIZATION_INTERVAL = 10 // update texture every 10 iterations

function updateSimulation(step) {
    // Drift
    F = tf.tidy(() => {
        // Map and process all velocity components
        const shiftedF = cxs.map((cx, i) => {
            let f = tf.gather(F, i, 2); // Slice a single component
            f = tfRoll(f, cx, 1); // Roll along the x-axis
            f = tfRoll(f, cys[i], 0); // Roll along the y-axis
            return f.expandDims(2); // Expand dimensions to retain shape
        });


        // Concatenate along the last axis to combine all components
        return tf.concat(shiftedF, 2);
    });
    // console.log("F post-drift:",F.toString())

    // const boundaryF = await computeBoundaryF(driftedF, cylinder);

    // Calculate fluid variables
    const rho = tf.tidy(() => { return F.sum(2) });
    const ux = tf.tidy(() => { return F.mul(cxs).sum(2).div(rho) });
    const uy = tf.tidy(() => { return F.mul(cys).sum(2).div(rho) });
    // console.log("Rho:",rho.toString())
    // console.log("uX: ", ux.shape, ux.toString())
    // console.log("uY: ", uy.shape, uy.toString())
    // Apply Collision
    const Feq = tf.tidy(() => {
        const we = weights.map((w, i) => {
            // console.log(w, i)
            const temp = rho.mul(tf.scalar(w))
            const cAdded = ux.mul(tf.scalar(cxs[i])).add(uy.mul(tf.scalar(cys[i])))
            const term0 = tf.scalar(1)
            const term1 = cAdded.mul(tf.scalar(3))
            const term2 = tf.scalar(9).mul(tf.pow(cAdded, 2)).div(tf.scalar(2))
            const term3 = tf.scalar(3).mul((ux.square().add(uy.square()))).div(tf.scalar(2))
            const tempops = term0.add(term1).add(term2).sub(term3)
            return temp.mul(tempops)
        });
        // console.log("weights", we.toString());
        return tf.stack(
            we,
            2
        );
    });
    // console.log("feq", Feq.toString())
    // console.log("F precol:", F.toString())
    F = tf.tidy(() => { return F.add(F.sub(Feq).mul(-1.0 / tau)) });
    console.log("F postcol:", F.toString())
    // Apply boundary conditions
    // F = tf.tidy(() => tf.where(tf.logicalNot(cylinder), F, boundaryF.expandDims(-1)));

    // Visualization
    if (step % VISUALIZATION_INTERVAL === 0) {
        // visualize(F, ux, uy);
        const velocityMagnitude = tf.tidy(() => ux.square().add(uy.square()).sqrt());
        // console.log("velocs: ", velocityMagnitude.toString())
        const normalizedVelocity = tf.tidy(() => {
            const min = velocityMagnitude.min();
            const max = velocityMagnitude.max();
            // console.log(min.toString(), max.toString())
            return tf.where(
                min.equal(max),
                tf.zerosLike(velocityMagnitude), // All zeros if min == max
                velocityMagnitude.sub(min).div(max.sub(min)) // Normalize
            );
        });

        visualize(normalizedVelocity)
    }
}

// Visualization using THREE.js
function visualize(normalizedVelocity) {
    // Convert to texture

    let needsUpdate = false;
    const velArray = normalizedVelocity.dataSync()
    console.log("normzed vel: ", velArray)
    for (let i = 0; i < Nx; i++) {
        for (let j = 0; j < Ny; j++) {
            const idx = (i * Ny + j) * 4;
            const color = Math.floor(velArray[i * Ny + j] * 255);
            // console.log(color)
            if (textureData[idx] !== color) { // Update only if value changed
                textureData[idx] = color;
                textureData[idx + 1] = color;
                textureData[idx + 2] = 255;
                textureData[idx + 3] = 255;
                needsUpdate = true;
            }
        }
    }
    console.log(textureData)
    if (needsUpdate) {
        texture.needsUpdate = true;
        renderer.render(scene, camera);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Start simulation
    initialize_sim()
});

