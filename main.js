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
  const presetSearch = document.getElementById('preset-search');
  const presetCategory = document.getElementById('preset-category');
  const objectControls = document.getElementById('object-controls');
  const btnBringFront = document.getElementById('btn-bring-front');
  const btnDelete = document.getElementById('btn-delete');

  let currentView = 'front';
  let currentColorName = 'Blanco';

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
    if (newRect.width > 0 && newRect.height > 0) {
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
      currentColorName = btn.dataset.name;
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
        transparentCorners: false,
        lockUniScaling: true // Obliga a escalar proporcionalmente
      });

      // Ocultar manijas centrales (arriba, abajo, izquierda, derecha)
      img.setControlsVisibility({
        mt: false, 
        mb: false, 
        ml: false, 
        mr: false
      });

      canvas.add(img);
      canvas.setActiveObject(img);
    } catch (err) {
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

  // Presets Dinámicos vía Vite Glob Import
  const designFiles = import.meta.glob('/public/designs/**/*.*', { eager: true });
  
  const presetsData = [];
  const categoriesSet = new Set();
  
  for (const path in designFiles) {
     // match[1] = Carpeta Categoría, match[2] = Nombre de Archivo
     const match = path.match(/\/public\/designs\/([^/]+)\/([^/]+)$/);
     if(match) {
        let cat = match[1];
        let name = match[2];
        let url = path.replace('/public', ''); // Vite extrae de public a root en prod y dev
        categoriesSet.add(cat);
        presetsData.push({
           category: cat,
           name: name.toLowerCase(),
           originalName: name,
           url: url
        });
     }
  }

  // Popular Select de Categorías
  categoriesSet.forEach(cat => {
     const opt = document.createElement('option');
     opt.value = cat;
     opt.innerText = cat;
     presetCategory.appendChild(opt);
  });

  // Renderizar y Filtrar
  function renderGallery() {
     presetGallery.innerHTML = '';
     const filterText = presetSearch.value.toLowerCase();
     const filterCat = presetCategory.value;

     presetsData.forEach(item => {
        // Filtrar por categoría
        if(filterCat !== 'all' && item.category !== filterCat) return;
        // Filtrar por búsqueda Contains
        if(filterText && !item.name.includes(filterText)) return;

        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'preset-img-wrapper';
        imgWrapper.title = item.originalName; // Tooltip con el nombre
        const img = document.createElement('img');
        img.src = item.url;
        imgWrapper.appendChild(img);
        
        imgWrapper.addEventListener('click', () => {
          addImageToCanvas(item.url);
        });
        
        presetGallery.appendChild(imgWrapper);
     });
  }

  presetSearch.addEventListener('input', renderGallery);
  presetCategory.addEventListener('change', renderGallery);

  // Render inicial
  renderGallery();

  // 6. Integración con WhatsApp
  whatsappBtn.addEventListener('click', async () => {
    whatsappBtn.innerHTML = '<i class="ph-fill ph-spinner ph-spin"></i> Generando...';
    whatsappBtn.disabled = true;

    // Deseleccionar objetos antes de la captura
    canvas.discardActiveObject();
    canvas.renderAll();

    try {
      const talle = sizeSelect.value;
      
      const dataUrl = await generateExportImage(talle, currentColorName, canvas.width, canvas.height);

      // Descargamos la imagen renderizada como backup
      const link = document.createElement('a');
      link.download = `revelio_diseno_${talle}.png`;
      link.href = dataUrl;
      link.click();

      // Intentar copiar al portapapeles
      try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        alert("🖼️ ¡Imagen multicapa generada y copiada al portapapeles!\n\nAl abrir WhatsApp, presiona 'Pegar' para adjuntar el diseño completo a la conversación.");
      } catch(clipErr) {
        console.warn("No se pudo copiar automáticamente: ", clipErr);
      }

      // El mensaje no especifica la vista ya que manda todo en una imagen. Agrega el color.
      const msg = `¡Hola! Quiero hacer un pedido en Revelio.%0A%0A*Detalles de la prenda:*%0A- Talle: ${talle}%0A- Color: ${currentColorName}%0A%0ATe adjunto la imagen de mi diseño.`;
      const phoneNumber = "5491178288321"; // Sustituir por el número
      
      // Abrimos WhatsApp
      setTimeout(() => {
        window.location.href = `https://wa.me/${phoneNumber}?text=${msg}`;
      }, 500);
      
    } catch (e) {
      console.error(e);
      alert('Hubo un error al generar la captura consolidada.');
    } finally {
      whatsappBtn.innerHTML = '<i class="ph-fill ph-whatsapp-logo"></i> Pedir por WhatsApp';
      whatsappBtn.disabled = false;
    }
  });

  // Funciones de renderizado consolidado Nativo (Sin HTML2Canvas)
  function loadImageNative(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function generateExportImage(talle, colorHex, origCanvasW, origCanvasH) {
    const viewW = 400;
    const viewH = 480;
    
    // Guardar la vista actual que estamos editando al pool de json
    canvasStates[currentView] = canvas.toJSON();

    // Recolectar imagenes unicas 
    const rawImages = new Set();
    const views = ['front', 'back', 'side'];
    views.forEach(v => {
      if(canvasStates[v] && canvasStates[v].objects) {
        canvasStates[v].objects.forEach(obj => {
          if ((obj.type === 'image' || obj.type === 'FabricImage') && obj.src) {
             rawImages.add(obj.src);
          }
        });
      }
    });

    // Dimensiones finales
    const finalW = viewW * 3 + 80;
    const rawImageSize = 200;
    const rawRows = Math.ceil(rawImages.size / 5);
    const rawSectionH = rawImages.size > 0 ? (rawRows * rawImageSize + 100) : 0;
    const finalH = viewH + 100 + rawSectionH;

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = finalW;
    finalCanvas.height = finalH;
    const ctx = finalCanvas.getContext('2d');

    // Fondo blanco principal
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, finalW, finalH);

    // Titulo
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Pedido Revelio - Talle: ${talle} | Color: ${colorHex}`, finalW / 2, 40);

    const labels = ['FRENTE', 'ESPALDA', 'MANGAS'];
    
    for (let i = 0; i < views.length; i++) {
        const v = views[i];
        const offsetX = 20 + i * (viewW + 20);
        const offsetY = 80;

        ctx.fillStyle = '#333333';
        ctx.font = 'bold 18px Inter, sans-serif';
        ctx.fillText(labels[i], offsetX + viewW / 2, offsetY - 10);

        const bgImg = await loadImageNative(`/tshirt_${v}.png`);
        if(!bgImg) continue;

        // 1. Color Sólido Máscara
        ctx.fillStyle = colorHex;
        ctx.fillRect(offsetX, offsetY, viewW, viewH);

        // 2. Dest-in recorta el color a la remera
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(bgImg, offsetX, offsetY, viewW, viewH);

        // 3. Multiply para sobreimprimir luces y sombras de la tela
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(bgImg, offsetX, offsetY, viewW, viewH);
        
        ctx.globalCompositeOperation = 'source-over';

        // 4. Dibujar el canvas particular escalado
        if (canvasStates[v] && canvasStates[v].objects.length > 0) {
           const tempCanvasEl = document.createElement('canvas');
           tempCanvasEl.width = origCanvasW;
           tempCanvasEl.height = origCanvasH;
           // Instanciar static fabric sincrónico
           const sCanvas = new fabric.StaticCanvas(tempCanvasEl);
           await sCanvas.loadFromJSON(canvasStates[v]);
           sCanvas.renderAll();
           
           const maskW = viewW * 0.40;
           const maskH = viewH * 0.55;
           const maskX = offsetX + (viewW * 0.30);
           const maskY = offsetY + (viewH * 0.22);
           
           ctx.drawImage(sCanvas.getElement(), maskX, maskY, maskW, maskH);
        }
    }

    // Dibujar elementos aislados para el sublimador/impresor
    if (rawImages.size > 0) {
      const rawStartY = viewH + 120;
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('DISEÑOS ESTAMPADOS (Para imprimir y recortar):', 20, rawStartY);
      
      let imgX = 20;
      let imgY = rawStartY + 20;
      const arrPaths = Array.from(rawImages);
      
      for (let j = 0; j < arrPaths.length; j++) {
         const rawImg = await loadImageNative(arrPaths[j]);
         if(!rawImg) continue;
         
         const scale = Math.min(rawImageSize / rawImg.width, rawImageSize / rawImg.height);
         const dw = rawImg.width * scale;
         const dh = rawImg.height * scale;
         
         ctx.drawImage(rawImg, imgX, imgY, dw, dh);
         ctx.strokeStyle = '#cccccc';
         ctx.strokeRect(imgX, imgY, dw, dh);
         
         imgX += rawImageSize + 20;
         if (imgX + rawImageSize > finalW) {
            imgX = 20;
            imgY += rawImageSize + 20;
         }
      }
    }

    return finalCanvas.toDataURL('image/png');
  }
});
