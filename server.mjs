import express from 'express';
import Alexa, { SkillBuilders } from 'ask-sdk-core';
import { ExpressAdapter } from 'ask-sdk-express-adapter';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

const categories = ['Colores', 'Animales'];

const colores = [
  { nombre: 'Rojo', backgroundColor: 'rgb(255, 0, 0)' },
  { nombre: 'Azul', backgroundColor: 'rgb(0, 0, 255)' },
  { nombre: 'Blanco', backgroundColor: 'rgb(255, 255, 255)' },
  { nombre: 'Negro', backgroundColor: 'rgb(0, 0, 0)' },
  { nombre: 'Amarillo', backgroundColor: 'rgb(255, 255, 0)' },
  { nombre: 'Naranja', backgroundColor: 'rgb(255, 165, 0)' },
  { nombre: 'Gris', backgroundColor: 'rgb(128, 128, 128)' },
  { nombre: 'Verde', backgroundColor: 'rgb(0, 255, 0)' },
  { nombre: 'Celeste', backgroundColor: 'rgb(173, 216, 230)' },
  { nombre: 'Morado', backgroundColor: 'rgb(128, 0, 128)' },
];

const sonidosAnimales = [
  { nombre: 'Gallina', soundURL: 'soundbank://soundlibrary/animals/amzn_sfx_chicken_cluck_01' },
  { nombre: 'Gato', soundURL: 'soundbank://soundlibrary/animals/amzn_sfx_cat_meow_1x_02' },
  { nombre: 'Perro', soundURL: 'soundbank://soundlibrary/animals/amzn_sfx_dog_med_bark_2x_02' },
  { nombre: 'Cerdo', soundURL: 'soundbank://soundlibrary/animals/amzn_sfx_pig_oink_01' },
  { nombre: 'Oveja', soundURL: 'soundbank://soundlibrary/animals/amzn_sfx_sheep_bleat_03' },
  { nombre: 'Vaca', soundURL: 'soundbank://soundlibrary/animals/amzn_sfx_cow_moo_01' },
  { nombre: 'Caballo', soundURL: 'soundbank://soundlibrary/animals/amzn_sfx_horse_huff_whinny_01' },
  { nombre: 'Pato', soundURL: 'soundbank://soundlibrary/animals/amzn_sfx_duck_quack_01' },
  { nombre: 'León', soundURL: 'soundbank://soundlibrary/animals/amzn_sfx_lion_roar_03' },
  { nombre: 'Elefante', soundURL: 'soundbank://soundlibrary/animals/amzn_sfx_elephant_01' },
];

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const colorQuestions = shuffleArray(colores).map(color => ({
  question: `¿Cuál es este color?`,
  correctAnswer: color.nombre.toLowerCase(),
  answers: colores.map(c => c.nombre.toLowerCase()).filter(c => c !== color.nombre.toLowerCase()),
  backgroundColor: color.backgroundColor,
}));

const animalQuestions = shuffleArray(sonidosAnimales).map(animal => ({
  question: `¿Cuál es el sonido de este animal?`,
  correctAnswer: animal.nombre.toLowerCase(),
  answers: sonidosAnimales.map(a => a.nombre.toLowerCase()).filter(a => a !== animal.nombre.toLowerCase()),
  soundURL: animal.soundURL,
}));

const generateAPLADocument  = (soundURL) => {
  console.log('Reproduciendo sonido:', soundURL);
  return {
    type: 'APLA',
    version: '0.91',
    mainTemplate: {
      parameters: ['payload'],
      items: [
        {
          type: 'Audio',
          source: soundURL,
        },
      ],
    },
  };
};

const generateColorAPLTemplate = (backgroundColor, question) => {
  return {
    type: 'APL',
    version: '1.8',
    theme: 'dark',
    import: [
      {
        name: 'alexa-layouts',
        version: '1.7.0',
      },
    ],
    mainTemplate: {
      items: [
        {
          type: 'AlexaHeadline',
          backgroundColor: backgroundColor,
          primaryText: question,
          secondaryText: '¡Bienvenido a Prueba!',
          id: 'AlexaHeadline',
        },
      ],
    },
  };
};
const removeAccents = (str) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  handle(handlerInput) {
    const speakOutput = '¡Bienvenido! Soy tu asistente de juego. Di "comenzar juego" para iniciar una nueva partida.';
    const repromptOutput = 'Para comenzar una nueva partida, di "comenzar juego".';
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(repromptOutput)
      .getResponse();
  },
};

