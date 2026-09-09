# 🏓 Pong Game — Edición Arcade

Un clásico juego de Pong para navegador, expandido masivamente en una experiencia arcade moderna: un **modo campaña** con seis jefes y su propia historia, partidas contra la CPU o a dos jugadores, progresión con niveles (XP), una tienda de cosméticos (Chemi Coins), power-ups dinámicos, logros y estadísticas detalladas.

Todo funciona abriendo un archivo: sin instalar nada, sin compilar y sin conexión más allá de la primera carga.

![Licencia MIT](https://img.shields.io/badge/licencia-MIT-22c55e) ![Sin dependencias de build](https://img.shields.io/badge/build-no%20requerido-blue) ![Vanilla JS](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

## 🕹️ Características Principales

### Modos de Juego
- **Modo Campaña — "La Venganza contra los Hachepes"**: Un desconocido sin nombre se venga de los tiranos que quemaron y esclavizaron su ciudad. Cinco jefes, cada uno con su mecánica, sus diálogos y su lore… y un final que no es el que parece. Ver abajo.
- **Modo VS CPU**: 3 niveles de dificultad (Fácil, Normal, Imposible).
- **Modo Local (2 jugadores)**: Juega con un amigo compartiendo teclado (soporte anti-ghosting mejorado) o mediante controles táctiles divididos en móviles.
- **Modo Hachepe (Jefe)**: Un intenso desafío contra la CPU donde la bola siempre va al máximo de velocidad y la CPU devuelve con precisión robótica. Incluye banda sonora exclusiva.

### 🗡️ La Campaña
Cada Hachepe rompe las reglas del Pong a su manera, y el marcador sube con cada uno:

| Jefe | Lo que te hace |
|------|----------------|
| **Chemi** — El Guardián de la Frontera | Pelea entre los escombros de tu barrio, que desvían la bola |
| **Dani** — El Arquitecto del Caos | Levanta escudos que aguantan dos impactos y se teletransporta |
| **Mario y Valentín** — El Dúo Letal | Dos paletas repartiéndose el campo; al encajar gol, una se retira |
| **Fano** — El Guardián de las Sombras | Apaga la luz: la bola se vuelve invisible y aparecen señuelos |
| **Yisus** — El Falso Rey | Desvía la bola con telekinesis y detiene el tiempo sobre tu paleta |

Los rivales se eligen en un **carrusel** al estilo de los selectores de personaje arcade, con su retrato, su nivel de peligro y su estado. Los que aún no has desbloqueado aparecen como una silueta sin nombre.

Se puede repetir cualquier jefe ya vencido (con recompensa reducida), y hay un logro secreto que ni siquiera aparece en la lista de logros hasta que lo consigues.

*Y cuando creas que has ganado... sigue jugando.*

### Sistemas Arcade (Novedad)
- **Progresión (XP) y Títulos**: Gana experiencia al jugar. Sube de nivel para desbloquear nuevos títulos (desde Novato hasta Leyenda) y gana Chemi Coins.
- **Chemi Coins y Tienda 🪙**: Moneda virtual del juego obtenida al jugar y ganar (deshabilitada en Modo Local para evitar trampas). Úsala para comprar:
  - *Estelas:* Clásica, Neón, Fuego, Hielo, Arcoíris.
  - *Fondos:* Clásico, Estrellas, Lluvia Digital, Aurora Boreal.
  - *Paletas:* Clásica, Pixel, Gradiente, Neón, Delgada Pro.
  - *Efectos de Gol:* Clásico, Flash Épico, Confeti, Onda Expansiva.
- **Power-ups Dinámicos**: Durante las partidas aparecerán mejoras aleatorias como Paleta XL/Mini, Bola Gigante, Escudo protector, Cámara lenta, Turbo y Multi-bola (hasta 3 bolas simultáneas).
- **Logros (Achievements)**: 30 logros desbloqueables (ej. "Veterano", "Grow Partner", "La Venganza") con notificaciones en pantalla tipo "toast". Uno de ellos es **secreto**: se muestra como `????` hasta que lo consigues, y ni el contador delata que existe.
- **Estadísticas (Stats)**: Registro persistente de tus victorias, rachas máximas, horas jugadas, velocidad máxima de la bola y más.

### Interfaz y Personalización
- **8 temas de color base**: verde, morado, azul, rojo, naranja, cian, amarillo y rosa.
- **Soporte Táctil Completo**: Juega en tu teléfono arrastrando el dedo por los laterales de la pantalla, con un botón de pausa dedicado y reajuste automático de escala (viewport fix).
- **Teclas Reasignables**: Cambia cualquier combinación de control desde el menú; guardado automático.
- **Control por ratón** opcional, activable desde Configuración.
- **Configuraciones Técnicas**: Activa o desactiva el efecto monitor CRT, las vibraciones de cámara, los power-ups y ajusta volúmenes independientemente.
- **Accesibilidad**: se respeta `prefers-reduced-motion`, así que los efectos de glitch y los parpadeos se desactivan si tu sistema pide menos animación.

## 📂 Estructura del Proyecto

El código está estructurado en módulos modulares (vanilla JS global namespace). No utiliza NPM, Node.js ni bundlers.

```
pong-game/
├── index.html          # Interfaz, menús y contenedor del juego
├── README.md
├── CLAUDE.md           # Notas de arquitectura para agentes de IA
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
│   ├── campaign.js     # Campaña: lore, carrusel, diálogos y secuencias finales
│   ├── bosses.js       # Mecánicas de cada jefe (tabla BOSS_MECHANICS)
│   ├── game.js         # Bucle principal (Game Loop), física de las bolas, colisiones
│   ├── touch.js        # Gestión de eventos táctiles para móviles
│   └── ui.js           # Navegación entre menús y sincronización con config
└── assets/
    ├── favicon.svg
    ├── chemi_coin.png  # Icono de la moneda
    ├── audio/          # Música de menú, de partida y el rap de los Hachepes
    ├── images/         # Retratos de los seis Hachepes
    └── shop/           # Imágenes previas de todos los cosméticos de la tienda
```

*Los archivos JS se cargan secuencialmente al final del `index.html`, y ese orden importa: `config.js` primero, `ui.js` al final.*

## 🎮 Controles por Defecto

### Jugador 1 (Izquierda)
- **W** / **S**: Mover Arriba / Abajo

### Jugador 2 (Derecha) — *Solo Modo Local*
- **Flecha Arriba** / **Flecha Abajo**: Mover Arriba / Abajo

### Campaña
- **← / →**: Cambiar de rival en el carrusel. **Enter**: entrar al combate.
- En un combate concreto la arena cambia de orientación y tu paleta pasa a moverse en **horizontal**; las mismas teclas de mover (o el dedo, o el ratón) siguen funcionando.

### Interfaz / Sistema
- **ESC**: Pausar / Volver atrás.
- **Controles Táctiles (Móviles)**: Arrastra el dedo en la zona izquierda o derecha de la pantalla. El botón "Pausa" aparece arriba al centro durante la partida. En la campaña, desliza para cambiar de rival.
- **Ratón**: actívalo en Configuración para mover la paleta siguiendo el cursor.

## 🚀 Cómo Jugar (Despliegue)
Al ser una aplicación 100% frontend (*Static Web App*), no requiere servidor ni compilación:
1. Clona el repositorio o descarga el código.
2. Abre `index.html` en cualquier navegador moderno.
3. Alternativamente, puedes hospedar la carpeta directamente en **GitHub Pages**.

> Para desarrollar es preferible servir la carpeta (`python -m http.server 8000`) en vez de abrir el archivo directo: los MP3 y el `localStorage` se comportan de forma más fiable sobre `http://` que sobre `file://`.

## 🧑‍💻 Notas de desarrollo

No hay build, ni dependencias, ni tests. Se edita y se recarga. Dos cosas que conviene saber antes de tocar el código:

- **La caché se invalida a mano.** Cada `<script>` y el `<link>` del CSS llevan un `?v=N` en `index.html`. **Después de editar cualquier JS o CSS hay que subir ese número**, o GitHub Pages seguirá sirviendo la versión vieja a quien ya haya entrado.
- **No hay módulos.** Todo son variables y funciones globales, y los archivos dependen del orden de carga del final de `index.html`. Antes de crear una función o constante nueva, comprueba que el nombre no exista ya.

`CLAUDE.md` recoge la arquitectura en detalle: la tabla de jefes, los tres almacenes de `localStorage`, el flujo de la campaña y varias trampas del código que ya costaron un bug.

## 🛠️ Tecnologías
- **HTML5 Canvas** y **requestAnimationFrame**.
- **JavaScript (Vanilla, ES6+)**.
- **TailwindCSS** (vía CDN) y animaciones nativas CSS3.
- **Web Audio API** y etiquetas `<audio>`.
- **LocalStorage API** (El progreso, compras y configuraciones se guardan localmente en el navegador).

## 📝 Licencia
MIT — Libre para usar, modificar y compartir.
