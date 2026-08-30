# 🏓 Pong Game — Edición Arcade

Un clásico juego de Pong para navegador, expandido masivamente en una experiencia arcade moderna. Cuenta con modos de juego variados (VS CPU, Multijugador Local, Modo Jefe "Hachepe"), un sistema de progresión con niveles (XP), una tienda de cosméticos (Chemi Coins), power-ups dinámicos, sistema de logros y estadísticas detalladas.

![Licencia MIT](https://img.shields.io/badge/licencia-MIT-22c55e) ![Sin dependencias de build](https://img.shields.io/badge/build-no%20requerido-blue) ![Vanilla JS](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

## 🕹️ Características Principales

### Modos de Juego
- **Modo VS CPU**: 3 niveles de dificultad (Fácil, Normal, Imposible).
- **Modo Local (2 jugadores)**: Juega con un amigo compartiendo teclado (soporte anti-ghosting mejorado) o mediante controles táctiles divididos en móviles.
- **Modo Hachepe (Jefe)**: Un intenso desafío contra la CPU donde la bola siempre va al máximo de velocidad y la CPU devuelve con precisión robótica. Incluye banda sonora exclusiva.

### Sistemas Arcade (Novedad)
- **Progresión (XP) y Títulos**: Gana experiencia al jugar. Sube de nivel para desbloquear nuevos títulos (desde Novato hasta Leyenda) y gana Chemi Coins.
- **Chemi Coins y Tienda 🪙**: Moneda virtual del juego obtenida al jugar y ganar (deshabilitada en Modo Local para evitar trampas). Úsala para comprar:
  - *Estelas:* Clásica, Neón, Fuego, Hielo, Arcoíris.
  - *Fondos:* Clásico, Estrellas, Lluvia Digital, Aurora Boreal.
  - *Paletas:* Clásica, Pixel, Gradiente, Neón, Delgada Pro.
  - *Efectos de Gol:* Clásico, Flash Épico, Confeti, Onda Expansiva.
- **Power-ups Dinámicos**: Durante las partidas aparecerán mejoras aleatorias como Paleta XL/Mini, Bola Gigante, Escudo protector, Cámara lenta, Turbo y Multi-bola (hasta 3 bolas simultáneas).
- **Logros (Achievements)**: 27 logros desbloqueables (ej. "Tiro Rápido", "Veterano", "Grow Partner") con notificaciones en pantalla tipo "toast".
- **Estadísticas (Stats)**: Registro persistente de tus victorias, rachas máximas, horas jugadas, velocidad máxima de la bola y más.

### Interfaz y Personalización
- **8 temas de color base**: verde, morado, azul, rojo, naranja, cian, amarillo y rosa.
- **Soporte Táctil Completo**: Juega en tu teléfono arrastrando el dedo por los laterales de la pantalla, con un botón de pausa dedicado y reajuste automático de escala (viewport fix).
- **Teclas Reasignables**: Cambia cualquier combinación de control desde el menú; guardado automático.
- **Configuraciones Técnicas**: Activa o desactiva el efecto monitor CRT, las vibraciones de cámara, los power-ups y ajusta volúmenes independientemente.

## 📂 Estructura del Proyecto

El código está estructurado en módulos modulares (vanilla JS global namespace). No utiliza NPM, Node.js ni bundlers.

```
pong-game/
├── index.html          # Interfaz, menús y contenedor del juego
├── README.md
├── css/
│   └── style.css       # Estilos, UI, Tailwind (vía CDN) y variables CSS
├── js/
│   ├── config.js       # Constantes y base de configuración
│   ├── theme.js        # Gestor de temas y colores CSS variables
│   ├── audio.js        # Efectos de sonido (Web Audio API) y música MP3
│   ├── stats.js        # Lógica de guardado/lectura de estadísticas globales
│   ├── achievements.js # Definiciones y verificación de logros (con toasts UI)
│   ├── input.js        # Mapeo de teclado
│   ├── progression.js  # Sistema de niveles (XP) y monedas (Chemi Coins)
│   ├── shop.js         # Lógica de compras, inventario y UI de la tienda
│   ├── vfx.js          # Sistema de partículas, estelas avanzadas y renders
│   ├── powerups.js     # Lógica y física de los potenciadores en partida
│   ├── game.js         # Bucle principal (Game Loop), física de las bolas, colisiones
│   ├── touch.js        # Gestión de eventos táctiles para móviles
│   └── ui.js           # Navegación entre menús y sincronización con config
└── assets/
    ├── favicon.svg
    ├── chemi_coin.png  # Icono de la moneda
    ├── los_hachepe_rap.mp3 # Banda sonora Jefe Hachepe
    └── shop/           # Imágenes previas de todos los cosméticos de la tienda
```

*Los archivos JS se cargan secuencialmente al final del `index.html`.*

## 🎮 Controles por Defecto

### Jugador 1 (Izquierda)
- **W** / **S**: Mover Arriba / Abajo

### Jugador 2 (Derecha) — *Solo Modo Local*
- **Flecha Arriba** / **Flecha Abajo**: Mover Arriba / Abajo

### Interfaz / Sistema
- **ESC**: Pausar / Volver atrás.
- **Controles Táctiles (Móviles)**: Arrastra el dedo en la zona izquierda o derecha de la pantalla. El botón "Pausa" aparece arriba al centro durante la partida.

## 🚀 Cómo Jugar (Despliegue)
Al ser una aplicación 100% frontend (*Static Web App*), no requiere servidor ni compilación:
1. Clona el repositorio o descarga el código.
2. Abre `index.html` en cualquier navegador moderno.
3. Alternativamente, puedes hospedar la carpeta directamente en **GitHub Pages**.

## 🛠️ Tecnologías
- **HTML5 Canvas** y **requestAnimationFrame**.
- **JavaScript (Vanilla, ES6+)**.
- **TailwindCSS** (vía CDN) y animaciones nativas CSS3.
- **Web Audio API** y etiquetas `<audio>`.
- **LocalStorage API** (El progreso, compras y configuraciones se guardan localmente en el navegador).

## 📝 Licencia
MIT — Libre para usar, modificar y compartir.
