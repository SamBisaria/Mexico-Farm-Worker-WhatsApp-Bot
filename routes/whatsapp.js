const express = require('express');
const twilio = require('twilio');
const db = require('../database/db');
const { getRecommendedWorkers } = require('../utils/jobMatcher');
const router = express.Router();


const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

router.post('/', (req, res) => {
  const { From, Body } = req.body;
  const message = Body.toLowerCase().trim();
  const cleanNumber = From.replace('whatsapp:', '').replace(/[^0-9]/g, '');

  db.get('SELECT * FROM workers WHERE phone = ?', [cleanNumber], (err, worker) => {
    if (!worker && message !== 'registrar') {
      sendWhatsAppMessage(From, '¡Hola! 👋 Para registrarte, por favor envía el mensaje "REGISTRAR".');
      return res.sendStatus(200); 
    }

    // Handle commands
    if (message === 'registrar') {
      handleRegistration(From, cleanNumber);
      return res.sendStatus(200);
    } 
    if (message === 'ayuda' || message === 'help') {
      sendHelpMenu(From);
      return res.sendStatus(200);
    }
    if (message === 'trabajos' || message === 'jobs') {
      sendAvailableJobs(From, worker);
      return res.sendStatus(200);
    }
    // Send a link to the public jobs page (single-word command aliases)
    if (message === 'enlace' || message === 'link' || message === 'pagina') {
      sendJobsPageLink(From);
      return res.sendStatus(200);
    }
    if (message.startsWith('aceptar')) {
      const jobId = message.split(' ')[1];
      requestJobConfirmation(From, jobId);
      return res.sendStatus(200);
    }
    if (message.startsWith('confirmar')) {
      const jobId = message.split(' ')[1];
      acceptJob(From, worker, jobId);
      return res.sendStatus(200);
    }
    if (message === 'parar' || message === 'stop') {
      unsubscribe(From, cleanNumber);
      return res.sendStatus(200);
    }
    if (message.startsWith('nombre:')) {
      updateName(From, cleanNumber, Body.substring(7).trim());
      return res.sendStatus(200);
    }
    if (message.startsWith('ubicacion:')) {
      updateLocation(From, cleanNumber, Body.substring(10).trim());
      return res.sendStatus(200);
    }

    // default help
    sendHelpMenu(From);
    return res.sendStatus(200);
  });
});


function sendWhatsAppMessage(to, message) {
  return client.messages.create({
    body: message,
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to: to
  });
}

function handleRegistration(phoneNumber, cleanNumber) {
  db.get('SELECT * FROM workers WHERE phone = ?', [cleanNumber], (err, worker) => {
    const base = process.env.BASE_URL;
    const signupLink = `${base.replace(/\/$/, '')}/signup?phone=${cleanNumber}`;

    if (worker) {
      const msg =
        '✅ Ya estás registrado!\n\n' +
        `Si quieres actualizar tu información, completa el formulario: ${signupLink}\n\n` +
        '📝 También puedes actualizar algunos campos por WhatsApp. ' +
        'Envía "NOMBRE: tu nombre" o "UBICACION: tu ubicación"';
      sendWhatsAppMessage(phoneNumber, msg);
    } else {
      // Do not auto-insert here; require the user to complete the online form.
      sendWhatsAppMessage(phoneNumber,
        '🎉 ¡Casi listo! Para completar tu registro, por favor abre el siguiente enlace y rellena el formulario:\n' +
        `${signupLink}\n\n`);
    }
  });
}

function sendHelpMenu(phoneNumber) {
  const helpMessage = 
    '📋 *MENÚ DE AYUDA*\n\n' +
    '📝 *NOMBRE:* tu nombre - Actualizar nombre\n' +
    '📍 *UBICACION:* tu ubicación - Actualizar ubicación\n' +
    '💼 *TRABAJOS* - Ver trabajos disponibles\n' +
    '🔗 *ENLACE* - Recibir enlace a la página de trabajos\n' +
    '✅ *ACEPTAR* [número] - Aceptar un trabajo\n' +
    '🛑 *PARAR* - Dejar de recibir mensajes\n' +
    '❓ *AYUDA* - Ver este menú';
  
  sendWhatsAppMessage(phoneNumber, helpMessage);
}

function sendAvailableJobs(phoneNumber, worker) {
  db.all(
    'SELECT * FROM jobs WHERE active = 1 AND date >= date("now")',
    [],
    (err, jobs) => {
      if (err || jobs.length === 0) {
        sendWhatsAppMessage(phoneNumber, '📭 No hay trabajos disponibles en este momento.');
        return;
      }

      let message = '💼 *TRABAJOS DISPONIBLES*\n\n';
      jobs.forEach((job, index) => {
        message += `*#${job.id}* - ${job.title}\n`;
        message += `📍 ${job.location}\n`;
        message += `💰 $${job.pay_rate} ${job.pay_type}\n`;
        message += `📅 ${job.date}\n`;
        message += job.transport_provided ? '🚌 Transporte incluido\n' : '';
        message += `⏱️ ${job.duration} horas\n`;
        if (job.description) {
          message += `📝 ${job.description}\n`;
        }
        message += '---\n';
      });
      message += '\nPara aceptar, envía: ACEPTAR [número]';
      
      sendWhatsAppMessage(phoneNumber, message);
    }
  );
}

