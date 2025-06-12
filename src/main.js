// main.js

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'dat.gui';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { CSG } from 'three-csg-ts';

// Beschikbare fonts
const fontChoices = {
  Helvetiker: 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
  Optimer: 'https://threejs.org/examples/fonts/optimer_regular.typeface.json',
  Gentilis: 'https://threejs.org/examples/fonts/gentilis_regular.typeface.json',
  Droid: 'https://threejs.org/examples/fonts/droid/droid_sans_regular.typeface.json'
};

// Parameters voor de GUI
const params = {
  diceType: 'd20',
  diceSize: 5,
  font: 'Helvetiker',
  fontSize: 1.5,   // Pas aan voor gewenste grootte van cijfers
  depth: 0.4,      // Diepte van de uitsparingen
  textScale: 1.0,  // Schaal van de cijfers
  replaceHighestWithIcon: false,
  rounding: 0.0,   // Afrondingsfactor (voor nu op 0)
  exportSTL: function () { exportToSTL(); }
};

// Basisopzet van de scène, camera en renderer
let scene, camera, renderer, controls;
let dice, diceMaterial;
let font;
let fontLoader;

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

  // Font loader
  fontLoader = new FontLoader();
  loadSelectedFont(createDice);

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

  const size = params.diceSize;
  let geometry;
  switch (params.diceType) {
    case 'd4':
      geometry = new THREE.TetrahedronGeometry(size, 0);
      break;
    case 'd6':
      geometry = new THREE.BoxGeometry(size * 2, size * 2, size * 2);
      break;
    case 'd8':
      geometry = new THREE.OctahedronGeometry(size, 0);
      break;
    case 'd10':
      geometry = createD10Geometry(size);
      break;
    case 'd12':
      geometry = new THREE.DodecahedronGeometry(size, 0);
      break;
    case 'd20':
    default:
      geometry = new THREE.IcosahedronGeometry(size, 0);
  }

const diceMesh = new THREE.Mesh(geometry, diceMaterial);
  addNumbersAndSubtract(diceMesh);
}

function loadSelectedFont(callback) {
  const url = fontChoices[params.font];
  if (!url) {
    console.error('Font niet gevonden:', params.font);
    return;
  }
  fontLoader.load(url, (loadedFont) => {
    font = loadedFont;
    if (callback) callback();
  }, undefined, (err) => {
    console.error('Fout bij laden font', err);
  });
}

// Benadering van een d10 (pentagonale bipiramide)
function createD10Geometry(size) {
  const h = size;
  const r = size * 0.9;
  const vertices = [];
  // bovenste punt
  vertices.push(0, h, 0);
  // onderste punt
  vertices.push(0, -h, 0);
  // vijf punten rond het midden
  for (let i = 0; i < 5; i++) {
    const angle = (i * 72) * Math.PI / 180;
    vertices.push(Math.cos(angle) * r, 0, Math.sin(angle) * r);
  }

  const indices = [];
  // bovenste driehoeken
  for (let i = 0; i < 5; i++) {
    const next = i === 4 ? 0 : i + 1;
    indices.push(0, 2 + i, 2 + next);
  }
  // onderste driehoeken
  for (let i = 0; i < 5; i++) {
    const next = i === 4 ? 0 : i + 1;
    indices.push(1, 2 + next, 2 + i);
  }
  const geometry = new THREE.PolyhedronGeometry(vertices, indices, size, 0);
  return geometry;
}

function createStarGeometry(size) {
  const outer = size;
  const inner = size * 0.5;
  const shape = new THREE.Shape();
  for (let i = 0; i < 5; i++) {
    const angleOuter = (i * 72 - 90) * Math.PI / 180;
    const xOuter = Math.cos(angleOuter) * outer;
    const yOuter = Math.sin(angleOuter) * outer;
    if (i === 0) {
      shape.moveTo(xOuter, yOuter);
    } else {
      shape.lineTo(xOuter, yOuter);
    }
    const angleInner = angleOuter + 36 * Math.PI / 180;
    const xInner = Math.cos(angleInner) * inner;
    const yInner = Math.sin(angleInner) * inner;
    shape.lineTo(xInner, yInner);
  }
  shape.closePath();
  const extrudeSettings = { depth: params.depth, bevelEnabled: false };
  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
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

  const highest = faceNormals.length;
  // Voeg cijfers toe en voer booleaanse subtractie uit
  for (let i = 0; i < faceNormals.length; i++) {
    const number = i + 1;
    let geometry;
    if (params.replaceHighestWithIcon && number === highest) {
      geometry = createStarGeometry(params.fontSize);
    } else {
      geometry = new TextGeometry(number.toString(), textOptions);
      geometry.computeBoundingBox();
      const center = new THREE.Vector3();
      geometry.boundingBox.getCenter(center);
      geometry.translate(-center.x, -center.y, -center.z);
    }

    // Maak een Mesh van het cijfer of icoon
    const textMesh = new THREE.Mesh(geometry);

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

  gui.add(params, 'diceType', ['d4','d6','d8','d10','d12','d20']).name('Type Dobbelsteen').onChange(() => {
    createDice();
  });
  gui.add(params, 'diceSize', 1, 10).name('Dobbelsteen Grootte').onChange(() => {
    createDice();
  });
  gui.add(params, 'font', Object.keys(fontChoices)).name('Font').onChange(() => {
    loadSelectedFont(createDice);
  });
  gui.add(params, 'fontSize', 0.5, 3).name('Lettergrootte').onChange(createDice);
  gui.add(params, 'depth', 0.1, 1).name('Diepte Cijfers').onChange(createDice);
  gui.add(params, 'textScale', 0.5, 2).name('Schaal Cijfers').onChange(createDice);
  gui.add(params, 'replaceHighestWithIcon').name('Hoogste met Icoon').onChange(createDice);
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
