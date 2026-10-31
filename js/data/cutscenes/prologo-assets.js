/**
 * data/cutscenes/prologo-assets.js — GENERADO por design/campana/generadores/build_prologo.py
 * y build5.py. No editar a mano: vuelve a ejecutar los generadores.
 *
 * Unidades de escena (960×540). w/h = tamaño del dibujo; ax/ay = punto de apoyo (los pies)
 * medido desde la esquina superior izquierda. theme = máscara que se tiñe con el color del tema.
 * Los busto_* son los bustos compartidos de assets/campaign/bustos/ (fichas, VS y diálogos).
 */
'use strict';

/** @type {CutsceneAssets} */
const PROLOGO_ASSETS = {
  "unit": "scene",
  "pxPerUnit": 2,
  "backgrounds": {
    "skyline_libre": {
      "src": "assets/campaign/prologo/fondos/skyline_libre.webp",
      "w": 960,
      "h": 540,
      "desc": "Panorámica de noche, ciudad libre (escena 2 y 8)",
      "theme": "assets/campaign/prologo/fondos/skyline_libre_tema.webp"
    },
    "skyline_sindicato": {
      "src": "assets/campaign/prologo/fondos/skyline_sindicato.webp",
      "w": 960,
      "h": 540,
      "desc": "La misma panorámica bajo el Sindicato (escena 8)",
      "theme": null
    },
    "calle_libre": {
      "src": "assets/campaign/prologo/fondos/calle_libre.webp",
      "w": 960,
      "h": 540,
      "desc": "Calle comercial libre (escenas 3, 4, 6)",
      "theme": "assets/campaign/prologo/fondos/calle_libre_tema.webp"
    },
    "calle_sindicato": {
      "src": "assets/campaign/prologo/fondos/calle_sindicato.webp",
      "w": 960,
      "h": 540,
      "desc": "La misma calle bajo el Sindicato (escenas 9, 10)",
      "theme": null
    },
    "torre_libre": {
      "src": "assets/campaign/prologo/fondos/torre_libre.webp",
      "w": 960,
      "h": 540,
      "desc": "Plaza de la Torre Barks con la mesa de pong (escena 7)",
      "theme": "assets/campaign/prologo/fondos/torre_libre_tema.webp"
    },
    "torre_sindicato": {
      "src": "assets/campaign/prologo/fondos/torre_sindicato.webp",
      "w": 960,
      "h": 540,
      "desc": "La plaza con la torre ya del Sindicato (escena 7)",
      "theme": null
    },
    "mirada": {
      "src": "assets/campaign/prologo/fondos/mirada.webp",
      "w": 960,
      "h": 540,
      "desc": "La torre de noche vista desde la calle (escena 11)",
      "theme": null
    },
    "escalinata": {
      "src": "assets/campaign/prologo/fondos/escalinata.webp",
      "w": 960,
      "h": 540,
      "desc": "Escalinata de la torre bajo la lluvia (escena 12)",
      "theme": null
    },
    "plaza_libre": {
      "src": "assets/campaign/prologo/fondos/plaza_libre.webp",
      "w": 960,
      "h": 540,
      "desc": "Plaza con el árbol grande, ciudad libre (escenas 3, 4, 5, 6)",
      "theme": "assets/campaign/prologo/fondos/plaza_libre_tema.webp"
    },
    "plaza_sindicato": {
      "src": "assets/campaign/prologo/fondos/plaza_sindicato.webp",
      "w": 960,
      "h": 540,
      "desc": "La misma plaza bajo el Sindicato (escena 12)",
      "theme": null
    },
    "recepcion": {
      "src": "assets/campaign/prologo/fondos/recepcion.webp",
      "w": 960,
      "h": 540,
      "desc": "Recepción de la Torre Hachepe (escenas 10 y 17)",
      "theme": "assets/campaign/prologo/fondos/recepcion_tema.webp"
    },
    "radio_libre": {
      "src": "assets/campaign/prologo/fondos/radio_libre.webp",
      "w": 960,
      "h": 540,
      "desc": "Estudio de Barks Radio con la ciudad encendida (escena 10)",
      "theme": "assets/campaign/prologo/fondos/radio_libre_tema.webp"
    },
    "radio_sindicato": {
      "src": "assets/campaign/prologo/fondos/radio_sindicato.webp",
      "w": 960,
      "h": 540,
      "desc": "El estudio con la ciudad apagada (escena 10)",
      "theme": null
    },
    "trono": {
      "src": "assets/campaign/prologo/fondos/trono.webp",
      "w": 960,
      "h": 540,
      "desc": "Último piso con el ventanal (escena 10)",
      "theme": "assets/campaign/prologo/fondos/trono_tema.webp"
    },
    "cancha": {
      "src": "assets/campaign/prologo/fondos/cancha.webp",
      "w": 960,
      "h": 540,
      "desc": "Cancha vista desde arriba para la ley de la paleta (escena 8)",
      "theme": "assets/campaign/prologo/fondos/cancha_tema.webp"
    }
  },
  "actors": {
    "chemi": {
      "src": "assets/campaign/prologo/actores/chemi.webp",
      "w": 201.0,
      "h": 269.0,
      "ax": 100.5,
      "ay": 238.0,
      "desc": "Chemi de pie",
      "theme": null
    },
    "chemi_ataque": {
      "src": "assets/campaign/prologo/actores/chemi_ataque.webp",
      "w": 201.0,
      "h": 269.0,
      "ax": 100.5,
      "ay": 238.0,
      "desc": "Chemi alzando la paleta",
      "theme": null
    },
    "dani": {
      "src": "assets/campaign/prologo/actores/dani.webp",
      "w": 201.0,
      "h": 267.5,
      "ax": 100.5,
      "ay": 236.5,
      "desc": "Dani de pie",
      "theme": null
    },
    "dani_ataque": {
      "src": "assets/campaign/prologo/actores/dani_ataque.webp",
      "w": 201.0,
      "h": 267.5,
      "ax": 100.5,
      "ay": 236.5,
      "desc": "Dani alzando la paleta",
      "theme": null
    },
    "mario": {
      "src": "assets/campaign/prologo/actores/mario.webp",
      "w": 201.0,
      "h": 258.0,
      "ax": 100.5,
      "ay": 227.0,
      "desc": "Mario de pie",
      "theme": null
    },
    "mario_ataque": {
      "src": "assets/campaign/prologo/actores/mario_ataque.webp",
      "w": 201.0,
      "h": 267.5,
      "ax": 100.5,
      "ay": 236.5,
      "desc": "Mario alzando la paleta",
      "theme": null
    },
    "valen": {
      "src": "assets/campaign/prologo/actores/valen.webp",
      "w": 201.0,
      "h": 258.0,
      "ax": 100.5,
      "ay": 227.0,
      "desc": "Valen de pie",
      "theme": null
    },
    "valen_ataque": {
      "src": "assets/campaign/prologo/actores/valen_ataque.webp",
      "w": 201.0,
      "h": 267.5,
      "ax": 100.5,
      "ay": 236.5,
      "desc": "Valen alzando la paleta",
      "theme": null
    },
    "fano": {
      "src": "assets/campaign/prologo/actores/fano.webp",
      "w": 201.0,
      "h": 258.0,
      "ax": 100.5,
      "ay": 227.0,
      "desc": "Fano de pie",
      "theme": null
    },
    "fano_ataque": {
      "src": "assets/campaign/prologo/actores/fano_ataque.webp",
      "w": 201.0,
      "h": 267.5,
      "ax": 100.5,
      "ay": 236.5,
      "desc": "Fano alzando la paleta",
      "theme": null
    },
    "yisus": {
      "src": "assets/campaign/prologo/actores/yisus.webp",
      "w": 201.0,
      "h": 273.0,
      "ax": 100.5,
      "ay": 242.0,
      "desc": "Yisus de pie",
      "theme": null
    },
    "yisus_ataque": {
      "src": "assets/campaign/prologo/actores/yisus_ataque.webp",
      "w": 201.0,
      "h": 273.0,
      "ax": 100.5,
      "ay": 242.0,
      "desc": "Yisus alzando la paleta",
      "theme": null
    },
    "desconocido": {
      "src": "assets/campaign/prologo/actores/desconocido.webp",
      "w": 191.0,
      "h": 248.5,
      "ax": 95.5,
      "ay": 217.5,
      "desc": "De pie, sin paleta",
      "theme": "assets/campaign/prologo/actores/desconocido_tema.webp"
    },
    "desconocido_andar_a": {
      "src": "assets/campaign/prologo/actores/desconocido_andar_a.webp",
      "w": 191.0,
      "h": 248.5,
      "ax": 95.5,
      "ay": 217.5,
      "desc": "Andando, fotograma A",
      "theme": "assets/campaign/prologo/actores/desconocido_andar_a_tema.webp"
    },
    "desconocido_andar_b": {
      "src": "assets/campaign/prologo/actores/desconocido_andar_b.webp",
      "w": 191.0,
      "h": 248.5,
      "ax": 95.5,
      "ay": 217.5,
      "desc": "Andando, fotograma B",
      "theme": "assets/campaign/prologo/actores/desconocido_andar_b_tema.webp"
    },
    "desconocido_espalda": {
      "src": "assets/campaign/prologo/actores/desconocido_espalda.webp",
      "w": 191.0,
      "h": 248.5,
      "ax": 95.5,
      "ay": 217.5,
      "desc": "De espaldas, sin paleta",
      "theme": "assets/campaign/prologo/actores/desconocido_espalda_tema.webp"
    },
    "desconocido_espalda_paleta": {
      "src": "assets/campaign/prologo/actores/desconocido_espalda_paleta.webp",
      "w": 191.0,
      "h": 248.5,
      "ax": 95.5,
      "ay": 217.5,
      "desc": "De espaldas, con la paleta a la espalda",
      "theme": "assets/campaign/prologo/actores/desconocido_espalda_paleta_tema.webp"
    },
    "desconocido_guardia": {
      "src": "assets/campaign/prologo/actores/desconocido_guardia.webp",
      "w": 191.0,
      "h": 248.5,
      "ax": 95.5,
      "ay": 217.5,
      "desc": "En guardia con la paleta (reservado)",
      "theme": "assets/campaign/prologo/actores/desconocido_guardia_tema.webp"
    },
    "vecino1_a": {
      "src": "assets/campaign/prologo/actores/vecino1_a.webp",
      "w": 52.5,
      "h": 152.0,
      "ax": 21.5,
      "ay": 144.5,
      "desc": "Vecino 1, andando (a)",
      "theme": "assets/campaign/prologo/actores/vecino1_a_tema.webp"
    },
    "vecino1_b": {
      "src": "assets/campaign/prologo/actores/vecino1_b.webp",
      "w": 55.0,
      "h": 152.0,
      "ax": 24.0,
      "ay": 144.5,
      "desc": "Vecino 1, andando (b)",
      "theme": "assets/campaign/prologo/actores/vecino1_b_tema.webp"
    },
    "vecino2_a": {
      "src": "assets/campaign/prologo/actores/vecino2_a.webp",
      "w": 43.5,
      "h": 152.0,
      "ax": 21.5,
      "ay": 144.5,
      "desc": "Vecino 2, andando (a)",
      "theme": "assets/campaign/prologo/actores/vecino2_a_tema.webp"
    },
    "vecino2_b": {
      "src": "assets/campaign/prologo/actores/vecino2_b.webp",
      "w": 46.0,
      "h": 152.0,
      "ax": 24.0,
      "ay": 144.5,
      "desc": "Vecino 2, andando (b)",
      "theme": "assets/campaign/prologo/actores/vecino2_b_tema.webp"
    },
    "vecino3_a": {
      "src": "assets/campaign/prologo/actores/vecino3_a.webp",
      "w": 43.0,
      "h": 152.0,
      "ax": 23.0,
      "ay": 144.5,
      "desc": "Vecino 3, andando (a)",
      "theme": "assets/campaign/prologo/actores/vecino3_a_tema.webp"
    },
    "vecino3_b": {
      "src": "assets/campaign/prologo/actores/vecino3_b.webp",
      "w": 42.5,
      "h": 152.0,
      "ax": 24.0,
      "ay": 144.5,
      "desc": "Vecino 3, andando (b)",
      "theme": "assets/campaign/prologo/actores/vecino3_b_tema.webp"
    },
    "vecino4_a": {
      "src": "assets/campaign/prologo/actores/vecino4_a.webp",
      "w": 41.5,
      "h": 158.5,
      "ax": 21.5,
      "ay": 151.0,
      "desc": "Vecino 4, andando (a)",
      "theme": "assets/campaign/prologo/actores/vecino4_a_tema.webp"
    },
    "vecino4_b": {
      "src": "assets/campaign/prologo/actores/vecino4_b.webp",
      "w": 42.5,
      "h": 158.5,
      "ax": 24.0,
      "ay": 151.0,
      "desc": "Vecino 4, andando (b)",
      "theme": "assets/campaign/prologo/actores/vecino4_b_tema.webp"
    },
    "nino_vecino_a": {
      "src": "assets/campaign/prologo/actores/nino_vecino_a.webp",
      "w": 28.5,
      "h": 101.5,
      "ax": 14.5,
      "ay": 96.0,
      "desc": "Niño del barrio (a)",
      "theme": "assets/campaign/prologo/actores/nino_vecino_a_tema.webp"
    },
    "nino_vecino_b": {
      "src": "assets/campaign/prologo/actores/nino_vecino_b.webp",
      "w": 29.0,
      "h": 101.5,
      "ax": 16.0,
      "ay": 96.0,
      "desc": "Niño del barrio (b)",
      "theme": "assets/campaign/prologo/actores/nino_vecino_b_tema.webp"
    },
    "gris1_a": {
      "src": "assets/campaign/prologo/actores/gris1_a.webp",
      "w": 41.5,
      "h": 146.0,
      "ax": 21.5,
      "ay": 138.5,
      "desc": "Vecino bajo el Sindicato 1 (a)",
      "theme": null
    },
    "gris1_b": {
      "src": "assets/campaign/prologo/actores/gris1_b.webp",
      "w": 43.5,
      "h": 146.0,
      "ax": 24.0,
      "ay": 138.5,
      "desc": "Vecino bajo el Sindicato 1 (b)",
      "theme": null
    },
    "gris2_a": {
      "src": "assets/campaign/prologo/actores/gris2_a.webp",
      "w": 82.0,
      "h": 185.5,
      "ax": 27.0,
      "ay": 178.0,
      "desc": "Vecino bajo el Sindicato 2 (a)",
      "theme": null
    },
    "gris2_b": {
      "src": "assets/campaign/prologo/actores/gris2_b.webp",
      "w": 82.0,
      "h": 185.5,
      "ax": 27.0,
      "ay": 178.0,
      "desc": "Vecino bajo el Sindicato 2 (b)",
      "theme": null
    },
    "gris3_a": {
      "src": "assets/campaign/prologo/actores/gris3_a.webp",
      "w": 41.5,
      "h": 146.0,
      "ax": 21.5,
      "ay": 138.5,
      "desc": "Vecino bajo el Sindicato 3 (a)",
      "theme": null
    },
    "gris3_b": {
      "src": "assets/campaign/prologo/actores/gris3_b.webp",
      "w": 43.5,
      "h": 146.0,
      "ax": 24.0,
      "ay": 138.5,
      "desc": "Vecino bajo el Sindicato 3 (b)",
      "theme": null
    },
    "vendedor": {
      "src": "assets/campaign/prologo/actores/vendedor.webp",
      "w": 52.5,
      "h": 146.0,
      "ax": 21.5,
      "ay": 138.5,
      "desc": "Vendedor al que cobra Dani",
      "theme": null
    },
    "madre_a": {
      "src": "assets/campaign/prologo/actores/madre_a.webp",
      "w": 52.5,
      "h": 152.0,
      "ax": 21.5,
      "ay": 144.5,
      "desc": "La madre (a)",
      "theme": "assets/campaign/prologo/actores/madre_a_tema.webp"
    },
    "hijo_a": {
      "src": "assets/campaign/prologo/actores/hijo_a.webp",
      "w": 29.5,
      "h": 101.5,
      "ax": 14.5,
      "ay": 96.0,
      "desc": "El hijo (a)",
      "theme": "assets/campaign/prologo/actores/hijo_a_tema.webp"
    },
    "madre_b": {
      "src": "assets/campaign/prologo/actores/madre_b.webp",
      "w": 55.0,
      "h": 152.0,
      "ax": 24.0,
      "ay": 144.5,
      "desc": "La madre (b)",
      "theme": "assets/campaign/prologo/actores/madre_b_tema.webp"
    },
    "hijo_b": {
      "src": "assets/campaign/prologo/actores/hijo_b.webp",
      "w": 31.0,
      "h": 101.5,
      "ax": 16.0,
      "ay": 96.0,
      "desc": "El hijo (b)",
      "theme": "assets/campaign/prologo/actores/hijo_b_tema.webp"
    },
    "madre": {
      "src": "assets/campaign/prologo/actores/madre.webp",
      "w": 52.5,
      "h": 152.0,
      "ax": 21.5,
      "ay": 144.5,
      "desc": "La madre, quieta",
      "theme": "assets/campaign/prologo/actores/madre_tema.webp"
    },
    "hijo": {
      "src": "assets/campaign/prologo/actores/hijo.webp",
      "w": 31.5,
      "h": 101.5,
      "ax": 15.0,
      "ay": 96.0,
      "desc": "El hijo, quieto",
      "theme": "assets/campaign/prologo/actores/hijo_tema.webp"
    },
    "alcalde": {
      "src": "assets/campaign/prologo/actores/alcalde.webp",
      "w": 45.0,
      "h": 172.5,
      "ax": 26.0,
      "ay": 169.0,
      "desc": "El alcalde",
      "theme": null
    },
    "perro": {
      "src": "assets/campaign/prologo/actores/perro.webp",
      "w": 54.5,
      "h": 40.0,
      "ax": 25.5,
      "ay": 37.0,
      "desc": "Perro del vecino",
      "theme": null
    },
    "camioneta": {
      "src": "assets/campaign/prologo/actores/camioneta.webp",
      "w": 253.0,
      "h": 107.5,
      "ax": 131.5,
      "ay": 105.5,
      "desc": "Camioneta del Sindicato, mirando a la izquierda",
      "theme": null
    },
    "coche_locos": {
      "src": "assets/campaign/prologo/actores/coche_locos.webp",
      "w": 205.0,
      "h": 87.5,
      "ax": 103.5,
      "ay": 87.5,
      "desc": "Coche de los locos, mirando a la izquierda",
      "theme": null
    },
    "paleta_nino": {
      "src": "assets/campaign/prologo/actores/paleta_nino.webp",
      "w": 34.0,
      "h": 57.5,
      "ax": 33.0,
      "ay": 63.0,
      "desc": "La paleta del padre del niño",
      "theme": null
    },
    "desconocido_sentado": {
      "src": "assets/campaign/prologo/actores/desconocido_sentado.webp",
      "w": 191.0,
      "h": 248.5,
      "desc": "Sentado contra el árbol, cabeza gacha (escena 3)",
      "theme": "assets/campaign/prologo/actores/desconocido_sentado_tema.webp",
      "ax": 95.5,
      "ay": 217.5
    },
    "desconocido_tumbado": {
      "src": "assets/campaign/prologo/actores/desconocido_tumbado.webp",
      "w": 190.0,
      "h": 247.5,
      "desc": "Inconsciente contra el árbol (escenas 6 y 12)",
      "theme": "assets/campaign/prologo/actores/desconocido_tumbado_tema.webp",
      "ax": 95.0,
      "ay": 216.5
    },
    "desconocido_cayendo": {
      "src": "assets/campaign/prologo/actores/desconocido_cayendo.webp",
      "w": 243.5,
      "h": 195.5,
      "desc": "Despedido por la explosión (escena 6)",
      "theme": "assets/campaign/prologo/actores/desconocido_cayendo_tema.webp",
      "ax": 115.0,
      "ay": 235.5
    },
    "alcalde_sudando": {
      "src": "assets/campaign/prologo/actores/alcalde_sudando.webp",
      "w": 66.0,
      "h": 172.5,
      "desc": "El alcalde con la paleta, sudando (escena 8)",
      "theme": null,
      "ax": 26.0,
      "ay": 169.0
    },
    "alcalde_rodillas": {
      "src": "assets/campaign/prologo/actores/alcalde_rodillas.webp",
      "w": 91.0,
      "h": 154.0,
      "desc": "De rodillas con media paleta (escena 8)",
      "theme": null,
      "ax": 47.0,
      "ay": 150.5
    },
    "alcalde_llave": {
      "src": "assets/campaign/prologo/actores/alcalde_llave.webp",
      "w": 99.5,
      "h": 172.5,
      "desc": "Entregando la llave (escena 9)",
      "theme": null,
      "ax": 26.0,
      "ay": 169.0
    },
    "llave": {
      "src": "assets/campaign/prologo/actores/llave.webp",
      "w": 186.5,
      "h": 73.0,
      "desc": "La llave de la torre en primer plano (escena 9)",
      "theme": null,
      "ax": 92.5,
      "ay": 76.5
    },
    "media_paleta": {
      "src": "assets/campaign/prologo/actores/media_paleta.webp",
      "w": 37.0,
      "h": 51.0,
      "desc": "La paleta partida del alcalde (escena 8)",
      "theme": null,
      "ax": 38.0,
      "ay": 56.0
    },
    "mostrador": {
      "src": "assets/campaign/prologo/actores/mostrador.webp",
      "w": 320.0,
      "h": 160.0,
      "desc": "Mostrador de la recepción: va delante de Chemi (escenas 10 y 17)",
      "theme": null,
      "ax": 159.0,
      "ay": 159.0
    },
    "maquina_arcade": {
      "src": "assets/campaign/prologo/actores/maquina_arcade.webp",
      "w": 90.0,
      "h": 168.0,
      "desc": "Máquina del Arcade (escena 10)",
      "theme": "assets/campaign/prologo/actores/maquina_arcade_tema.webp",
      "ax": 45.0,
      "ay": 167.0
    },
    "alcancia": {
      "src": "assets/campaign/prologo/actores/alcancia.webp",
      "w": 66.0,
      "h": 46.0,
      "desc": "Alcancía dorada del Sindicato (escena 10)",
      "theme": null,
      "ax": 34.0,
      "ay": 43.0
    },
    "dani_libreta": {
      "src": "assets/campaign/prologo/actores/dani_libreta.webp",
      "w": 201.0,
      "h": 267.5,
      "desc": "Dani con la libreta de cuotas (escena 10)",
      "theme": null,
      "ax": 100.5,
      "ay": 236.5
    },
    "fano_movil": {
      "src": "assets/campaign/prologo/actores/fano_movil.webp",
      "w": 201.0,
      "h": 258.0,
      "desc": "Fano con Chayipiti en el móvil (escena 10)",
      "theme": null,
      "ax": 100.5,
      "ay": 227.0
    },
    "yisus_silueta": {
      "src": "assets/campaign/prologo/actores/yisus_silueta.webp",
      "w": 201.0,
      "h": 273.0,
      "desc": "Yisus a contraluz frente al ventanal (escena 10)",
      "theme": null,
      "ax": 100.5,
      "ay": 242.0
    },
    "chemi_silueta": {
      "src": "assets/campaign/prologo/actores/chemi_silueta.webp",
      "w": 201.0,
      "h": 269.0,
      "desc": "Chemi a contraluz tras el cristal (escena 17)",
      "theme": null,
      "ax": 100.5,
      "ay": 238.0
    },
    "busto_chemi": {
      "src": "assets/campaign/bustos/chemi.webp",
      "w": 140.0,
      "h": 140.0,
      "desc": "Busto de chemi",
      "theme": null,
      "ax": 70.0,
      "ay": 140.0
    },
    "busto_dani": {
      "src": "assets/campaign/bustos/dani.webp",
      "w": 140.0,
      "h": 140.0,
      "desc": "Busto de dani",
      "theme": null,
      "ax": 70.0,
      "ay": 140.0
    },
    "busto_mario": {
      "src": "assets/campaign/bustos/mario.webp",
      "w": 140.0,
      "h": 140.0,
      "desc": "Busto de mario",
      "theme": null,
      "ax": 70.0,
      "ay": 140.0
    },
    "busto_valen": {
      "src": "assets/campaign/bustos/valen.webp",
      "w": 140.0,
      "h": 140.0,
      "desc": "Busto de valen",
      "theme": null,
      "ax": 70.0,
      "ay": 140.0
    },
    "busto_fano": {
      "src": "assets/campaign/bustos/fano.webp",
      "w": 140.0,
      "h": 140.0,
      "desc": "Busto de fano",
      "theme": null,
      "ax": 70.0,
      "ay": 140.0
    },
    "busto_yisus": {
      "src": "assets/campaign/bustos/yisus.webp",
      "w": 140.0,
      "h": 140.0,
      "desc": "Busto de yisus",
      "theme": null,
      "ax": 70.0,
      "ay": 140.0
    },
    "busto_desconocido": {
      "src": "assets/campaign/bustos/desconocido.webp",
      "w": 120.0,
      "h": 120.0,
      "desc": "Busto de desconocido",
      "theme": "assets/campaign/bustos/desconocido_tema.webp",
      "ax": 60.0,
      "ay": 120.0
    },
    "busto_alcalde": {
      "src": "assets/campaign/bustos/alcalde.webp",
      "w": 80.0,
      "h": 80.0,
      "desc": "Busto de alcalde",
      "theme": null,
      "ax": 40.0,
      "ay": 80.0
    }
  }
};
