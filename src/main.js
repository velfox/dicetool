// main.js

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'dat.gui';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { CSG } from 'three-csg-ts';

// Parameters voor de GUI
const params = {
  diceSize: 5,
  fontSize: 1.5,   // Pas aan voor gewenste grootte van cijfers
  depth: 0.4,      // Diepte van de uitsparingen
  textScale: 1.0,  // Schaal van de cijfers
  rounding: 0.0,   // Afrondingsfactor (voor nu op 0)
  exportSTL: function () { exportToSTL(); }
};

// Basisopzet van de scène, camera en renderer
let scene, camera, renderer, controls;
let dice, diceMaterial;
let font;

init();
animate();

function init() {
  // Scène
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  // Camera
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
  camera.position.set(0, 0, 30);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('canvas-container').appendChild(renderer.domElement);

  // Verlichting
  const ambientLight = new THREE.AmbientLight(0xcccccc, 0.4);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 0).normalize();
  scene.add(directionalLight);

  // Dobbelsteenmateriaal
  diceMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    flatShading: true,
    metalness: 0.2,
    roughness: 0.7,
    side: THREE.DoubleSide
  });

  // Font laden
  const loader = new FontLoader();
  loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', function (loadedFont) {
    font = loadedFont;
    console.log('Font loaded:', font);
    // Dobbelsteen creëren na het laden van het font
    createDice();
  }, undefined, function (error) {
    console.error('Er is een fout opgetreden bij het laden van het font:', error);
  });

  // GUI instellen
  initGUI();

  // OrbitControls
  controls = new OrbitControls(camera, renderer.domElement);

  // Event listener voor venstergrootte
  window.addEventListener('resize', onWindowResize, false);
}

function createDice() {
  // Verwijder bestaande dobbelsteen als die er is
  if (dice) scene.remove(dice);

  // Geometrie voor de d20 dobbelsteen met vaste 20 zijden
  const radius = params.diceSize;
  const diceGeometry = new THREE.IcosahedronGeometry(radius, 0); // detail is 0 voor 20 zijden

  // Maak een Mesh van de dobbelsteen
  const diceMesh = new THREE.Mesh(diceGeometry, diceMaterial);

  // Voeg cijfers toe en hol ze uit de dobbelsteen
  addNumbersAndSubtract(diceMesh);
}

function addNumbersAndSubtract(diceMesh) {
  const textOptions = {
    font: font,
    size: params.fontSize,
    depth: params.depth,
    curveSegments: 12,
    bevelEnabled: false,
  };

  // Bereken de normale vectoren en middens van de zijden
  const faceNormals = [];
  const positionAttribute = diceMesh.geometry.getAttribute('position');
  const index = diceMesh.geometry.index;

  if (index) {
    // Geïndexeerde geometrie
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      const b = index.getX(i + 1);
      const c = index.getX(i + 2);

      const vA = new THREE.Vector3().fromBufferAttribute(positionAttribute, a);
      const vB = new THREE.Vector3().fromBufferAttribute(positionAttribute, b);
      const vC = new THREE.Vector3().fromBufferAttribute(positionAttribute, c);

      const center = new THREE.Vector3().addVectors(vA, vB).add(vC).divideScalar(3);
      const normal = new THREE.Triangle(vA, vB, vC).getNormal(new THREE.Vector3());

      faceNormals.push({ normal: normal, center: center });
    }
  } else {
    // Niet-geïndexeerde geometrie
    for (let i = 0; i < positionAttribute.count; i += 3) {
      const vA = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
      const vB = new THREE.Vector3().fromBufferAttribute(positionAttribute, i + 1);
      const vC = new THREE.Vector3().fromBufferAttribute(positionAttribute, i + 2);

      const center = new THREE.Vector3().addVectors(vA, vB).add(vC).divideScalar(3);
      const normal = new THREE.Triangle(vA, vB, vC).getNormal(new THREE.Vector3());

      faceNormals.push({ normal: normal, center: center });
    }
  }

  // Maak een CSG object van de dobbelsteen
  let csgDice = CSG.fromMesh(diceMesh);

  // Voeg cijfers toe en voer booleaanse subtractie uit
  for (let i = 0; i < faceNormals.length; i++) {
    const number = i + 1;
    const textGeometry = new TextGeometry(number.toString(), textOptions);

    // Maak een Mesh van het cijfer
    const textMesh = new THREE.Mesh(textGeometry);

    // Bereken de positie met offset
    const normalData = faceNormals[i];
    const offsetDistance = params.depth / 2; // Om ervoor te zorgen dat de uitsparing volledig is
    const position = normalData.center.clone().add(normalData.normal.clone().multiplyScalar(offsetDistance));

    // Pas positie en oriëntatie toe
    textMesh.position.copy(position);

    // Oriënteer de textMesh zodat het naar buiten wijst langs de normale
    textMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      normalData.normal.clone()
    );

    // Schaal het cijfer op basis van de parameters
    textMesh.scale.multiplyScalar(params.textScale);

    // Update de matrix van de textMesh
    textMesh.updateMatrixWorld(true);

    // Log details for debugging
    console.log(`Number: ${number}`);
    console.log(`Position: ${textMesh.position.toArray()}`);
    console.log(`Quaternion: ${textMesh.quaternion.toArray()}`);
    console.log(`Scale: ${textMesh.scale.toArray()}`);

    // Maak een CSG object van het cijfer
    const csgText = CSG.fromMesh(textMesh);

    // Trek het cijfer af van de dobbelsteen
    csgDice = csgDice.subtract(csgText);
  }

  // Converteer terug naar een Three.js Mesh
  dice = CSG.toMesh(csgDice, diceMesh.matrix, diceMaterial);
  dice.geometry.computeVertexNormals();
  scene.add(dice);
}

function initGUI() {
  const gui = new GUI({ autoPlace: false });
  document.getElementById('gui-container').appendChild(gui.domElement);

  gui.add(params, 'diceSize', 1, 10).name('Dobbelsteen Grootte').onChange(() => {
    createDice();
  });
  gui.add(params, 'fontSize', 0.5, 3).name('Lettergrootte').onChange(createDice);
  gui.add(params, 'depth', 0.1, 1).name('Diepte Cijfers').onChange(createDice);
  gui.add(params, 'textScale', 0.5, 2).name('Schaal Cijfers').onChange(createDice);
  // Afronding is voor nu uitgeschakeld
  // gui.add(params, 'rounding', 0, 1).name('Ronding').onChange(createDice);
  gui.add(params, 'exportSTL').name('Exporteer STL');
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  if (dice) {
    dice.rotation.y += 0.005;
  }
  renderer.render(scene, camera);
  controls.update();
}

function exportToSTL() {
  const exporter = new STLExporter();
  const result = exporter.parse(dice); // Exporteer alleen de dobbelsteenmesh

  // STL-bestand downloaden
  const blob = new Blob([result], { type: 'text/plain' });
  const link = document.createElement('a');
  link.style.display = 'none';
  document.body.appendChild(link);
  link.href = URL.createObjectURL(blob);
  link.download = 'd20_dobbelsteen.stl';
  link.click();
}