const sendDataToServer = async (dataToSend) => {
  try {
    await axios.post('http://localhost:80/resultados', {
      ...dataToSend,
      nombreUsuario: dataToSend.nombre,
    });
    console.log('Datos enviados al servidor con éxito.');
  } catch (error) {
    console.error('Error al enviar datos al servidor:', error);
  }
};

const StartGameIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'StartGameIntent'
    );
  },
  async handle(handlerInput) {
    try {
      const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        // Calcular y almacenar el tiempo de inicio del juego
      sessionAttributes.startTime = Date.now();
      
      if (!sessionAttributes.userName) {
        const speakOutput = 'Antes de comenzar, por favor, dime tu nombre.';
        return handlerInput.responseBuilder
          .speak(speakOutput)
          .reprompt('Por favor, dime tu nombre para continuar.')
          .getResponse();
      }

      if (!sessionAttributes.category) {
        const speakOutput = '¿En qué categoría quieres jugar? Puedes elegir entre Colores y Animales.';
        return handlerInput.responseBuilder
          .speak(speakOutput)
          .reprompt('¿En qué categoría quieres jugar? Di "Colores" o "Animales".')
          .getResponse();
      }

      if (!sessionAttributes.questions || sessionAttributes.questions.length === 0) {
        // Cargar 10 preguntas para cada categoría
        if (sessionAttributes.category === 'Colores') {
          sessionAttributes.questions = shuffleArray([...colorQuestions]).slice(0, 10);
        } else if (sessionAttributes.category === 'Animales') {
          sessionAttributes.questions = shuffleArray([...animalQuestions]).slice(0, 10);
        }
      }

      const aplDocument = (sessionAttributes.category === 'Colores')
        ? generateColorAPLTemplate(sessionAttributes.questions[0].backgroundColor, sessionAttributes.questions[0].question)
        : generateAPLADocument(sessionAttributes.questions[0].soundURL);

      handlerInput.responseBuilder.addDirective({
        type: (sessionAttributes.category === 'Colores') ? 'Alexa.Presentation.APL.RenderDocument' : 'Alexa.Presentation.APLA.RenderDocument',
        token: 'gameDocumentToken',
        document: aplDocument,
      });

      sessionAttributes.score = 0;
      sessionAttributes.gamesPlayed = sessionAttributes.gamesPlayed ? sessionAttributes.gamesPlayed + 1 : 1;
      sessionAttributes.wrongAttempts = 0;
      sessionAttributes.startTime = Date.now();

      const currentQuestion = sessionAttributes.questions.shift();
      sessionAttributes.currentQuestion = currentQuestion;

      const speakOutput = `¡Bienvenido, ${sessionAttributes.userName}! Iniciando nuevo juego en la categoría ${sessionAttributes.category}. Primera pregunta: ${currentQuestion.question}.`;
      return handlerInput.responseBuilder
        .speak(speakOutput)
        .getResponse();
    } catch (error) {
      console.error('Error en StartGameIntentHandler:', error);
      return handlerInput.responseBuilder.speak('Hubo un problema al iniciar el juego.').getResponse();
    }
  },
};

const AnswerIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'AnswerIntent'
    );
  },
  async handle(handlerInput) {
    try {
      console.log('AnswerIntentHandler:', 'Recibida una respuesta del usuario');

      const attemptMessages = [
        'Casi lo logras, inténtalo nuevamente',
        'Estás muy cerca, inténtalo nuevamente',
        '¡Estás en el camino correcto! Un poquito más y lo lograrás. ¡Vamos, una última vez!',
      ];

      const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
      const currentQuestion = sessionAttributes.currentQuestion;
      const elapsedTime = Date.now() - sessionAttributes.startTime;
      if (!currentQuestion) {
        console.error('AnswerIntentHandler:', 'currentQuestion no está definido.');
        return handlerInput.responseBuilder.speak('Hubo un problema con la pregunta actual.').getResponse();
      }

      const userAnswer = Alexa.getSlotValue(handlerInput.requestEnvelope, 'answer');
      console.log('AnswerIntentHandler:', 'Respuesta del usuario:', userAnswer);

      const normalizedUserAnswer = removeAccents(userAnswer.toLowerCase());
      const normalizedCorrectAnswer = removeAccents(currentQuestion.correctAnswer.toLowerCase());

      const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;

      if (isCorrect) {
        // Respuesta correcta
        sessionAttributes.score += 1;

        if (sessionAttributes.questions.length > 0) {
          // Mostrar la pregunta siguiente
          const nextQuestion = sessionAttributes.questions.shift();
          sessionAttributes.currentQuestion = nextQuestion;

          // Agregar directiva para reproducir audio de la nueva pregunta
          const aplDocument = (sessionAttributes.category === 'Colores')
            ? generateColorAPLTemplate(nextQuestion.backgroundColor, nextQuestion.question)
            : generateAPLADocument(nextQuestion.soundURL);

          handlerInput.responseBuilder.addDirective({
            type: (sessionAttributes.category === 'Colores') ? 'Alexa.Presentation.APL.RenderDocument' : 'Alexa.Presentation.APLA.RenderDocument',
            token: 'gameDocumentToken',
            document: aplDocument,
          });

          const speakOutput = `¡Correcto! Siguiente pregunta: ${nextQuestion.question}`;
          console.log('AnswerIntentHandler:', speakOutput);
          return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('¿Cuál es tu respuesta?')
            .getResponse();
        } else {
          // No hay más preguntas, finalizar el juego
          const finalScore = sessionAttributes.score;
          const speakOutput = `¡Juego completado! Tu puntuación final es ${finalScore}. ¡Gracias por jugar!`;

          await sendDataToServer({
            nombre: sessionAttributes.userName,
            fecha: new Date().toISOString(),
            tiempoDuracion: elapsedTime,
            resultadoJuego: finalScore,
            category: sessionAttributes.category,
          });

          return handlerInput.responseBuilder.speak(speakOutput).getResponse();
        }
      } else {
        // Respuesta incorrecta
        sessionAttributes.wrongAttempts = (sessionAttributes.wrongAttempts || 0) + 1;

        if (sessionAttributes.wrongAttempts < 3) {
          // Aún hay intentos disponibles
          const speakOutput = `¡Incorrecto! ${attemptMessages[sessionAttributes.wrongAttempts - 1]}`;
          console.log('AnswerIntentHandler:', speakOutput);
          return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('¿Cuál es tu respuesta?')
            .getResponse();
        } else {
          // El usuario agotó sus intentos, mostrar la respuesta correcta y pasar a la siguiente pregunta
          sessionAttributes.wrongAttempts = 0; // Reiniciar el contador de intentos incorrectos
          const nextQuestion = sessionAttributes.questions.shift();
          sessionAttributes.currentQuestion = nextQuestion;

          // Agregar directiva para reproducir audio de la nueva pregunta incorrecta
          const aplDocument = (sessionAttributes.category === 'Colores')
            ? generateColorAPLTemplate(nextQuestion.backgroundColor, nextQuestion.question)
            : generateAPLADocument(nextQuestion.soundURL);

          handlerInput.responseBuilder.addDirective({
            type: (sessionAttributes.category === 'Colores') ? 'Alexa.Presentation.APL.RenderDocument' : 'Alexa.Presentation.APLA.RenderDocument',
            token: 'gameDocumentToken',
            document: aplDocument,
          });

          const speakOutput = `¡Incorrecto!
            La respuesta correcta es: ${currentQuestion.correctAnswer}. 
            Siguiente pregunta: ${nextQuestion.question}.`;
          console.log('AnswerIntentHandler:', speakOutput);
          return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('¿Cuál es tu respuesta?')
            .getResponse();
        }
      }
    } catch (error) {
      console.error('AnswerIntentHandler:', 'Error al manejar la respuesta del usuario', error);
      return handlerInput.responseBuilder.speak('Hubo un error al procesar tu respuesta.').getResponse();
    }
  },
};

