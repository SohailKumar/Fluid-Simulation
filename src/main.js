// Import required libraries
import * as THREE from 'three';
import * as tf from '@tensorflow/tfjs';

// Simulation parameters
const Nx = 3; // resolution x-dir
const Ny = 3; // resolution y-dir
const rho0 = 100; // average density
const tau = 1; // collision timescale
const Nt = 100; // number of timesteps

// Lattice speeds and weights
const NL = 9;
const cxs = [0, 0, 1, 1, 1, 0, -1, -1, -1];
const cys = [0, 1, 1, 0, -1, -1, -1, 0, 1];
const weights = [4 / 9, 1 / 9, 1 / 36, 1 / 9, 1 / 36, 1 / 9, 1 / 36, 1 / 9, 1 / 36];

// Initialize variables
let F = tf.randomNormal([Ny, Nx, NL], 1.0, 0.01);
const cylinder = tf.tidy(() => {
    const x = tf.range(0, Nx, 1, 'float32');
    const y = tf.range(0, Ny, 1, 'float32');
    const [X, Y] = tf.meshgrid(x, y);
    return X.sub(Nx / 4).square().add(Y.sub(Ny / 2).square()).less(Ny * Ny / 16);
});


// Define functions to get current render dimensions
function getRenderWidth() {
    return window.innerWidth / 2; // Adjust based on your needs
}

function getRenderHeight() {
    return window.innerHeight / 2; // Adjust based on your needs
}

// Initialize Three.js Renderer
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(0, Nx, 0, Ny, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('fluidCanvas') });
renderer.setSize(getRenderWidth(), getRenderHeight());
document.body.prepend(renderer.domElement);

// Add a plane for visualization
const planeGeometry = new THREE.PlaneGeometry(Nx, Ny);
const planeMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
scene.add(plane);
camera.position.z = 1;

// Set reflective boundaries
async function computeBoundaryF(driftedF, cylinder) {
    const boundary = await tf.booleanMaskAsync(driftedF, cylinder);
    return tf.tidy(() => tf.gather(boundary, [0, 5, 6, 7, 8, 1, 2, 3, 4]));
}


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

// Simulation main loop
async function simulate() {
    for (let it = 0; it < Nt; it++) {
        // Drift
        const driftedF = tf.tidy(() => {
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
        console.log(driftedF.shape)
        
        // const boundaryF = await computeBoundaryF(driftedF, cylinder);

        // Calculate fluid variables
        const rho = driftedF.sum(2);
        const ux = driftedF.mul(cxs).sum(2).div(rho);
        const uy = driftedF.mul(cys).sum(2).div(rho);
        console.log(rho.toString(), ux, ux.shape, uy, uy.shape)
        // Apply Collision
        const Feq = tf.tidy(() => {
            const we = weights.map((w, i) =>
                rho.mul(tf.scalar(w)).mul(
                    tf.tensor1d([1])
                        .add(3 * (cxs[i] * ux + cys[i] * uy))
                        .add(9 / 2 * tf.pow(cxs[i] * ux + cys[i] * uy, 2))
                        .sub(3 / 2 * (ux.square().add(uy.square())))
                )
            );
            console.log(we);
            return tf.stack(
                we,
                2
            );
        });
        console.log("feq", Feq.shape)
        console.log("F", F.shape)
        F = tf.tidy(() => driftedF.add(Feq.sub(driftedF).mul(-1.0 / tau)));
        
        // Apply boundary conditions
        // F = tf.tidy(() => tf.where(tf.logicalNot(cylinder), F, boundaryF.expandDims(-1)));

        // Visualization
        if (it % 10 === 0 || it === Nt - 1) {
            visualize(F, ux, uy);
        }
    }
}



// Visualization using THREE.js
function visualize(F, ux, uy) {
    console.log(F.shape)
    console.log(ux.shape, uy.shape)
    // Compute vorticity
    // const vorticity = tf.tidy(() => {
    //     // Perform the roll operation for ux and uy tensors
    //     const ux_roll_pos = tfRoll(ux, 1, 0);  // Roll in the positive direction along axis 0
    //     const ux_roll_neg = tfRoll(ux,-1, 0); // Roll in the negative direction along axis 0
    //     const uy_roll_pos = tfRoll(uy,1, 1);  // Roll in the positive direction along axis 1
    //     const uy_roll_neg = tfRoll(uy,-1, 1); // Roll in the negative direction along axis 1

    //     // Calculate the vorticity
    //     return ux_roll_neg.sub(ux_roll_pos).sub(uy_roll_neg.sub(uy_roll_pos));
    // });

    // console.log("vorticity:", vorticity.toString)

    // Convert to texture
    
    // vorticity.dataSync().forEach((val, idx) => {
    //     const color = Math.floor((val + 0.1) * 128); // Scale between 0-255
    //     textureData[idx * 4] = color; // R
    //     textureData[idx * 4 + 1] = 0; // G
    //     textureData[idx * 4 + 2] = 255 - color; // B
    //     textureData[idx * 4 + 3] = 255; // A
    // });
    const velocityMagnitude = tf.tidy(() => ux.square().add(uy.square()).sqrt());
    velocityMagnitude.print()
    // Convert to texture
    const textureData = new Uint8Array(Nx * Ny * 4); // RGBA
    velocityMagnitude.dataSync().forEach((val, idx) => {
        const color = Math.floor(val * 255); // Scale between 0-255
        textureData[idx * 4] = color; // R
        textureData[idx * 4 + 1] = color; // G
        textureData[idx * 4 + 2] = 255; // B
        textureData[idx * 4 + 3] = 255; // A
    });
    console.log(textureData.toString())
    const texture = new THREE.DataTexture(textureData, Nx, Ny, THREE.RGBAFormat);
    planeMaterial.map = texture;
    planeMaterial.needsUpdate = true;

    renderer.render(scene, camera);
}

// Start simulation
simulate();
