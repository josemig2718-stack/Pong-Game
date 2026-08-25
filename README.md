# 🏓 Pong Game — Edición Arcade

Un clásico juego de Pong para navegador, con estética retro de monitor CRT, temas de color personalizables, teclas reasignables y un modo VS CPU o Local a 2 jugadores.

![Licencia MIT](https://img.shields.io/badge/licencia-MIT-22c55e) ![Sin dependencias de build](https://img.shields.io/badge/build-no%20requerido-blue) ![Vanilla JS](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

## ✨ Características

- **Modo VS CPU**: 3 niveles de dificultad (Fácil, Normal, Imposible).
- **Modo Local (2 jugadores)**: juega con un amigo en el mismo teclado.
- **8 temas de color**: verde, morado, azul, rojo, naranja, cian, amarillo y rosa. Se aplican tanto a la interfaz como al propio juego.
- **Teclas reasignables**: cambia cualquier combinación de control desde el menú de Controles; se guardan automáticamente.
- **Configuración ampliada**: dificultad de la CPU, volumen, puntos para ganar (3/5/7/11), velocidad de la bola, efectos de sonido, efecto CRT y vibración de pantalla, todo activable/desactivable y persistente entre sesiones (`localStorage`).
- **Mejoras visuales**: bola redonda con resplandor y estela de movimiento, partículas al golpear la bola, vibración de pantalla al anotar, cuenta regresiva de saque y paletas con brillo.
- **Audio 100% sintetizado**: todos los sonidos se generan en tiempo real con la Web Audio API, sin archivos externos.
- **Responsive**: se adapta a escritorio y móvil, manteniendo la proporción 4:3 del campo de juego.

## 📁 Estructura del proyecto

```
pong-game/
├── index.html          # Estructura de las pantallas/menús
├── README.md
├── css/
│   └── style.css        # Estilos y variables de tema (CSS custom properties)
├── js/
│   ├── config.js         # Constantes, catálogo de temas y persistencia (localStorage)
│   ├── theme.js           # Aplicación del tema de color elegido
│   ├── audio.js            # Sintetizador de audio (Web Audio API)
│   ├── input.js             # Teclado y sistema de reasignación de teclas
│   ├── game.js               # Estado, física y renderizado del juego (canvas)
│   └── ui.js                  # Navegación de menús y conexión de la configuración
└── assets/
    └── favicon.svg
```

Los archivos JavaScript se cargan como scripts clásicos (no módulos ES) en un orden concreto —`config → theme → audio → input → game → ui`— para que el juego funcione simplemente abriendo `index.html`, sin necesidad de un servidor local ni de un paso de compilación.

## 🎮 Controles (por defecto)

### Jugador 1 (Izquierda)
- **W**: Mover Arriba
- **S**: Mover Abajo

### Jugador 2 (Derecha) — *Solo en Modo Local*
- **Flecha Arriba**: Mover Arriba
- **Flecha Abajo**: Mover Abajo

### Sistema
- **ESC**: Pausar el juego o volver al menú anterior.

> Todas las teclas anteriores se pueden reasignar libremente desde el menú **Controles**.

## 🕹️ Cómo jugar

No requiere instalación ni dependencias de compilación. Simplemente abre el archivo `index.html` en tu navegador (Chrome, Firefox, Edge o Safari recientes) para empezar a jugar. Requiere conexión a internet la primera vez para cargar la tipografía y TailwindCSS desde su CDN.

## 🛠️ Tecnologías utilizadas

- **HTML5 Canvas** para renderizar el juego.
- **JavaScript (Vanilla, ES6+)** para toda la lógica, física, temas, controles y audio.
- **TailwindCSS** (vía CDN) + **CSS** propio con variables (custom properties) para el theming dinámico.
- **Web Audio API** para el audio sintetizado.

## 📄 Licencia

MIT — libre para usar, modificar y compartir.