const askNextQuestion = async (handlerInput, previousOutput = '') => {
  try {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const currentQuestion = sessionAttributes.currentQuestion;

    if (Array.isArray(sessionAttributes.questions) && sessionAttributes.questions.length > 0) {
      const nextQuestion = sessionAttributes.questions.shift();
      sessionAttributes.currentQuestion = nextQuestion;

      if (sessionAttributes.category === 'Colores') {
        const colorAPLTemplate = {
          type: 'APL',
          version: '1.8',
          theme: 'dark',
          import: [
            {
              name: 'alexa-layouts',
              version: '1.7.0',
            },
          ],
          mainTemplate: {
            items: [
              {
                type: 'AlexaHeadline',
                backgroundColor: nextQuestion.backgroundColor,
                primaryText: nextQuestion.question,
                secondaryText: '¡Bienvenido a Prueba!',
                id: 'AlexaHeadline',
              },
            ],
          },
        };

        const token = `colorAPLTemplateToken-${new Date().getTime()}`;
        console.log('Token APL:', token);

        handlerInput.responseBuilder.addDirective({
          type: 'Alexa.Presentation.APL.RenderDocument',
          token: token,
          document: colorAPLTemplate,
        });

        handlerInput.responseBuilder.addDirective({
          type: 'Alexa.Presentation.APL.ExecuteCommands',
          token: token,
          commands: [
            {
              type: 'Sequential',
              commands: [
                {
                  type: 'SpeakItem',
                  componentId: 'AlexaHeadline',
                },
              ],
            },
          ],
        });

        // Log APL Directives
        console.log('APL Directives:', JSON.stringify(handlerInput.responseBuilder.getResponse().directives));
      } else if (sessionAttributes.category === 'Animales') {
        handlerInput.responseBuilder.addDirective({
          type: 'Alexa.Presentation.APLA.RenderDocument',
          token: 'audioDocumentToken',
          document: generateAPLADocument(nextQuestion.soundURL),
        });
      }

      const speakOutput = `${previousOutput} Pregunta: ${nextQuestion.question}. ¿Cuál es tu respuesta?`;
      console.log('askNextQuestion:', `Mostrando nueva pregunta: ${nextQuestion.question}`);
      console.log('askNextQuestion:', 'speakOutput:', speakOutput);

      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt('¿Cuál es tu respuesta?')
        .getResponse();
    } else {
      const finalScore = sessionAttributes.score;
      if (sessionAttributes.gamesPlayed === 10) {
        const speakOutput = `¡Juego completado! Tu puntuación final es ${finalScore}. ¡Gracias por jugar!`;

        await sendDataToServer({
          nombre: sessionAttributes.userName,
          fecha: new Date().toISOString(),
          tiempoDuracion: elapsedTime,
          resultadoJuego: finalScore,
          category: sessionAttributes.category,
        });

        return handlerInput.responseBuilder.speak(speakOutput).getResponse();
      } else {
        return askNextQuestion(handlerInput, 'No hay más preguntas. ');
      }
    }
  } catch (error) {
    console.error('Error en askNextQuestion:', error);
    return handlerInput.responseBuilder.speak('Hubo un problema al mostrar la siguiente pregunta.').getResponse();
  }
};

const CaptureNameIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'CaptureNameIntent'
    );
  },
  handle(handlerInput) {
    const { requestEnvelope, attributesManager } = handlerInput;
    const userName = Alexa.getSlotValue(requestEnvelope, 'userName');

    if (userName) {
      const sessionAttributes = attributesManager.getSessionAttributes();
      sessionAttributes.userName = userName;

      const speakOutput = `¡Hola, ${userName}! ¿En qué categoría quieres jugar? Puedes elegir entre Colores y Animales.`;
      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt('¿En qué categoría quieres jugar? Di "Colores" o "Animales".')
        .getResponse();
    } else {
      const speakOutput = 'Lo siento, no pude capturar tu nombre. ¿Puedes repetirlo?';
      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt('Por favor, di tu nombre para continuar.')
        .getResponse();
    }
  },
};

const ColorCategoryIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'ColorCategoryIntent'
    );
  },
  async handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    sessionAttributes.category = 'Colores';

    return StartGameIntentHandler.handle(handlerInput);
  },
};

const AnimalCategoryIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'AnimalCategoryIntent'
    );
  },
  async handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    sessionAttributes.category = 'Animales';

    return StartGameIntentHandler.handle(handlerInput);
  },
};

const EndGameIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'EndGameIntent'
    );
  },
  async handle(handlerInput) {
    try {
      console.log('EndGameIntentHandler:', 'Entró en el manejador EndGameIntentHandler');

      const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
      const finalScore = sessionAttributes.score;

      await sendDataToServer({
            nombre: sessionAttributes.userName,
            fecha: new Date().toISOString(),
            tiempoDuracion: elapsedTime,
            resultadoJuego: finalScore,
          });

      console.log('EndGameIntentHandler:', 'Datos a enviar al servidor:', dataToSend);

      await sendDataToServer(dataToSend);

      return askNextQuestion(handlerInput);
    } catch (error) {
      console.error('Error en EndGameIntentHandler:', error);
      return handlerInput.responseBuilder.speak('Hubo un problema al finalizar el juego.').getResponse();
    }
  },
};
const UpdateScreenIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'UpdateScreenIntent'
    );
  },
  handle(handlerInput) {
    try {
      const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
      const currentQuestion = sessionAttributes.currentQuestion;

      if (!currentQuestion) {
        console.error('UpdateScreenIntentHandler:', 'currentQuestion no está definido.');
        return handlerInput.responseBuilder.speak('Hubo un problema con la pregunta actual.').getResponse();
      }

      // Log current question and color
      console.log('Current Question:', currentQuestion);
      console.log('Color actualizado:', currentQuestion.backgroundColor);

      const colorAPLTemplate = {
        type: 'APL',
        version: '1.8',  // Update to the latest version
        theme: 'dark',
        import: [
          {
            name: 'alexa-layouts',
            version: '1.7.0',
          },
        ],
        mainTemplate: {
          items: [
            {
              type: 'AlexaHeadline',
              backgroundColor: currentQuestion.backgroundColor,
              primaryText: currentQuestion.question,
              secondaryText: '¡Bienvenido a APL para audio!',
              id: 'AlexaHeadline',
            },
          ],
        },
      };

      const token = `colorAPLTemplateToken-${new Date().getTime()}`;
      console.log('Token APL:', token);

      handlerInput.responseBuilder.addDirective({
        type: 'Alexa.Presentation.APL.RenderDocument',
        token: token,
        document: colorAPLTemplate,
      });

      handlerInput.responseBuilder.addDirective({
        type: 'Alexa.Presentation.APL.ExecuteCommands',
        token: token,
        commands: [
          {
            type: 'Sequential',
            commands: [
              {
                type: 'SpeakItem',
                componentId: 'AlexaHeadline',
              },
            ],
          },
        ],
      });

      // Log APL Directives
      console.log('APL Directives:', JSON.stringify(handlerInput.responseBuilder.getResponse().directives));

      const speakOutput = `Pregunta: ${currentQuestion.question}. ¿Cuál es tu respuesta?`;

      return handlerInput.responseBuilder.speak(speakOutput).reprompt('¿Cuál es tu respuesta?').getResponse();
    } catch (error) {
      console.error('Error en UpdateScreenIntentHandler:', error);
      return handlerInput.responseBuilder.speak('Hubo un problema al mostrar la siguiente pregunta.').getResponse();
    }
  },
};
// Agrega UpdateScreenIntentHandler a la lista de manejadores
const skillBuilder = SkillBuilders.custom().addRequestHandlers(
  LaunchRequestHandler,
  CaptureNameIntentHandler,
  ColorCategoryIntentHandler,
  AnimalCategoryIntentHandler,
  StartGameIntentHandler,
  AnswerIntentHandler,
  EndGameIntentHandler,
  UpdateScreenIntentHandler  // Agrega esta línea
);

const skill = skillBuilder.create();
const adapter = new ExpressAdapter(skill, false, false);

app.post('/api/v1/webhook-alexa', adapter.getRequestHandlers());

app.use(express.json());

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 

