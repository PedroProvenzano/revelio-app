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
  const btnViewGrid = document.getElementById('view-grid');
  const btnViewLarge = document.getElementById('view-large');
  const btnViewList = document.getElementById('view-list');
  const btnPreview3d = document.getElementById('btn-preview-3d');

  let currentView = 'front';
  let currentColorName = 'Blanco';
  let currentColorHex = '#ffffff';

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

  // Limitar el tamaño de escalado de los objetos
  canvas.on('object:scaling', function(e) {
    const obj = e.target;
    // Permitir hasta el 75% del ancho/alto de la remera
    const canvasWidth = canvas.width * 0.75; 
    const canvasHeight = canvas.height * 0.75;
    
    // Si el objeto escalado es más grande que el canvas, limitamos su escala
    if (obj.getScaledWidth() > canvasWidth) {
      obj.scaleToWidth(canvasWidth);
    }
    if (obj.getScaledHeight() > canvasHeight) {
      obj.scaleToHeight(canvasHeight);
    }
  });

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
    side_left: null,
    side_right: null
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

  // 3.5 Preview 3D
  let isRotating = false;
  if (btnPreview3d) {
    btnPreview3d.addEventListener('click', async () => {
      if (isRotating) return;
      isRotating = true;
      btnPreview3d.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Girando...';
      
      const viewsSequence = ['front', 'side_right', 'back', 'side_left'];
      const currentIdx = viewsSequence.indexOf(currentView);
      
      // Perform 2 full rotations
      const totalSteps = viewsSequence.length * 2;
      
      for (let i = 1; i <= totalSteps; i++) {
        const nextIdx = (currentIdx + i) % viewsSequence.length;
        const nextView = viewsSequence[nextIdx];
        
        const btn = Array.from(viewBtns).find(b => b.dataset.view === nextView);
        if (btn) {
           btn.click();
        }
        
        await new Promise(r => setTimeout(r, 600)); // 600ms frame
      }
      
      btnPreview3d.innerHTML = '<i class="ph ph-arrows-clockwise"></i> Preview 360';
      isRotating = false;
    });
  }

  // 4. Color Picker
  function changeTshirtColor(color) {
    tshirtColor.style.backgroundColor = color;
  }

  colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      colorBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentColorName = btn.dataset.name;
      currentColorHex = btn.dataset.color;
      changeTshirtColor(btn.dataset.color);
    });
  });

  // 5. Manejo de Imágenes
  async function addImageToCanvas(imgUrl) {
    try {
      const img = await fabric.FabricImage.fromURL(imgUrl, { crossOrigin: 'anonymous' });
      // Escalar la imagen inicial al máximo permitido (75%) si es más grande
      const scale = Math.min((canvas.width * 0.75) / (img.width || 1), (canvas.height * 0.75) / (img.height || 1), 1);

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

  // ----------------------------------------------------
  // Carga de Diseños desde Cloudinary
  // ----------------------------------------------------
  const CLOUD_NAME = 'dy1svhgoh';
  const MAIN_TAG = 'revelio';
  
  let presetsData = [];
  const categoriesSet = new Set();
  
  async function loadCloudinaryDesigns() {
      try {
          const urlList = `https://res.cloudinary.com/${CLOUD_NAME}/image/list/${MAIN_TAG}.json`;
          const response = await fetch(urlList);
          
          if (!response.ok) {
              console.warn('No se encontraron imágenes en Cloudinary (o falta habilitar "Resource list").');
              return;
          }
          
          const data = await response.json();
          categoriesSet.add('General'); // Categoría por defecto
          
          data.resources.forEach(res => {
              // Cloudinary ahora suele enviar las carpetas en la propiedad `asset_folder`
              let category = 'General';
              let name = res.public_id;
              
              if (res.asset_folder && res.asset_folder.trim() !== '') {
                  // Si Cloudinary provee la carpeta dinámica, priorizamos esa
                  category = res.asset_folder;
                  // Si public_id contiene "/", nos quedamos con la última parte como nombre
                  name = res.public_id.split('/').pop();
              } else {
                  // Fallback: Si el public_id suele venir con formato de carpeta: "Categoria/Subcategoria/Nombre"
                  const parts = res.public_id.split('/');
                  if (parts.length > 1) {
                      category = parts[0];
                      name = parts[parts.length - 1]; // nombre del archivo sin carpeta
                  }
              }
              
              // Capitalizar primer letra
              category = category.charAt(0).toUpperCase() + category.slice(1);
              categoriesSet.add(category);
              
              // Reconstruir URL final para descargar la imagen
              const url = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v${res.version}/${res.public_id}.${res.format}`;
              
              presetsData.push({
                 category: category,
                 name: name.toLowerCase(),
                 originalName: name,
                 url: url
              });
          });
      } catch(err) {
          console.error("Hubo un error cargando los diseños de Cloudinary:", err);
      }
      
      // Popular Select de Categorías
      presetCategory.innerHTML = '<option value="all">Todas las Categorías</option>';
      categoriesSet.forEach(cat => {
         const opt = document.createElement('option');
         opt.value = cat;
         opt.innerText = cat;
         presetCategory.appendChild(opt);
      });
      
      // Renderizar galería con las imágenes obtenidas
      renderGallery();
  }

  // Vista Toggle Logic
  const presetViewBtns = [btnViewGrid, btnViewLarge, btnViewList];
  function updatePresetView(viewType) {
    if (presetGallery) {
      presetGallery.className = `preset-gallery view-${viewType}`;
    }
    presetViewBtns.forEach(b => { if (b) b.classList.remove('active'); });
    const activeBtn = document.getElementById(`view-${viewType}`);
    if (activeBtn) activeBtn.classList.add('active');
  }

  if (btnViewGrid) btnViewGrid.addEventListener('click', () => updatePresetView('grid'));
  if (btnViewLarge) btnViewLarge.addEventListener('click', () => updatePresetView('large'));
  if (btnViewList) btnViewList.addEventListener('click', () => updatePresetView('list'));

  // Función para Renderizar y Filtrar
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
        imgWrapper.title = item.originalName; // Tooltip con el nombre original
        const img = document.createElement('img');
        img.src = item.url;
        // CORS para que al agarrar esta img al canvas y exportar no rompa
        img.crossOrigin = 'anonymous'; 
        imgWrapper.appendChild(img);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'preset-name';
        // Formatear el nombre para que se vea más lindo (sin extension, etc)
        let cleanName = item.originalName;
        if (cleanName.includes('.')) {
          cleanName = cleanName.split('.').slice(0, -1).join('.');
        }
        nameSpan.innerText = cleanName;
        imgWrapper.appendChild(nameSpan);
        
        imgWrapper.addEventListener('click', () => {
          addImageToCanvas(item.url);
        });
        
        presetGallery.appendChild(imgWrapper);
     });
  }

  presetSearch.addEventListener('input', renderGallery);
  presetCategory.addEventListener('change', renderGallery);

  // Iniciar la carga de Cloudinary
  loadCloudinaryDesigns();

  // 6. Integración con WhatsApp
  whatsappBtn.addEventListener('click', async () => {
    whatsappBtn.innerHTML = '<i class="ph-fill ph-spinner ph-spin"></i> Generando...';
    whatsappBtn.disabled = true;

    // Deseleccionar objetos antes de la captura
    canvas.discardActiveObject();
    canvas.renderAll();

    try {
      const talle = sizeSelect.value;
      
      const finalCanvas = await generateExportImage(talle, currentColorHex, currentColorName, canvas.width, canvas.height);

      // Usar toBlob envolviéndolo en una promesa para esperar a que termine
      await new Promise((resolve) => {
        finalCanvas.toBlob(async (blob) => {
            if (!blob) {
                alert('Error al generar la imagen. Intenta de nuevo.');
                resolve(false);
                return;
            }

            // Descargamos la imagen renderizada como backup
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `revelio_diseno_${talle}.png`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);

            // Intentar copiar al portapapeles
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
              ]);
              alert("🖼️ ¡Imagen multicapa generada y copiada al portapapeles!\n\nAl abrir WhatsApp, presiona 'Pegar' para adjuntar el diseño completo a la conversación.");
            } catch(clipErr) {
              console.warn("No se pudo copiar automáticamente: ", clipErr);
            }
            resolve(true);
        }, 'image/png');
      });

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

  async function generateExportImage(talle, colorHex, colorName, origCanvasW, origCanvasH) {
    const viewW = 400;
    const viewH = 480;
    
    // Guardar la vista actual que estamos editando al pool de json
    canvasStates[currentView] = canvas.toJSON();

    // Recolectar imagenes unicas 
    const rawImages = new Set();
    const views = ['front', 'back', 'side_left', 'side_right'];
    views.forEach(v => {
      if(canvasStates[v] && canvasStates[v].objects) {
        canvasStates[v].objects.forEach(obj => {
          if ((obj.type === 'image' || obj.type === 'FabricImage') && obj.src) {
             rawImages.add(obj.src);
          }
        });
      }
    });

    // Dimensiones finales ajustadas a 4 vistas en apaisado
    const finalW = viewW * 4 + 100;
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
    ctx.fillText(`Pedido Revelio - Talle: ${talle} | Color: ${colorName}`, finalW / 2, 40);

    const labels = ['FRENTE', 'ESPALDA', 'LADO IZQUIERDO', 'LADO DERECHO'];
    
    for (let i = 0; i < views.length; i++) {
        const v = views[i];
        const offsetX = 20 + i * (viewW + 20);
        const offsetY = 80;

        ctx.fillStyle = '#333333';
        ctx.font = 'bold 18px Inter, sans-serif';
        ctx.fillText(labels[i], offsetX + viewW / 2, offsetY - 10);

        const bgImgPath = (v === 'side_left' || v === 'side_right') ? '/tshirt_side.png' : `/tshirt_${v}.png`;
        const bgImg = await loadImageNative(bgImgPath);
        if(!bgImg) continue;

        // Crear canvas temporal para la vista para evitar que el 'destination-in' borre las otras vistas ya dibujadas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = viewW;
        tempCanvas.height = viewH;
        const tempCtx = tempCanvas.getContext('2d');

        // 1. Color Sólido Máscara
        tempCtx.fillStyle = colorHex;
        tempCtx.fillRect(0, 0, viewW, viewH);

        // Si es lado derecho, espejar la remera base usando transformaciones del ctx
        tempCtx.globalCompositeOperation = 'destination-in';
        if (v === 'side_right') {
            tempCtx.save();
            tempCtx.translate(viewW, 0);
            tempCtx.scale(-1, 1);
            tempCtx.drawImage(bgImg, 0, 0, viewW, viewH);
            tempCtx.restore();
        } else {
            tempCtx.drawImage(bgImg, 0, 0, viewW, viewH);
        }

        // 3. Multiply para sobreimprimir luces y sombras de la tela
        tempCtx.globalCompositeOperation = 'multiply';
        if (v === 'side_right') {
            tempCtx.save();
            tempCtx.translate(viewW, 0);
            tempCtx.scale(-1, 1);
            tempCtx.drawImage(bgImg, 0, 0, viewW, viewH);
            tempCtx.restore();
        } else {
            tempCtx.drawImage(bgImg, 0, 0, viewW, viewH);
        }
        
        tempCtx.globalCompositeOperation = 'source-over';

        // 4. Dibujar el canvas particular escalado encima
        if (canvasStates[v] && canvasStates[v].objects.length > 0) {
           const tempCanvasEl = document.createElement('canvas');
           tempCanvasEl.width = origCanvasW;
           tempCanvasEl.height = origCanvasH;
           const sCanvas = new fabric.StaticCanvas(tempCanvasEl);
           await sCanvas.loadFromJSON(canvasStates[v]);
           sCanvas.renderAll();
           
           const maskW = viewW * 0.40;
           const maskH = viewH * 0.55;
           const maskX = (viewW * 0.30);
           const maskY = (viewH * 0.22);
           
           tempCtx.drawImage(sCanvas.getElement(), maskX, maskY, maskW, maskH);
        }

        // Ya procesados en el temp, dibujamos al final.
        ctx.drawImage(tempCanvas, offsetX, offsetY);
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

    return finalCanvas; // Retornamos el canvas directamente para poder usar toBlob
  }
});
