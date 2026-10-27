
const CONFIG = {
  lenguaje: {
    nombre: "Lenguaje",
    rapido: 12,
    completo: 35
  },
  artes: {
    nombre: "Artes",
    rapido: 8,
    completo: 12
  }
};

const STORAGE_KEY = "ari-estudia-sesion-v1";

const $ = (selector) => document.querySelector(selector);

const screens = {
  home: $("#home-screen"),
  mode: $("#mode-screen"),
  quiz: $("#quiz-screen"),
  result: $("#result-screen")
};

let materiaActual = null;
let sesion = null;
let reviewVisible = false;

function mostrarPantalla(nombre) {
  Object.values(screens).forEach((screen) => {
    screen.classList.add("hidden");
  });

  screens[nombre].classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function mezclar(lista) {
  const copia = [...lista];

  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }

  return copia;
}

function guardarSesion() {
  if (!sesion) {
    localStorage.removeItem(STORAGE_KEY);
    actualizarAvisoGuardado();
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sesion));
  } catch (error) {
    console.warn("No se pudo guardar la sesión.", error);
  }

  actualizarAvisoGuardado();
}

function leerSesionGuardada() {
  try {
    const texto = localStorage.getItem(STORAGE_KEY);

    if (!texto) return null;

    const datos = JSON.parse(texto);

    if (
      !datos ||
      !CONFIG[datos.materia] ||
      !Array.isArray(datos.preguntas) ||
      !Array.isArray(datos.respuestas) ||
      !["rapido", "completo"].includes(datos.modo) ||
      !["quiz", "result"].includes(datos.estado)
    ) {
      return null;
    }

    const banco = window.BANCO_PREGUNTAS[datos.materia];

    if (
      !Array.isArray(banco) ||
      datos.preguntas.length === 0 ||
      datos.preguntas.length > banco.length ||
      datos.preguntas.some((p) => !banco.some(
        (original) => original.pregunta === p.pregunta
      )) ||
      datos.respuestas.length !== datos.preguntas.length ||
      !Number.isInteger(datos.indice) ||
      datos.indice < 0 ||
      datos.indice >= datos.preguntas.length
    ) {
      return null;
    }

    for (let i = 0; i < datos.respuestas.length; i++) {
      const respuesta = datos.respuestas[i];

      if (
        !respuesta ||
        !["pendiente", "correcta", "incorrecta", "omitida"].includes(
          respuesta.estado
        ) ||
        !(respuesta.elegida === null ||
          (Number.isInteger(respuesta.elegida) &&
            respuesta.elegida >= 0 &&
            respuesta.elegida < datos.preguntas[i].opciones.length))
      ) {
        return null;
      }
    }

    return datos;
  } catch {
    return null;
  }
}

function actualizarAvisoGuardado() {
  const guardada = leerSesionGuardada();
  const notice = $("#saved-notice");

  if (!guardada) {
    notice.classList.add("hidden");
    return;
  }

  const respondidas = guardada.respuestas.filter(
    (r) => r.estado !== "pendiente"
  ).length;

  $("#saved-description").textContent =
    `${CONFIG[guardada.materia].nombre} · ` +
    `${respondidas} de ${guardada.preguntas.length} preguntas respondidas.`;

  notice.classList.remove("hidden");
}

function abrirInicio() {
  materiaActual = null;
  actualizarAvisoGuardado();
  mostrarPantalla("home");
}

function abrirMateria(materia) {
  if (!CONFIG[materia]) return;

  materiaActual = materia;
  const config = CONFIG[materia];
  const cantidad = window.BANCO_PREGUNTAS[materia].length;

  $("#mode-title").textContent = config.nombre;
  $("#mode-description").textContent =
    `Hay ${cantidad} preguntas disponibles en el banco de ${config.nombre}.`;

  $("#quick-count").textContent =
    `${Math.min(config.rapido, cantidad)} preguntas aleatorias`;

  $("#full-count").textContent =
    `${Math.min(config.completo, cantidad)} preguntas aleatorias`;

  mostrarPantalla("mode");
}

function iniciarCuestionario(materia, modo) {
  const banco = window.BANCO_PREGUNTAS[materia];

  if (!Array.isArray(banco) || banco.length === 0) {
    alert("Todavía no hay preguntas para esta materia.");
    return;
  }

  const cantidadSolicitada = CONFIG[materia][modo];
  const cantidad = Math.min(cantidadSolicitada, banco.length);

  sesion = {
    materia,
    modo,
    preguntas: mezclar(banco).slice(0, cantidad),
    indice: 0,
    respuestas: Array.from({ length: cantidad }, () => ({
      elegida: null,
      estado: "pendiente"
    })),
    estado: "quiz"
  };

  reviewVisible = false;
  $("#review-list").classList.add("hidden");

  guardarSesion();
  mostrarPantalla("quiz");
  mostrarPregunta();
}

