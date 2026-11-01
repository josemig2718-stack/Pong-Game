/**
 * data/campaign-art.js — GENERADO por design/campana/generadores/build5.py (merge5.py). No editar a mano.
 *
 * Arte de la campaña fuera de las escenas: bustos, Torre Hachepe, arenas de los jefes y piezas del combate final (juego).
 * w/h en unidades (bustos: 1 unidad = 4 px; torre y arena: 1 unidad = 2 px). juego: pxW/pxH en px (2 px por unidad del campo).
 * theme = máscara blanca con alfa que se tiñe (dorado = Sindicato, color del tema = liberado).
 */
'use strict';

const CAMPAIGN_ART = {
  "bustos": {
    "chemi": {
      "src": "assets/campaign/bustos/chemi.webp",
      "w": 140.0,
      "h": 140.0,
      "theme": null
    },
    "dani": {
      "src": "assets/campaign/bustos/dani.webp",
      "w": 140.0,
      "h": 140.0,
      "theme": null
    },
    "mario": {
      "src": "assets/campaign/bustos/mario.webp",
      "w": 140.0,
      "h": 140.0,
      "theme": null
    },
    "valen": {
      "src": "assets/campaign/bustos/valen.webp",
      "w": 140.0,
      "h": 140.0,
      "theme": null
    },
    "fano": {
      "src": "assets/campaign/bustos/fano.webp",
      "w": 140.0,
      "h": 140.0,
      "theme": null
    },
    "yisus": {
      "src": "assets/campaign/bustos/yisus.webp",
      "w": 140.0,
      "h": 140.0,
      "theme": null
    },
    "desconocido": {
      "src": "assets/campaign/bustos/desconocido.webp",
      "w": 120.0,
      "h": 120.0,
      "theme": "assets/campaign/bustos/desconocido_tema.webp"
    },
    "alcalde": {
      "src": "assets/campaign/bustos/alcalde.webp",
      "w": 80.0,
      "h": 80.0,
      "theme": null
    },
    "chayipiti": {
      "src": "assets/campaign/bustos/chayipiti.webp",
      "w": 140.0,
      "h": 140.0,
      "theme": null
    },
    "chayipiti_error": {
      "src": "assets/campaign/bustos/chayipiti_error.webp",
      "w": 140.0,
      "h": 140.0,
      "theme": null
    },
    "mariangel": {
      "src": "assets/campaign/bustos/mariangel.webp",
      "w": 140.0,
      "h": 140.0,
      "theme": null
    },
    "creador": {
      "src": "assets/campaign/bustos/creador.webp",
      "w": 150.0,
      "h": 150.0,
      "theme": null
    },
    "pedro": {
      "src": "assets/campaign/bustos/pedro.webp",
      "w": 76.0,
      "h": 76.0,
      "theme": "assets/campaign/bustos/pedro_tema.webp"
    },
    "nino": {
      "src": "assets/campaign/bustos/nino.webp",
      "w": 52.0,
      "h": 52.0,
      "theme": "assets/campaign/bustos/nino_tema.webp"
    },
    "madre": {
      "src": "assets/campaign/bustos/madre.webp",
      "w": 76.0,
      "h": 76.0,
      "theme": "assets/campaign/bustos/madre_tema.webp"
    }
  },
  "torre": {
    "ciudad_libre": {
      "src": "assets/campaign/torre/ciudad_libre.webp",
      "w": 960,
      "h": 540,
      "theme": "assets/campaign/torre/ciudad_libre_tema.webp"
    },
    "ciudad_sindicato": {
      "src": "assets/campaign/torre/ciudad_sindicato.webp",
      "w": 960,
      "h": 540,
      "theme": null
    },
    "techo": {
      "src": "assets/campaign/torre/techo.webp",
      "w": 480.0,
      "h": 160.0,
      "theme": "assets/campaign/torre/techo_tema.webp"
    },
    "piso_4": {
      "src": "assets/campaign/torre/piso_4.webp",
      "w": 480,
      "h": 120,
      "theme": "assets/campaign/torre/piso_4_tema.webp"
    },
    "piso_3": {
      "src": "assets/campaign/torre/piso_3.webp",
      "w": 480,
      "h": 120,
      "theme": "assets/campaign/torre/piso_3_tema.webp"
    },
    "piso_2": {
      "src": "assets/campaign/torre/piso_2.webp",
      "w": 480,
      "h": 120,
      "theme": "assets/campaign/torre/piso_2_tema.webp"
    },
    "piso_1": {
      "src": "assets/campaign/torre/piso_1.webp",
      "w": 480,
      "h": 120,
      "theme": "assets/campaign/torre/piso_1_tema.webp"
    },
    "piso_pb": {
      "src": "assets/campaign/torre/piso_pb.webp",
      "w": 480,
      "h": 120,
      "theme": "assets/campaign/torre/piso_pb_tema.webp"
    },
    "sotano": {
      "src": "assets/campaign/torre/sotano.webp",
      "w": 480,
      "h": 120,
      "theme": "assets/campaign/torre/sotano_tema.webp"
    },
    "techo_barks": {
      "src": "assets/campaign/torre/techo_barks.webp",
      "w": 480.0,
      "h": 160.0,
      "theme": "assets/campaign/torre/techo_barks_tema.webp"
    }
  },
  "chemi": {
    "arena_chemi": {
      "src": "assets/campaign/chemi/arena_chemi.webp",
      "w": 800,
      "h": 600,
      "theme": "assets/campaign/chemi/arena_chemi_tema.webp"
    }
  },
  "pisos": {
    "arena_dani": {
      "src": "assets/campaign/pisos/arenas/arena_dani.webp",
      "w": 800,
      "h": 600,
      "theme": "assets/campaign/pisos/arenas/arena_dani_tema.webp"
    },
    "arena_duo": {
      "src": "assets/campaign/pisos/arenas/arena_duo.webp",
      "w": 800,
      "h": 600,
      "theme": "assets/campaign/pisos/arenas/arena_duo_tema.webp"
    },
    "arena_fano": {
      "src": "assets/campaign/pisos/arenas/arena_fano.webp",
      "w": 800,
      "h": 600,
      "theme": "assets/campaign/pisos/arenas/arena_fano_tema.webp"
    }
  },
  "final": {
    "arena_yisus": {
      "src": "assets/campaign/final/arenas/arena_yisus.webp",
      "w": 800,
      "h": 600,
      "theme": "assets/campaign/final/arenas/arena_yisus_tema.webp"
    },
    "arena_creador": {
      "src": "assets/campaign/final/arenas/arena_creador.webp",
      "w": 800,
      "h": 600,
      "theme": "assets/campaign/final/arenas/arena_creador_tema.webp"
    }
  },
  "juego": {
    "ataud_campo": {
      "src": "assets/campaign/final/juego/ataud_campo.webp",
      "pxW": 92,
      "pxH": 312
    },
    "ataud_campo_carga": {
      "src": "assets/campaign/final/juego/ataud_campo_carga.webp",
      "pxW": 92,
      "pxH": 312
    },
    "reloj": {
      "src": "assets/campaign/final/juego/reloj.webp",
      "pxW": 160,
      "pxH": 160
    },
    "grietas_1": {
      "src": "assets/campaign/final/juego/grietas_1.webp",
      "pxW": 1600,
      "pxH": 1200
    },
    "grietas_2": {
      "src": "assets/campaign/final/juego/grietas_2.webp",
      "pxW": 1600,
      "pxH": 1200
    },
    "grietas_3": {
      "src": "assets/campaign/final/juego/grietas_3.webp",
      "pxW": 1600,
      "pxH": 1200
    }
  }
};
