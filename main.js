import './style.css';
import * as fabric from 'fabric';
import html2canvas from 'html2canvas';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Inicialización del DOM y Variables
  const tshirtBase = document.getElementById('tshirt-base');
  const tshirtColor = document.getElementById('tshirt-color');
  const viewBtns = document.querySelectorAll('.view-btn');
  const colorBtns = document.querySelectorAll('.color-btn');
  const sizeSelect = document.getElementById('size-select');
  const imageUpload = document.getElementById('image-upload');
  const whatsappBtn = document.getElementById('whatsapp-btn');
  const presetGallery = document.getElementById('preset-gallery');
  const objectControls = document.getElementById('object-controls');
  const btnBringFront = document.getElementById('btn-bring-front');
  const btnDelete = document.getElementById('btn-delete');

  let currentView = 'front';
  
  // 2. Inicialización de Fabric.js
  const canvasElement = document.getElementById('design-canvas');
  const canvasWrapper = document.querySelector('.canvas-container-mask');
  
  // Set canvas dimension based on mask bounds
  const rect = canvasWrapper.getBoundingClientRect();
  const canvas = new fabric.Canvas('design-canvas', {
    width: rect.width || 200,
    height: rect.height || 330,
    preserveObjectStacking: true // Evita que el objeto seleccionado pase al frente por defecto perdiendo el z-index real, aunque aca quizas si queramos.
  });

  // Handle Resize
  window.addEventListener('resize', () => {
    const newRect = canvasWrapper.getBoundingClientRect();
    if(newRect.width > 0 && newRect.height > 0) {
      canvas.setDimensions({ width: newRect.width, height: newRect.height });
      canvas.renderAll();
    }
  });

  // Mostrar controles de objeto al seleccionar
  canvas.on('selection:created', showObjectControls);
  canvas.on('selection:updated', showObjectControls);
  canvas.on('selection:cleared', hideObjectControls);

  function showObjectControls() {
    objectControls.style.display = 'flex';
  }
  
  function hideObjectControls() {
    objectControls.style.display = 'none';
  }

  btnBringFront.addEventListener('click', () => {
    const activeObj = canvas.getActiveObject();
    if (activeObj) {
      canvas.bringToFront(activeObj);
    }
  });

  btnDelete.addEventListener('click', () => {
    const activeObjs = canvas.getActiveObjects();
    if (activeObjs.length) {
      canvas.discardActiveObject();
      activeObjs.forEach(obj => canvas.remove(obj));
    }
  });

  // 3. Manejo de Vistas (Frente, Espalda, Costados)
  // Guarda el estado del canvas para cada vista
  const canvasStates = {
    front: null,
    back: null,
    side: null
  };

  viewBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      viewBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Guardar estado actual
      canvasStates[currentView] = canvas.toJSON();

      const newView = btn.dataset.view;
      currentView = newView;
      tshirtBase.className = `tshirt-base bg-${currentView}`;
      tshirtColor.className = `tshirt-color mask-${currentView}`;

      // Restaurar estado de la nueva vista
      canvas.clear();
      if (canvasStates[currentView]) {
        await canvas.loadFromJSON(canvasStates[currentView]);
        canvas.renderAll();
      }
    });
  });

  // 4. Color Picker
  function changeTshirtColor(color) {
    tshirtColor.style.backgroundColor = color;
  }

  colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      colorBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      changeTshirtColor(btn.dataset.color);
    });
  });

  // 5. Manejo de Imágenes
  async function addImageToCanvas(imgUrl) {
    try {
      const img = await fabric.FabricImage.fromURL(imgUrl, { crossOrigin: 'anonymous' });
      // Scale down if image is bigger than canvas
      const scale = Math.min((canvas.width * 0.8) / (img.width || 1), (canvas.height * 0.8) / (img.height || 1), 1);
      
      img.set({
        left: canvas.width / 2,
        top: canvas.height / 2,
        originX: 'center',
        originY: 'center',
        scaleX: scale,
        scaleY: scale,
        cornerColor: '#6c5ce7',
        cornerStyle: 'circle',
        borderColor: '#6c5ce7',
        transparentCorners: false
      });
      
      canvas.add(img);
      canvas.setActiveObject(img);
    } catch(err) {
      console.error(err);
    }
  }

  // Upload local
  imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (f) => {
        addImageToCanvas(f.target.result);
      };
      reader.readAsDataURL(file);
    }
  });

  // Presets
  const dummyPresets = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Z" fill="#111"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128ZM128,48a80,80,0,1,0,80,80A80,80,0,0,0,128,48ZM92,116a12,12,0,1,0-12-12A12,12,0,0,0,92,116Zm72-24a12,12,0,1,0,12,12A12,12,0,0,0,164,92Zm-36,84a60.08,60.08,0,0,0,40.48-15.65,8,8,0,0,0-10.9-11.66A44.07,44.07,0,0,1,128,160a44.07,44.07,0,0,1-29.58-11.31,8,8,0,1,0-10.9,11.66A60.08,60.08,0,0,0,128,176Z" fill="#e74c3c"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M176.62,187.38l-40.23-40.23,40.23-40.23a8,8,0,0,0-11.31-11.31L125.08,135.84,84.85,95.61A8,8,0,0,0,73.54,106.92l40.23,40.23-40.23,40.23a8,8,0,1,0,11.31,11.31l40.23-40.23,40.23,40.23a8,8,0,0,0,11.31-11.31Zm67.38-59.38A116,116,0,1,1,128,12,116.13,116.13,0,0,1,244,128Zm-16,0A100,100,0,1,0,128,228,100.11,100.11,0,0,0,228,128Z" fill="#3498db"/></svg>'
  ];

  dummyPresets.forEach(svgStr => {
    const b64 = btoa(svgStr);
    const dataUrl = `data:image/svg+xml;base64,${b64}`;
    
    // Create DOM element for gallery
    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'preset-img-wrapper';
    const img = document.createElement('img');
    img.src = dataUrl;
    imgWrapper.appendChild(img);
    
    // Click event to add
    imgWrapper.addEventListener('click', () => {
      addImageToCanvas(dataUrl);
    });
    
    presetGallery.appendChild(imgWrapper);
  });

  // 6. Integración con WhatsApp
  whatsappBtn.addEventListener('click', async () => {
    whatsappBtn.innerHTML = '<i class="ph-fill ph-spinner ph-spin"></i> Generando...';
    whatsappBtn.disabled = true;

    // Deseleccionar objetos antes de la captura para ocultar sus controles
    canvas.discardActiveObject();
    canvas.renderAll();

    try {
      // Esperar a que el resize / render impacte
      await new Promise(r => setTimeout(r, 100));

      const wrapper = document.getElementById('canvas-wrapper');
      
      // Removemos la mascara punteada para la captura
      canvasWrapper.style.border = 'none';

      // Capturar usando html2canvas
      const canvasCap = await html2canvas(wrapper, {
        useCORS: true,
        backgroundColor: null,
        scale: 2 // Max calidad
      });

      // Restauramos borde
      canvasWrapper.style.border = '1px dashed rgba(255,255,255,0.2)';
      
      const talle = sizeSelect.value;
      const color = window.getComputedStyle(tshirtColor).backgroundColor;
      const msg = `¡Hola! Quiero hacer un pedido en Revelio.%0A%0A*Detalles de la remera:*%0A- Talle: ${talle}%0A- Vista: ${currentView}%0A%0ATe adjunto la imagen de mi diseño.`;
      const phoneNumber = "YOUR_PHONE_NUMBER_HERE"; // Sustituir por el número
      
      // Descargamos la imagen renderizada
      const link = document.createElement('a');
      link.download = `revelio_diseno_${talle}.png`;
      link.href = canvasCap.toDataURL('image/png');
      link.click();

      // Abrimos WhatsApp
      setTimeout(() => {
         window.location.href = `https://wa.me/${phoneNumber}?text=${msg}`;
      }, 300);
      
    } catch (e) {
      console.error(e);
      alert('Hubo un error al generar la captura.');
    } finally {
      whatsappBtn.innerHTML = '<i class="ph-fill ph-whatsapp-logo"></i> Pedir por WhatsApp';
      whatsappBtn.disabled = false;
    }
  });
});