function continuarSesion() {
  const guardada = leerSesionGuardada();

  if (!guardada) {
    alert("No encontramos una sesión guardada válida.");
    actualizarAvisoGuardado();
    return;
  }

  sesion = guardada;
  materiaActual = sesion.materia;

  if (sesion.estado === "result") {
    mostrarResultados();
  } else {
    mostrarPantalla("quiz");
    mostrarPregunta();
  }
}

function mostrarPregunta() {
  if (!sesion) return;

  const pregunta = sesion.preguntas[sesion.indice];
  const respuesta = sesion.respuestas[sesion.indice];
  const total = sesion.preguntas.length;
  const respondidas = sesion.respuestas.filter(
    (r) => r.estado !== "pendiente"
  ).length;

  $("#quiz-subject").textContent = CONFIG[sesion.materia].nombre;
  $("#question-counter").textContent =
    `Pregunta ${sesion.indice + 1} de ${total}`;
  $("#score-counter").textContent = `${respondidas} respondidas`;
  $("#progress-bar").style.width =
    `${((sesion.indice + 1) / total) * 100}%`;

  $("#question-topic").textContent = pregunta.tema;
  $("#question-text").textContent = pregunta.pregunta;
  $("#question-hint").textContent =
    respuesta.estado === "pendiente"
      ? "Selecciona una respuesta."
      : "Revisa tu respuesta antes de continuar.";

  const optionsList = $("#options-list");
  optionsList.replaceChildren();

  pregunta.opciones.forEach((opcion, indice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option";

    const letra = document.createElement("span");
    letra.className = "option-letter";
    letra.textContent = String.fromCharCode(65 + indice);

    const texto = document.createElement("span");
    texto.textContent = opcion;

    button.append(letra, texto);

    if (respuesta.elegida === indice) {
      button.classList.add("selected");
    }

    if (respuesta.estado !== "pendiente") {
      button.disabled = true;

      if (indice === pregunta.correcta) {
        button.classList.add("correct");
      } else if (indice === respuesta.elegida) {
        button.classList.add("incorrect");
      }
    } else {
      button.addEventListener("click", () => seleccionarRespuesta(indice));
    }

    optionsList.append(button);
  });

  $("#check-answer").classList.toggle(
    "hidden",
    respuesta.estado !== "pendiente"
  );
  $("#check-answer").disabled = respuesta.elegida === null;

  $("#next-question").classList.toggle(
    "hidden",
    respuesta.estado === "pendiente"
  );

  $("#next-question").textContent =
    sesion.indice === total - 1
      ? "Ver resultados →"
      : "Siguiente pregunta →";

  const feedback = $("#feedback");
  feedback.classList.add("hidden");
  feedback.classList.remove("wrong-feedback");
  feedback.replaceChildren();

  if (respuesta.estado !== "pendiente") {
    mostrarRetroalimentacion(pregunta, respuesta);
  }
}

function seleccionarRespuesta(indice) {
  if (!sesion) return;

  const respuesta = sesion.respuestas[sesion.indice];

  if (respuesta.estado !== "pendiente") return;

  respuesta.elegida = indice;

  $("#options-list").querySelectorAll(".option").forEach((button, i) => {
    button.classList.toggle("selected", i === indice);
  });

  $("#check-answer").disabled = false;
  guardarSesion();
}

function mostrarRetroalimentacion(pregunta, respuesta) {
  const feedback = $("#feedback");
  const correcta = respuesta.estado === "correcta";

  feedback.classList.remove("hidden");
  feedback.classList.toggle("wrong-feedback", !correcta);

  const titulo = document.createElement("strong");
  titulo.textContent = correcta
    ? "¡Correcto! 🎉"
    : "Repasemos esta respuesta";

  const explicacion = document.createElement("p");
  explicacion.textContent = pregunta.explicacion;

  feedback.append(titulo, explicacion);

  if (!correcta) {
    const solucion = document.createElement("p");
    solucion.textContent =
      `Respuesta correcta: ${pregunta.opciones[pregunta.correcta]}`;
    feedback.append(solucion);
  }
}

function comprobarRespuesta() {
  if (!sesion) return;

  const pregunta = sesion.preguntas[sesion.indice];
  const respuesta = sesion.respuestas[sesion.indice];

  if (
    respuesta.estado !== "pendiente" ||
    respuesta.elegida === null
  ) {
    return;
  }

  respuesta.estado =
    respuesta.elegida === pregunta.correcta
      ? "correcta"
      : "incorrecta";

  guardarSesion();
  mostrarPregunta();
}

function siguientePregunta() {
  if (!sesion) return;

  if (sesion.indice < sesion.preguntas.length - 1) {
    sesion.indice++;
    guardarSesion();
    mostrarPregunta();
    return;
  }

  sesion.estado = "result";
  guardarSesion();
  mostrarResultados();
}

