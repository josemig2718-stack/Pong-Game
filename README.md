# 🏓 Pong Game — Edición Arcade

Un clásico juego de Pong para navegador, expandido masivamente en una experiencia arcade moderna: un **modo campaña** con seis jefes y su propia historia, partidas contra la CPU o a dos jugadores, progresión con niveles (XP), una tienda de cosméticos (Chemi Coins), power-ups dinámicos, logros y estadísticas detalladas.

Sin instalar nada y sin compilar: basta abrir `index.html` en el navegador, o publicar la carpeta en GitHub Pages.

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

El código está organizado en carpetas por capas, con JavaScript sin dependencias. No utiliza NPM, Node.js ni bundlers.

```
pong-game/
├── index.html            # Pantallas, menús, contenedor del juego y lista de scripts
├── css/style.css         # Identidad retro/CRT y variables de tema (Tailwind va por CDN)
├── js/
│   ├── main.js           # Punto de entrada: arranca todo en orden
│   ├── core/             # Base: constantes, localStorage, configuración, estado de la partida
│   ├── data/             # Catálogos: temas, historia, logros, tienda, niveles, power-ups
│   ├── systems/          # Audio, tema, teclado, ratón/táctil, estadísticas, logros, progresión
│   ├── game/             # Canvas, física, IA, partida, bucle, dibujo y power-ups
│   ├── vfx/              # Cosméticos de la tienda: estelas, fondos, paletas, efectos de gol
│   ├── bosses/           # Un archivo por jefe + la tabla que los despacha
│   ├── campaign/         # Avance, selector de jefes, diálogos y finales
│   └── ui/               # Pantallas, botones (data-action), configuración, stats, tienda
├── tests/                # Tests de regresión (una página web) y su servidor de desarrollo
├── docs/
│   └── bugs-conocidos.md # Fallos conocidos que se conservan a propósito
├── assets/
│   ├── audio/            # Música de menú, de partida y el rap de los Hachepes
│   ├── images/           # Retratos de los seis Hachepes
│   └── shop/             # Imágenes de todos los cosméticos de la tienda
├── jsconfig.json         # Comprobación de tipos en el editor (JSDoc), sin compilar nada
└── CLAUDE.md             # Arquitectura en detalle, para agentes de IA
```

*`index.html` carga los scripts de `js/` en orden de capas (de `core/` a `ui/`) y `js/main.js` el último, que arranca el juego. Son scripts clásicos, no módulos, para que el juego funcione también abriendo el archivo directamente.*

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
Es una aplicación 100% frontend (*Static Web App*): no requiere servidor ni compilación.
1. Clona el repositorio o descarga el código.
2. Abre `index.html` en cualquier navegador moderno (doble clic).
3. O publica la carpeta tal cual en **GitHub Pages**.

> Para desarrollar y pasar los tests, sirve la carpeta con `python tests/serve.py` (<http://127.0.0.1:8000/>): desactiva la caché, así el navegador nunca usa JS viejo tras editarlo.

## 🧑‍💻 Notas de desarrollo

No hay build ni dependencias. Se edita y se recarga. Lo que conviene saber antes de tocar el código:

- **Tiene que funcionar abriendo `index.html`.** Por eso no se usan módulos ES (`import`/`export`), que los navegadores no cargan desde `file://`: cada archivo de `js/` es un script clásico y todos comparten el ámbito global. Los nombres de primer nivel deben ser únicos, y el código que se ejecuta al cargar un archivo solo puede usar lo cargado antes.
- **La caché se invalida a mano, con un solo número.** Cada `<script>` de `index.html` y el `<link>` del CSS llevan el mismo `?v=N`. **Después de editar cualquier JS o CSS hay que subir N en todos**, o GitHub Pages seguirá sirviendo la versión vieja a quien ya haya entrado. Un archivo nuevo de `js/` hay que añadirlo a la lista, en su capa.
- **Tests de regresión.** Con el servidor en marcha, <http://127.0.0.1:8000/tests/> → *Ejecutar todos*. Reproduce partidas deterministas fotograma a fotograma, compara los estilos de cada pantalla en cuatro tamaños de ventana y comprueba la lista de scripts, todo contra referencias grabadas. Tarda unos 5 minutos. Ver `tests/README.md`.
- **Tipos sin compilar.** `jsconfig.json` activa la comprobación de tipos de los editores a partir de los comentarios JSDoc. Para revisarla entera: `npx -y -p typescript@5 tsc -p jsconfig.json` (debe dar cero errores).
- **Bugs conocidos.** `docs/bugs-conocidos.md` recoge fallos que se conservaron a propósito durante la refactorización; cada uno está marcado en el código con `BUG conocido (conservado)`.

`CLAUDE.md` recoge la arquitectura en detalle: las capas, el estado compartido, la tabla de jefes, los tres almacenes de `localStorage`, el flujo de la campaña y varias trampas del código que ya costaron un bug.

## 🛠️ Tecnologías
- **HTML5 Canvas** y **requestAnimationFrame**.
- **JavaScript (Vanilla, scripts clásicos)**, con tipos en JSDoc.
- **TailwindCSS** (vía CDN) y animaciones nativas CSS3.
- **Web Audio API** y etiquetas `<audio>`.
- **LocalStorage API** (El progreso, compras y configuraciones se guardan localmente en el navegador).

## 📝 Licencia
MIT — Libre para usar, modificar y compartir.
