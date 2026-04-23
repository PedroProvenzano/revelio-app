import './style.css';
import * as fabric from 'fabric';
import html2canvas from 'html2canvas';

// Configuración global de estilos para que NINGÚN objeto pierda su forma redonda ni color
fabric.Object.prototype.set({
  cornerColor: '#6c5ce7',
  cornerStyle: 'circle',
  borderColor: '#6c5ce7',
  transparentCorners: false
});

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

  // Modal elements
  const whatsappModal = document.getElementById('whatsapp-modal');
  const modalDesc = document.getElementById('modal-desc');
  const btnModalWa = document.getElementById('btn-modal-wa');
  const btnModalClose = document.getElementById('btn-modal-close');

  const btnSizeGuide = document.getElementById('btn-size-guide');
  const sizeModal = document.getElementById('size-modal');
  const btnSizeClose = document.getElementById('btn-size-close');

  if (btnModalClose) {
    btnModalClose.addEventListener('click', () => {
      whatsappModal.style.display = 'none';
    });
  }

  if (btnSizeGuide) {
    btnSizeGuide.addEventListener('click', () => {
      sizeModal.style.display = 'flex';
    });
  }
  
  if (btnSizeClose) {
    btnSizeClose.addEventListener('click', () => {
      sizeModal.style.display = 'none';
    });
  }

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

  // Mostrar controles de objeto al seleccionar y forzar reglas de UI
  canvas.on('selection:created', (e) => {
    showObjectControls();
    enforceRules(e.selected);
  });
  canvas.on('selection:updated', (e) => {
    showObjectControls();
    enforceRules(e.selected);
  });
  canvas.on('selection:cleared', hideObjectControls);

  // Función anti-bugs para re-asegurar los controles cuando ganan foco
  function enforceRules(objects) {
    if (!objects) return;
    objects.forEach(obj => {
      // Restaurar flag por si las dudas
      if (obj.lockScalingX && obj.lockScalingY) {
          obj.isRequiredLogo = true;
      }

      if (obj.isRequiredLogo) {
        obj.setControlsVisibility({
          tl: false, tr: false, br: false, bl: false,
          ml: false, mt: false, mr: false, mb: false,
          mtr: true
        });
        obj.set({ lockScalingX: true, lockScalingY: true });
      } else {
        obj.setControlsVisibility({
          mt: false, mb: false, ml: false, mr: false
        });
        obj.set({ lockUniScaling: true });
      }
    });
    canvas.requestRenderAll();
  }

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

  const isLogoObj = (o) => {
      if (o.isRequiredLogo) return true;
      if (o.lockScalingX && o.lockScalingY) return true;
      if (typeof o.getSrc === 'function') {
          const src = o.getSrc();
          return src && (src.includes('logo_black.png') || src.includes('logo_white.png'));
      }
      return o.src && typeof o.src === 'string' && (o.src.includes('logo_black.png') || o.src.includes('logo_white.png'));
  };

  btnDelete.addEventListener('click', () => {
    const activeObjs = canvas.getActiveObjects();
    if (activeObjs.length) {
      const toDelete = activeObjs.filter(obj => !isLogoObj(obj));
      if (toDelete.length > 0) {
        canvas.discardActiveObject();
        toDelete.forEach(obj => canvas.remove(obj));
      } else {
        alert("El logo de la marca es obligatorio y no puede ser eliminado.");
      }
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
      canvasStates[currentView] = canvas.toJSON(['isRequiredLogo']);

      const newView = btn.dataset.view;
      currentView = newView;
      tshirtBase.className = `tshirt-base bg-${currentView}`;
      tshirtColor.className = `tshirt-color mask-${currentView}`;

      // Restaurar estado de la nueva vista
      canvas.clear();
      if (canvasStates[currentView]) {
        await canvas.loadFromJSON(canvasStates[currentView]);
        
        // Re-aplicar restricciones y estilos visuales a todos los objetos 
        // ya que toJSON no guarda estilos de esquinas ni visibilidad de controles.
        canvas.getObjects().forEach(obj => {
            // Restaurar el flag si se perdió en la deserialización nativa de Fabric
            if (isLogoObj(obj)) {
                obj.isRequiredLogo = true;
            }

            // Estilos estéticos compartidos por todos
            obj.set({
                cornerColor: '#6c5ce7',
                cornerStyle: 'circle',
                borderColor: '#6c5ce7',
                transparentCorners: false
            });

            if (obj.isRequiredLogo) {
                obj.setControlsVisibility({
                    tl: false, tr: false, br: false, bl: false,
                    ml: false, mt: false, mr: false, mb: false,
                    mtr: true
                });
                obj.set({ lockScalingX: true, lockScalingY: true });
            } else {
                // Restricciones para estampas normales
                obj.set({ lockUniScaling: true });
                obj.setControlsVisibility({
                    mt: false, mb: false, ml: false, mr: false
                });
            }
        });
        
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

  let currentPage = 1;
  const ITEMS_PER_PAGE = 9;

  // Función para Renderizar y Filtrar
  function renderGallery() {
     presetGallery.innerHTML = '';
     const paginationControls = document.getElementById('pagination-controls');
     if (paginationControls) paginationControls.innerHTML = '';

     const filterText = presetSearch.value.toLowerCase();
     const filterCat = presetCategory.value;

     // 1. Filtrar
     const filteredData = presetsData.filter(item => {
        if(filterCat !== 'all' && item.category !== filterCat) return false;
        if(filterText && !item.name.includes(filterText)) return false;
        return true;
     });

     // 2. Paginar
     const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
     if (currentPage > totalPages) currentPage = Math.max(1, totalPages);
     
     const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
     const endIndex = startIndex + ITEMS_PER_PAGE;
     const pageData = filteredData.slice(startIndex, endIndex);

     // 3. Renderizar items
     pageData.forEach(item => {
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

     // 4. Renderizar controles de paginación
     if (paginationControls && totalPages > 1) {
       for (let i = 1; i <= totalPages; i++) {
         const btn = document.createElement('button');
         btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
         btn.innerText = i;
         btn.addEventListener('click', () => {
            currentPage = i;
            renderGallery();
         });
         paginationControls.appendChild(btn);
       }
     }
  }

  presetSearch.addEventListener('input', () => { currentPage = 1; renderGallery(); });
  presetCategory.addEventListener('change', () => { currentPage = 1; renderGallery(); });

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

            // Intentar copiar al portapapeles primero (en vez de descargar automáticamente)
            let copiado = false;
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
              ]);
              copiado = true;
            } catch(clipErr) {
              console.warn("No se pudo copiar al portapapeles automáticamente, usando descarga como respaldo: ", clipErr);
            }
            
            // Si falló copiar (común en algunos celulares o sin HTTPS), forzamos la descarga como Plan B
            if (!copiado) {
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.download = `revelio_diseno_${talle}.png`;
              link.href = url;
              link.click();
              URL.revokeObjectURL(url);
            }
            
            // Le damos unos milisegundos mínimos y mostramos el modal (que NO congela el navegador)
            setTimeout(() => {
               if (copiado) {
                 modalDesc.innerText = "¡Diseño copiado al portapapeles exitosamente!\nAl abrir WhatsApp, solo presioná 'Pegar' en el chat para enviar tu diseño.";
               } else {
                 modalDesc.innerText = "Tu navegador no permitió copiar la imagen directo, así que la descargamos en tu dispositivo.\n\nPara enviarla, al abrir WhatsApp adjuntala desde la galería como cualquier otra foto.";
               }
               whatsappModal.style.display = 'flex';
               
               // Resolvemos aquí. Ya generamos la imagen y activamos la UI. El usuario decide cuándo ir a WhatsApp.
               resolve(true); 
            }, 600);
        }, 'image/png');
      });

      // Construcción del enlace WhatsApp
      const msg = `¡Hola! Quiero hacer un pedido en Revelio.%0A%0A*Detalles de la prenda:*%0A- Talle: ${talle}%0A- Color: ${currentColorName}%0A%0ATe adjunto la imagen de mi diseño.`;
      const phoneNumber = "5491178288321";

      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      let whatsappUrl = '';
      if (isMobile) {
        whatsappUrl = `whatsapp://send?phone=${phoneNumber}&text=${msg}`;
      } else {
        whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneNumber}&text=${msg}`;
      }

      // El botón del modal lleva la acción final
      btnModalWa.onclick = () => {
         window.location.href = whatsappUrl;
         whatsappModal.style.display = 'none'; // ocultamos visualmente
      };
      
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
    canvasStates[currentView] = canvas.toJSON(['isRequiredLogo']);

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

  // 7. Lógica del Logo Obligatorio
  let isUpdatingLogo = false;

  async function updateMandatoryLogo(switchView = true) {
    if (isUpdatingLogo) return;
    
    const colorSelect = document.getElementById('mandatory-logo-color');
    const viewSelect = document.getElementById('mandatory-logo-view');
    if (!colorSelect || !viewSelect) return;
    
    isUpdatingLogo = true;
    try {
      const color = colorSelect.value;
      const targetView = viewSelect.value;
      const logoUrl = color === 'black' ? '/logo_black.png' : '/logo_white.png';

      let latestLeft = canvas.width / 2;
      let latestTop = canvas.height / 4;
      let latestAngle = 0;

      // 1. Encontrar el logo actual para conservar su posición/rotación
      const activeLogo = canvas.getObjects().find(isLogoObj);
      if (activeLogo) {
          latestLeft = activeLogo.left;
          latestTop = activeLogo.top;
          latestAngle = activeLogo.angle;
          // CRÍTICO: Descartar el objeto activo antes de removerlo para no dejar "fantasmas"
          canvas.discardActiveObject();
          canvas.remove(activeLogo);
      } else {
          for (const v of Object.keys(canvasStates)) {
              if (canvasStates[v] && canvasStates[v].objects) {
                  const stateLogo = canvasStates[v].objects.find(isLogoObj);
                  if (stateLogo) {
                      latestLeft = stateLogo.left;
                      latestTop = stateLogo.top;
                      latestAngle = stateLogo.angle;
                      break;
                  }
              }
          }
      }

      // 2. Eliminar el logo de todos los estados guardados
      Object.keys(canvasStates).forEach(v => {
          if (canvasStates[v] && canvasStates[v].objects) {
              canvasStates[v].objects = canvasStates[v].objects.filter(o => !isLogoObj(o));
          }
      });

      const img = await fabric.FabricImage.fromURL(logoUrl, { crossOrigin: 'anonymous' });
      const maxWidth = canvas.width * 0.75;
      // Ajustamos el tamaño a un 35% del máximo permitido para que no quede enorme
      const targetWidth = maxWidth * 0.35; 
      const scale = targetWidth / (img.width || 1);

      img.set({
        left: latestLeft,
        top: latestTop,
        angle: latestAngle,
        originX: 'center',
        originY: 'center',
        scaleX: scale,
        scaleY: scale,
        cornerColor: '#6c5ce7',
        cornerStyle: 'circle',
        borderColor: '#6c5ce7',
        transparentCorners: false,
        lockScalingX: true,
        lockScalingY: true,
        isRequiredLogo: true
      });

      img.setControlsVisibility({
        tl: false, tr: false, br: false, bl: false,
        ml: false, mt: false, mr: false, mb: false,
        mtr: true
      });

      // 3. Añadirlo a la vista correspondiente
      if (currentView === targetView) {
          canvas.add(img);
          canvas.requestRenderAll();
      } else {
          if (!canvasStates[targetView]) {
              canvasStates[targetView] = { version: "6.0.0", objects: [] };
          }
          canvasStates[targetView].objects.push(img.toObject(['isRequiredLogo']));
          
          if (switchView) {
             const btn = Array.from(viewBtns).find(b => b.dataset.view === targetView);
             if (btn) btn.click();
          }
      }
    } catch (err) {
      console.error("Error loading mandatory logo", err);
    } finally {
      isUpdatingLogo = false;
    }
  }

  const logoColorSelect = document.getElementById('mandatory-logo-color');
  const logoViewSelect = document.getElementById('mandatory-logo-view');
  if (logoColorSelect) logoColorSelect.addEventListener('change', () => updateMandatoryLogo(true));
  if (logoViewSelect) logoViewSelect.addEventListener('change', () => updateMandatoryLogo(true));

  // Inicializar logo al cargar
  setTimeout(() => updateMandatoryLogo(false), 500);

});