function mostrarResultados() {
  if (!sesion) return;

  mostrarPantalla("result");

  const total = sesion.preguntas.length;
  const correctas = sesion.respuestas.filter(
    (r) => r.estado === "correcta"
  ).length;
  const incorrectas = sesion.respuestas.filter(
    (r) => r.estado === "incorrecta"
  ).length;
  const omitidas = sesion.respuestas.filter(
    (r) => r.estado === "omitida" || r.estado === "pendiente"
  ).length;
  const porcentaje = Math.round((correctas / total) * 100);

  $("#result-title").textContent =
    porcentaje >= 80 ? "¡Excelente trabajo!" :
    porcentaje >= 60 ? "¡Vas progresando!" :
    "¡Sigamos practicando!";

  $("#result-message").textContent =
    porcentaje >= 80
      ? "Repasa los detalles que fallaste para consolidar lo aprendido."
      : "Cada intento ayuda. Revisa las explicaciones y vuelve a intentarlo.";

  $("#result-percentage").textContent = `${porcentaje}%`;
  $("#result-fraction").textContent = `${correctas} de ${total} correctas`;
  $("#result-correct").textContent = correctas;
  $("#result-wrong").textContent = incorrectas;
  $("#result-skipped").textContent = omitidas;

  $("#review-list").classList.add("hidden");
  $("#review-button").textContent = "Revisar respuestas";
  reviewVisible = false;

  const retryButton = $("#retry-button");
  retryButton.textContent = "Intentar de nuevo";
  retryButton.classList.remove("hidden");

  const reviewButton = $("#review-button");
  reviewButton.classList.remove("hidden");

  const returnButton = $("#return-home");
  returnButton.textContent = "Volver a las materias";

  construirRevision();
}

function construirRevision() {
  const contenido = $("#review-content");
  contenido.replaceChildren();

  sesion.preguntas.forEach((pregunta, indice) => {
    const respuesta = sesion.respuestas[indice];
    const article = document.createElement("article");
    article.className = "review-item";

    const tema = document.createElement("p");
    tema.className = "eyebrow";
    tema.textContent = pregunta.tema;

    const titulo = document.createElement("strong");
    titulo.textContent = `${indice + 1}. ${pregunta.pregunta}`;

    const elegida = document.createElement("p");
    elegida.className = "review-answer";

    if (respuesta.elegida === null) {
      elegida.textContent = "Tu respuesta: sin responder.";
    } else {
      elegida.textContent =
        `Tu respuesta: ${pregunta.opciones[respuesta.elegida]}.`;
    }

    const correcta = document.createElement("p");
    correcta.className = "review-answer";
    correcta.textContent =
      `Respuesta correcta: ${pregunta.opciones[pregunta.correcta]}.`;

    const explicacion = document.createElement("p");
    explicacion.className = "review-answer";
    explicacion.textContent = pregunta.explicacion;

    article.append(tema, titulo, elegida, correcta, explicacion);
    contenido.append(article);
  });
}

function alternarRevision() {
  reviewVisible = !reviewVisible;

  $("#review-list").classList.toggle("hidden", !reviewVisible);
  $("#review-button").textContent =
    reviewVisible ? "Ocultar revisión" : "Revisar respuestas";

  if (reviewVisible) {
    $("#review-list").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

function salirDelCuestionario() {
  if (!sesion) {
    abrirInicio();
    return;
  }

  const confirmar = window.confirm(
    "¿Quieres salir? Tu progreso se guardará para que puedas continuar después."
  );

  if (confirmar) {
    guardarSesion();
    abrirInicio();
  }
}

function configurarEventos() {
  document.querySelectorAll("[data-subject]").forEach((button) => {
    button.addEventListener("click", () => {
      abrirMateria(button.dataset.subject);
    });
  });

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!materiaActual) return;
      iniciarCuestionario(materiaActual, button.dataset.mode);
    });
  });

  $("#home-link").addEventListener("click", (event) => {
    event.preventDefault();
    abrirInicio();
  });

  $("#back-home").addEventListener("click", abrirInicio);
  $("#resume-button").addEventListener("click", continuarSesion);
  $("#check-answer").addEventListener("click", comprobarRespuesta);
  $("#next-question").addEventListener("click", siguientePregunta);
  $("#exit-quiz").addEventListener("click", salirDelCuestionario);
  $("#retry-button").addEventListener("click", () => {
    if (sesion) iniciarCuestionario(sesion.materia, sesion.modo);
  });
  $("#review-button").addEventListener("click", alternarRevision);
  $("#return-home").addEventListener("click", () => {
  sesion = null;
  guardarSesion();
  abrirInicio();
});
}

function iniciarAplicacion() {
  configurarEventos();
  actualizarAvisoGuardado();
  abrirInicio();
}

iniciarAplicacion();
