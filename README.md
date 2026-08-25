# Pong Game

Un juego clásico de Pong web con estética retro (estilo monitor CRT).

## Características

- **Modo VS CPU**: Juega contra la computadora con 3 niveles de dificultad (Fácil, Normal, Imposible).
- **Modo Local (2 Jugadores)**: Juega con un amigo en el mismo teclado.
- **Configuraciones**: Ajusta la dificultad de la CPU y el volumen del juego.
- **Efectos Visuales**: Estilo retro con efecto CRT incorporado mediante TailwindCSS y Vanilla CSS.
- **Audio Sintetizado**: Sonidos generados mediante Web Audio API en JavaScript, sin necesidad de descargar audios externos.

## Controles

### Jugador 1 (Izquierda)
- **W**: Mover Arriba
- **S**: Mover Abajo

### Jugador 2 (Derecha) - *Sólo en Modo Local*
- **Flecha Arriba**: Mover Arriba
- **Flecha Abajo**: Mover Abajo

### Sistema
- **ESC**: Pausar el juego o volver al menú anterior.

## Cómo Jugar

No requiere instalación ni dependencias. Simplemente abre el archivo `index.html` en tu navegador web de preferencia para empezar a jugar.

## Tecnologías Utilizadas

- **HTML5 Canvas** para renderizar el juego.
- **JavaScript (Vanilla)** para toda la lógica, física y audio.
- **TailwindCSS** (via CDN) y **CSS** para el diseño de la interfaz y menús.