function requestJobConfirmation(phoneNumber, jobId) {
  if (!jobId) {
    sendWhatsAppMessage(phoneNumber, '❌ Por favor especifica el número del trabajo. Ejemplo: ACEPTAR 5');
    return;
  }

  const message = 
    `🛡️ *TUS DERECHOS Y COMPROMISOS*\n\n` +
    `Antes de aceptar el trabajo #${jobId}, recuerda que tienes derecho a:\n` +
    `• 💰 Pago justo y acordado\n` +
    `• 🤝 Trato digno y respetuoso\n` +
    `• 🛡️ Ambiente de trabajo seguro\n` +
    `• 💧 Agua potable y descansos\n\n` +
    `Al confirmar, aceptas estos términos y te comprometes a cumplir con el trabajo.\n\n` +
    `Para finalizar, responde: *CONFIRMAR ${jobId}*`;

  sendWhatsAppMessage(phoneNumber, message);
}

function acceptJob(phoneNumber, worker, jobId) {
  if (!jobId) {
    sendWhatsAppMessage(phoneNumber, '❌ Por favor especifica el número del trabajo. Ejemplo: ACEPTAR 5');
    return;
  }

  db.run(
    'INSERT INTO applications (worker_id, job_id, status) VALUES (?, ?, ?)',
    [worker.id, jobId, 'accepted'],
    function(err) {
      if (err) {
        sendWhatsAppMessage(phoneNumber, '❌ Error al aceptar el trabajo. Intenta de nuevo.');
      } else {
        sendWhatsAppMessage(phoneNumber, 
          `✅ ¡Trabajo #${jobId} aceptado!\n\n` +
          'El empleador será notificado. Te contactarán pronto con más detalles.');
      }
    }
  );
}

function updateName(phoneNumber, cleanNumber, name) {
  db.run('UPDATE workers SET name = ? WHERE phone = ?', [name, cleanNumber], (err) => {
    if (!err) {
      sendWhatsAppMessage(phoneNumber, `✅ Nombre actualizado a: ${name}`);
    }
  });
}

function updateLocation(phoneNumber, cleanNumber, location) {
  db.run('UPDATE workers SET location = ? WHERE phone = ?', [location, cleanNumber], (err) => {
    if (!err) {
      sendWhatsAppMessage(phoneNumber, `✅ Ubicación actualizada a: ${location}`);
    }
  });
}

function unsubscribe(phoneNumber, cleanNumber) {
  db.run('UPDATE workers SET active = 0 WHERE phone = ?', [cleanNumber], (err) => {
    if (!err) {
      sendWhatsAppMessage(phoneNumber, 
        '👋 Has sido dado de baja del sistema.\n' +
        'Para volver a registrarte, envía "REGISTRAR"');
    }
  });
}

function sendJobsPageLink(phoneNumber) {
  const base = process.env.BASE_URL;
  const jobsLink = `${base.replace(/\/$/, '')}/jobs`;
  sendWhatsAppMessage(phoneNumber, `🔗 Ver trabajos disponibles: ${jobsLink}`);
}

// Function to send job notifications (called from jobs.js)
// Uses hybrid recommendation algorithm combining collaborative filtering and location proximity
async function sendJobToWorkers(job, specificWorkers = null) {
  const sendTo = (workers) => {
    const message = 
      `🆕 *NUEVO TRABAJO DISPONIBLE*\n\n` +
      `*${job.title}*\n` +
      `📍 ${job.location}\n` +
      `💰 $${job.pay_rate} ${job.pay_type}\n` +
      `📅 ${job.date}\n` +
      (job.transport_provided ? '🚌 Transporte incluido\n' : '') +
      `⏱️ ${job.duration} horas\n` +
      (job.description ? `📝 ${job.description}\n\n` : '\n') +
      `Para aceptar, envía: ACEPTAR ${job.id}`;
    
    workers.forEach(worker => {
      sendWhatsAppMessage(`whatsapp:${worker.phone}`, message);
    });
  };

  if (specificWorkers) {
    sendTo(specificWorkers);
  } else {
    // Use recommendation algorithm: distance filter (10km) + collaborative filtering
    const recommendedWorkers = await getRecommendedWorkers(job, 50, 10); // threshold: 50/100, maxDistance: 10km
    
    if (recommendedWorkers.length > 0) {
      console.log(`Sending job #${job.id} to ${recommendedWorkers.length} recommended workers (within 10km)`);
      sendTo(recommendedWorkers);
    } else {
      console.log(`No workers within 10km matched recommendation threshold for job #${job.id}`);
    }
  }
}

module.exports = router;
module.exports.sendJobToWorkers = sendJobToWorkers;